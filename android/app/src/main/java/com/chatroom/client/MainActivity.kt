package com.chatroom.client

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.chatroom.client.ui.ChatViewModel
import com.chatroom.client.ui.chat.ChatScreen
import com.chatroom.client.ui.connect.ConnectServerScreen
import com.chatroom.client.ui.conversations.ConversationListScreen
import com.chatroom.client.ui.login.LoginScreen
import com.chatroom.client.ui.navigation.Routes
import com.chatroom.client.ui.theme.ChatRoomTheme
import com.chatroom.client.ui.welcome.WelcomeScreen

class MainActivity : ComponentActivity() {

    private val vm: ChatViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            ChatRoomTheme {
                AppNav(vm)
            }
        }
    }
}

@Composable
private fun AppNav(vm: ChatViewModel) {
    val navController = rememberNavController()

    NavHost(
        navController = navController,
        startDestination = Routes.WELCOME
    ) {
        composable(Routes.WELCOME) {
            WelcomeScreen(
                onConnectServer = { navController.navigate(Routes.CONNECT) }
            )
        }

        composable(Routes.CONNECT) {
            ConnectServerScreen(
                vm = vm,
                onBack = { navController.popBackStack() },
                onConnected = { navController.navigate(Routes.LOGIN) }
            )
        }

        composable(Routes.LOGIN) {
            LoginScreen(
                vm = vm,
                onBack = { navController.popBackStack() },
                onLoggedIn = {
                    navController.navigate(Routes.CONVERSATIONS) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                }
            )
        }

        composable(Routes.CONVERSATIONS) {
            ConversationListScreen(
                vm = vm,
                onOpenConversation = { id -> navController.navigate(Routes.chat(id)) },
                onLogout = {
                    navController.navigate(Routes.WELCOME) {
                        popUpTo(navController.graph.id) { inclusive = true }
                    }
                }
            )
        }

        composable(
            route = Routes.CHAT,
            arguments = listOf(
                navArgument("conversationId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val conversationId = backStackEntry.arguments?.getString("conversationId").orEmpty()
            ChatScreen(
                conversationId = conversationId,
                vm = vm,
                onBack = { navController.popBackStack() }
            )
        }
    }
}
