package com.chatroom.client.data

import android.content.Context
import android.content.SharedPreferences
import com.chatroom.client.data.model.User
import com.google.gson.Gson

/**
 * 本地会话存储：serverHost / serverPort / token / 当前用户信息
 */
class SessionManager(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences("chatroom_prefs", Context.MODE_PRIVATE)
    private val gson = Gson()

    var serverHost: String
        get() = prefs.getString(KEY_HOST, "") ?: ""
        set(value) = prefs.edit().putString(KEY_HOST, value).apply()

    var serverPort: String
        get() = prefs.getString(KEY_PORT, "4000") ?: "4000"
        set(value) = prefs.edit().putString(KEY_PORT, value).apply()

    var token: String
        get() = prefs.getString(KEY_TOKEN, "") ?: ""
        set(value) = prefs.edit().putString(KEY_TOKEN, value).apply()

    var currentUser: User?
        get() = prefs.getString(KEY_USER, null)?.let { runCatching { gson.fromJson(it, User::class.java) }.getOrNull() }
        set(value) = prefs.edit().putString(KEY_USER, value?.let { gson.toJson(it) }).apply()

    val hasServer: Boolean get() = serverHost.isNotBlank()
    val hasToken: Boolean get() = token.isNotBlank()

    /** 基础 HTTP 地址，例如 http://192.168.1.100:4000 */
    val baseHttpUrl: String get() = "http://$serverHost:$serverPort"

    /** WebSocket 地址（不含 token，由连接时拼接） */
    fun wsUrl(token: String): String =
        "ws://$serverHost:$serverPort/ws?token=$token"

    fun clear() {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_HOST = "server_host"
        private const val KEY_PORT = "server_port"
        private const val KEY_TOKEN = "jwt_token"
        private const val KEY_USER = "current_user"

        @Volatile
        private var instance: SessionManager? = null

        fun get(context: Context): SessionManager =
            instance ?: synchronized(this) {
                instance ?: SessionManager(context).also { instance = it }
            }
    }
}
