package com.chatroom.client.data.remote

import com.google.gson.GsonBuilder
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/**
 * 根据当前服务器地址动态构建 Retrofit / OkHttp 客户端。
 * 服务器地址由用户输入，不硬编码。
 */
object ApiClient {

    @Volatile
    private var cachedBaseUrl: String? = null

    @Volatile
    private var service: ApiService? = null

    private val gson = GsonBuilder().create()

    private val loggingInterceptor = HttpLoggingInterceptor().apply {
        level = HttpLoggingInterceptor.Level.BASIC
    }

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .writeTimeout(20, TimeUnit.SECONDS)
            .pingInterval(30, TimeUnit.SECONDS)
            .addInterceptor(loggingInterceptor)
            .build()
    }

    /**
     * @param baseHttpUrl 形如 http://192.168.1.100:4000
     */
    fun get(baseHttpUrl: String): ApiService {
        if (service != null && cachedBaseUrl == baseHttpUrl) return service!!
        synchronized(this) {
            if (service != null && cachedBaseUrl == baseHttpUrl) return service!!
            val retrofit = Retrofit.Builder()
                .baseUrl("$baseHttpUrl/")
                .client(client)
                .addConverterFactory(GsonConverterFactory.create(gson))
                .build()
            service = retrofit.create(ApiService::class.java)
            cachedBaseUrl = baseHttpUrl
            return service!!
        }
    }

    fun authHeader(token: String): String = "Bearer $token"
}
