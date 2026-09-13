package com.chatroom.client.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.chatroom.client.data.SessionManager
import com.chatroom.client.data.WebSocketManager
import com.chatroom.client.data.model.Conversation
import com.chatroom.client.data.model.Message
import com.chatroom.client.data.model.SendMessageRequest
import com.chatroom.client.data.model.Sender
import com.chatroom.client.data.model.User
import com.chatroom.client.data.remote.ApiClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class ChatViewModel(app: Application) : AndroidViewModel(app) {

    private val session = SessionManager.get(app)
    private val ws = WebSocketManager.get()

    private val _busy = MutableStateFlow(false)
    val busy: StateFlow<Boolean> = _busy.asStateFlow()

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error.asStateFlow()

    private val _currentUser = MutableStateFlow<User?>(session.currentUser)
    val currentUser: StateFlow<User?> = _currentUser.asStateFlow()

    private val _conversations = MutableStateFlow<List<Conversation>>(emptyList())
    val conversations: StateFlow<List<Conversation>> = _conversations.asStateFlow()

    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages: StateFlow<List<Message>> = _messages.asStateFlow()

    private val _wsConnected = MutableStateFlow(false)
    val wsConnected: StateFlow<Boolean> = _wsConnected.asStateFlow()

    private val _refreshing = MutableStateFlow(false)
    val refreshing: StateFlow<Boolean> = _refreshing.asStateFlow()

    private var activeConversationId: String? = null

    init {
        observeWs()
    }

    fun clearError() { _error.value = null }

    // ---------- 启动路由判断 ----------
    fun shouldAutoLogin(): Boolean = session.hasServer && session.hasToken

    // ---------- 连接服务器（健康检查） ----------
    suspend fun checkServer(host: String, port: String): Result<Unit> {
        _busy.value = true
        return try {
            val base = "http://$host:$port"
            val resp = ApiClient.get(base).health()
            if (resp.success && resp.data?.status == "ok") {
                session.serverHost = host
                session.serverPort = port
                Result.success(Unit)
            } else {
                Result.failure(IOException("服务器响应异常：${resp.error ?: resp.data?.status}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        } finally {
            _busy.value = false
        }
    }

    // ---------- 登录 ----------
    suspend fun login(username: String, password: String): Result<Unit> {
        _busy.value = true
        return try {
            val resp = ApiClient.get(session.baseHttpUrl).login(
                com.chatroom.client.data.model.LoginRequest(username, password)
            )
            if (resp.success && resp.data != null) {
                finishLogin(resp.data.token, resp.data.user)
                Result.success(Unit)
            } else {
                Result.failure(IOException(resp.error ?: "登录失败"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        } finally {
            _busy.value = false
        }
    }

    suspend fun loginWithToken(rawToken: String): Result<Unit> {
        _busy.value = true
        return try {
            val resp = ApiClient.get(session.baseHttpUrl)
                .me(ApiClient.authHeader(rawToken.trim()))
            if (resp.success && resp.data != null) {
                finishLogin(rawToken.trim(), resp.data)
                Result.success(Unit)
            } else {
                Result.failure(IOException(resp.error ?: "令牌无效"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        } finally {
            _busy.value = false
        }
    }

    private fun finishLogin(token: String, user: User) {
        session.token = token
        session.currentUser = user
        _currentUser.value = user
        ws.connect(session.wsUrl(token))
    }

    // ---------- 会话列表 ----------
    fun loadConversations() {
        viewModelScope.launch {
            try {
                _refreshing.value = true
                val resp = ApiClient.get(session.baseHttpUrl)
                    .conversations(ApiClient.authHeader(session.token))
                if (resp.success) {
                    _conversations.value = resp.data ?: emptyList()
                } else {
                    _error.value = resp.error ?: "加载会话失败"
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "网络错误"
            } finally {
                _refreshing.value = false
            }
        }
    }

    // ---------- 聊天 ----------
    fun openConversation(id: String) {
        activeConversationId = id
        ws.joinConversation(id)
        viewModelScope.launch {
            try {
                val resp = ApiClient.get(session.baseHttpUrl)
                    .messages(id, ApiClient.authHeader(session.token))
                if (resp.success) {
                    _messages.value = (resp.data ?: emptyList()).reversed()
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "加载消息失败"
            }
        }
    }

    fun leaveConversation() {
        activeConversationId?.let { ws.leaveConversation(it) }
        activeConversationId = null
        _messages.value = emptyList()
    }

    fun sendMessage(conversationId: String, content: String) {
        val text = content.trim()
        if (text.isBlank()) return
        val user = _currentUser.value
        val tempId = "temp-${System.currentTimeMillis()}"
        val nowIso = currentIsoNow()
        val tempSender = user?.let {
            Sender(id = it.id, username = it.username, displayName = it.displayName, avatarUrl = it.avatarUrl)
        }
        val tempMsg = Message(
            id = tempId,
            conversationId = conversationId,
            senderId = user?.id,
            content = text,
            messageType = "text",
            createdAt = nowIso,
            sender = tempSender
        )
        // 乐观更新：立即把临时消息加入列表末尾
        _messages.value = _messages.value + tempMsg

        viewModelScope.launch {
            try {
                val resp = ApiClient.get(session.baseHttpUrl).sendMessage(
                    conversationId,
                    ApiClient.authHeader(session.token),
                    SendMessageRequest(content = text)
                )
                if (resp.success && resp.data != null) {
                    val real = resp.data
                    // 用服务端返回的真实消息替换临时消息
                    _messages.value = _messages.value.map { if (it.id == tempId) real else it }
                } else {
                    _error.value = resp.error ?: "发送失败"
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "发送失败"
            }
        }
    }

    /** 当前时间的 ISO 8601 UTC 字符串 */
    private fun currentIsoNow(): String {
        val sdf = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", java.util.Locale.US)
        sdf.timeZone = TimeZone.getTimeZone("UTC")
        return sdf.format(Date())
    }

    // ---------- WebSocket 事件 ----------
    private fun observeWs() {
        viewModelScope.launch {
            ws.connected.collect { _wsConnected.value = it }
        }
        viewModelScope.launch {
            ws.events
                .catch { }
                .collect { env ->
                    if (env.type == "new_message" && env.message != null) {
                        val msg = env.message
                        if (msg.conversationId == activeConversationId) {
                            val list = _messages.value.toMutableList()
                            val existingIdx = list.indexOfFirst { it.id == msg.id }
                            if (existingIdx >= 0) {
                                // 真实消息已存在，不重复添加
                            } else {
                                // 匹配临时消息（content + senderId），用真实消息替换
                                val tempIdx = list.indexOfFirst {
                                    it.id.startsWith("temp-") &&
                                        it.content == msg.content &&
                                        (it.senderId ?: it.sender?.id) == (msg.senderId ?: msg.sender?.id)
                                }
                                if (tempIdx >= 0) {
                                    list[tempIdx] = msg
                                } else {
                                    list.add(msg)
                                }
                            }
                            _messages.value = list
                        }
                        // 同时刷新会话列表的最后一条消息
                        val convId = env.conversationId ?: msg.conversationId
                        if (convId != null) {
                            _conversations.value = _conversations.value.map { c ->
                                if (c.id == convId) {
                                    c.copy(lastMessage = com.chatroom.client.data.model.LastMessage(
                                        id = msg.id,
                                        content = msg.content,
                                        senderId = msg.senderId,
                                        createdAt = msg.createdAt
                                    ))
                                } else c
                            }
                        }
                    }
                }
        }
    }

    // ---------- 退出登录 ----------
    fun logout() {
        ws.disconnect()
        session.clear()
        _currentUser.value = null
        _conversations.value = emptyList()
        _messages.value = emptyList()
        activeConversationId = null
    }

    fun serverLabel(): String = "${session.serverHost}:${session.serverPort}"
}
