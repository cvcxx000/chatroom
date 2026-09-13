package com.chatroom.client.ui.conversations

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.filled.Group
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshDefaults
import androidx.compose.material3.pulltorefresh.rememberPullToRefreshState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.chatroom.client.data.model.Conversation
import com.chatroom.client.ui.ChatViewModel
import com.chatroom.client.ui.chat.Avatar
import com.chatroom.client.utils.DateTimeUtils

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConversationListScreen(
    vm: ChatViewModel,
    onLogout: () -> Unit,
    onOpenConversation: (String) -> Unit
) {
    val conversations by vm.conversations.collectAsState()
    val user by vm.currentUser.collectAsState()
    val wsConnected by vm.wsConnected.collectAsState()
    val refreshing by vm.refreshing.collectAsState()
    var showUserInfo by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) { vm.loadConversations() }

    val refreshState = rememberPullToRefreshState()

    // 用户下拉松手后 state 会进入刷新态，此时触发加载
    LaunchedEffect(refreshState.isRefreshing) {
        if (refreshState.isRefreshing && !refreshing) {
            vm.loadConversations()
        }
    }
    // 加载完成后关闭下拉刷新指示器
    LaunchedEffect(refreshing) {
        if (!refreshing && refreshState.isRefreshing) {
            refreshState.endRefresh()
        }
    }

    Scaffold(topBar = {
        TopAppBar(
            title = {
                Column {
                    Text(user?.displayName ?: user?.username ?: "我的会话", style = MaterialTheme.typography.titleMedium)
                    Text(
                        if (wsConnected) "● 已连接 ${vm.serverLabel()}" else "○ 连接中…",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )
                }
            },
            actions = {
                IconButton(onClick = { showUserInfo = true }) {
                    Icon(Icons.Default.Info, contentDescription = "用户信息")
                }
                IconButton(onClick = { vm.logout(); onLogout() }) {
                    Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = "退出登录")
                }
            }
        )
    }) { padding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .nestedScroll(refreshState.nestedScrollConnection)
        ) {
            if (conversations.isEmpty()) {
                Column(
                    modifier = Modifier.fillMaxSize(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.Center
                ) {
                    Text("暂无会话", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))
                    Text(
                        "下拉刷新或等待新消息",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                    )
                }
            } else {
                LazyColumn(modifier = Modifier.fillMaxSize()) {
                    items(conversations, key = { it.id }) { conv ->
                        ConversationItem(conv, user?.id, onClick = { onOpenConversation(conv.id) })
                    }
                }
            }

            PullToRefreshDefaults.Indicator(
                state = refreshState,
                modifier = Modifier.align(Alignment.TopCenter)
            )
        }
    }

    if (showUserInfo) {
        UserInfoDialog(
            vm = vm,
            onDismiss = { showUserInfo = false },
            onLogout = {
                showUserInfo = false
                vm.logout()
                onLogout()
            }
        )
    }
}

@Composable
private fun UserInfoDialog(
    vm: ChatViewModel,
    onDismiss: () -> Unit,
    onLogout: () -> Unit
) {
    val user by vm.currentUser.collectAsState()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("用户信息") },
        text = {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Avatar(
                        name = user?.displayName ?: user?.username,
                        userId = user?.id,
                        size = 56.dp
                    )
                    Spacer(Modifier.width(16.dp))
                    Column {
                        Text(
                            user?.displayName ?: user?.username ?: "未登录",
                            style = MaterialTheme.typography.titleMedium
                        )
                        Text(
                            "@${user?.username ?: "-"}",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                        )
                    }
                }
                Spacer(Modifier.height(16.dp))
                InfoRow("用户 ID", user?.id ?: "-")
                InfoRow("用户名", user?.username ?: "-")
                InfoRow("显示名称", user?.displayName ?: "-")
                InfoRow("是否管理员", if (user?.isAdmin == true) "是" else "否")
                InfoRow("服务器地址", vm.serverLabel())
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("关闭") }
        },
        dismissButton = {
            TextButton(onClick = onLogout) {
                Text("退出登录", color = MaterialTheme.colorScheme.error)
            }
        }
    )
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
            modifier = Modifier.width(96.dp)
        )
        Text(value, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun ConversationItem(conv: Conversation, currentUserId: String?, onClick: () -> Unit) {
    val title = rememberTitle(conv, currentUserId)
    val last = conv.lastMessage
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Surface(shape = CircleShape, color = MaterialTheme.colorScheme.primary.copy(alpha = 0.12f),
            modifier = Modifier.size(48.dp)) {
            Column(horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center) {
                Icon(
                    if (conv.type == "group") Icons.Default.Group else Icons.Default.Person,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.primary
                )
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(title, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(
                last?.content ?: "暂无消息",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Spacer(Modifier.width(8.dp))
        Text(
            DateTimeUtils.formatConversationTime(last?.createdAt),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
        )
    }
}

@Composable
private fun rememberTitle(conv: Conversation, currentUserId: String?): String {
    return if (conv.type == "group") {
        conv.name ?: "群聊"
    } else {
        val other = conv.members?.firstOrNull { it.userId != currentUserId }
        other?.displayName ?: other?.username ?: conv.name ?: "私聊"
    }
}
