package com.chatroom.client.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.chatroom.client.data.SessionManager
import com.chatroom.client.data.WebSocketManager
import com.chatroom.client.data.model.Conversation
import com.chatroom.client.data.model.Message
import com.chatroom.client.data.model.User
import com.chatroom.client.data.remote.ApiClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import java.io.IOException

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
                val resp = ApiClient.get(session.baseHttpUrl)
                    .conversations(ApiClient.authHeader(session.token))
                if (resp.success) {
                    _conversations.value = resp.data ?: emptyList()
                } else {
                    _error.value = resp.error ?: "加载会话失败"
                }
            } catch (e: Exception) {
                _error.value = e.message ?: "网络错误"
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
        if (content.isBlank()) return
        viewModelScope.launch {
            try {
                ApiClient.get(session.baseHttpUrl).sendMessage(
                    conversationId,
                    ApiClient.authHeader(session.token),
                    com.chatroom.client.data.model.SendMessageRequest(content = content.trim())
                )
            } catch (e: Exception) {
                _error.value = e.message ?: "发送失败"
            }
        }
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
                            if (list.none { it.id == msg.id }) list.add(msg)
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
