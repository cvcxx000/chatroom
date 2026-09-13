package com.chatroom.client.data

import android.util.Log
import com.chatroom.client.data.model.WsMessageEnvelope
import com.google.gson.Gson
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow

/**
 * 全局单例 WebSocket 连接管理，带自动重连。
 */
class WebSocketManager private constructor() {

    private val gson = Gson()

    private val client = OkHttpClient.Builder()
        .pingInterval(20, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    private var webSocket: WebSocket? = null
    private var currentUrl: String? = null
    private var reconnecting = false
    @Volatile private var shouldReconnect = false

    private val _events = MutableSharedFlow<WsMessageEnvelope>(extraBufferCapacity = 64)
    val events: SharedFlow<WsMessageEnvelope> = _events.asSharedFlow()

    private val _connected = MutableSharedFlow<Boolean>(extraBufferCapacity = 1)
    val connected: SharedFlow<Boolean> = _connected.asSharedFlow()

    fun connect(url: String) {
        if (webSocket != null && currentUrl == url) return
        disconnectInternal()
        currentUrl = url
        shouldReconnect = true
        open(url)
    }

    private fun open(url: String) {
        val request = Request.Builder().url(url).build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(TAG, "ws onOpen")
                reconnecting = false
                _connected.tryEmit(true)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d(TAG, "ws msg: $text")
                runCatching { gson.fromJson(text, WsMessageEnvelope::class.java) }
                    .getOrNull()?.let { _events.tryEmit(it) }
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.w(TAG, "ws onClosed $code $reason")
                _connected.tryEmit(false)
                scheduleReconnect()
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "ws onFailure", t)
                _connected.tryEmit(false)
                scheduleReconnect()
            }
        })
    }

    private fun scheduleReconnect() {
        if (!shouldReconnect || reconnecting) return
        reconnecting = true
        val url = currentUrl ?: return
        Thread {
            try { Thread.sleep(3000) } catch (_: InterruptedException) {}
            if (shouldReconnect) open(url)
        }.start()
    }

    fun joinConversation(conversationId: String) {
        send(mapOf("type" to "join_conversation", "conversationId" to conversationId))
    }

    fun leaveConversation(conversationId: String) {
        send(mapOf("type" to "leave_conversation", "conversationId" to conversationId))
    }

    private fun send(payload: Map<String, String>) {
        runCatching { webSocket?.send(gson.toJson(payload)) }
    }

    private fun disconnectInternal() {
        shouldReconnect = false
        runCatching { webSocket?.close(1000, "logout") }
        webSocket = null
    }

    fun disconnect() {
        disconnectInternal()
        currentUrl = null
    }

    companion object {
        private const val TAG = "ChatRoomWS"

        @Volatile
        private var instance: WebSocketManager? = null

        fun get(): WebSocketManager =
            instance ?: synchronized(this) {
                instance ?: WebSocketManager().also { instance = it }
            }
    }
}
