package com.chatroom.client.ui.navigation

object Routes {
    const val WELCOME = "welcome"
    const val CONNECT = "connect"
    const val LOGIN = "login"
    const val CONVERSATIONS = "conversations"
    const val CHAT = "chat/{conversationId}"
    fun chat(id: String) = "chat/$id"
}
