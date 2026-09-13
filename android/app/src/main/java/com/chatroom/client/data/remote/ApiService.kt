package com.chatroom.client.data.remote

import com.chatroom.client.data.model.ApiResponse
import com.chatroom.client.data.model.Conversation
import com.chatroom.client.data.model.HealthResponse
import com.chatroom.client.data.model.LoginRequest
import com.chatroom.client.data.model.LoginResponse
import com.chatroom.client.data.model.MeResponse
import com.chatroom.client.data.model.Message
import com.chatroom.client.data.model.MessagesResponse
import com.chatroom.client.data.model.SendMessageRequest
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {

    @GET("health")
    suspend fun health(): HealthResponse

    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @POST("api/auth/admin-login")
    suspend fun adminLogin(@Body body: LoginRequest): LoginResponse

    @GET("api/auth/me")
    suspend fun me(@Header("Authorization") auth: String): MeResponse

    @GET("api/conversations")
    suspend fun conversations(@Header("Authorization") auth: String): ApiResponse<List<Conversation>>

    @GET("api/conversations/{id}/messages")
    suspend fun messages(
        @Path("id") id: String,
        @Header("Authorization") auth: String,
        @Query("before") before: String? = null,
        @Query("limit") limit: Int = 30
    ): MessagesResponse

    @POST("api/conversations/{id}/messages")
    suspend fun sendMessage(
        @Path("id") id: String,
        @Header("Authorization") auth: String,
        @Body body: SendMessageRequest
    ): ApiResponse<Message>
}
