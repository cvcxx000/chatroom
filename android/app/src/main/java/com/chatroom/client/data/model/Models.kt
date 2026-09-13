package com.chatroom.client.data.model

import com.google.gson.annotations.SerializedName

/**
 * 统一响应包装：{success, data} 或 {success, error, code}
 */
data class ApiResponse<T>(
    val success: Boolean,
    val data: T? = null,
    val error: String? = null,
    val code: String? = null
)

data class HealthData(val status: String?)
typealias HealthResponse = ApiResponse<HealthData>

// ---- Auth ----

data class LoginRequest(
    val username: String,
    val password: String
)

data class User(
    val id: String,
    val username: String,
    val displayName: String? = null,
    val avatarUrl: String? = null,
    val isAdmin: Boolean? = null,
    val isVerified: Boolean? = null
)

data class LoginData(
    val token: String,
    val user: User
)
typealias LoginResponse = ApiResponse<LoginData>
typealias MeResponse = ApiResponse<User>

// ---- Conversations ----

data class Member(
    val userId: String,
    val username: String? = null,
    val displayName: String? = null,
    val avatarUrl: String? = null,
    val role: String? = null
)

data class LastMessage(
    val id: String,
    val content: String? = null,
    @SerializedName("sender_id") val senderId: String? = null,
    @SerializedName("created_at") val createdAt: String? = null
)

data class Conversation(
    val id: String,
    val type: String, // "private" | "group"
    val name: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null,
    @SerializedName("lastMessage") val lastMessage: LastMessage? = null,
    val members: List<Member>? = null
)

typealias ConversationsResponse = ApiResponse<List<Conversation>>

// ---- Messages ----

data class Sender(
    val id: String,
    val username: String? = null,
    val displayName: String? = null,
    val avatarUrl: String? = null
)

data class Message(
    val id: String,
    @SerializedName("conversation_id") val conversationId: String,
    @SerializedName("sender_id") val senderId: String? = null,
    val content: String? = null,
    @SerializedName("message_type") val messageType: String? = null,
    @SerializedName("created_at") val createdAt: String? = null,
    val sender: Sender? = null
)

typealias MessagesResponse = ApiResponse<List<Message>>

data class SendMessageRequest(
    val content: String,
    @SerializedName("messageType") val messageType: String = "text"
)

// ---- WebSocket 推送 ----

data class WsMessageEnvelope(
    val type: String,
    val userId: String? = null,
    val conversationId: String? = null,
    val message: Message? = null
)
