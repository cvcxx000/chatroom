package com.chatroom.client.ui.conversations

import androidx.compose.foundation.clickable
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
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.chatroom.client.data.model.Conversation
import com.chatroom.client.ui.ChatViewModel
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

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

    LaunchedEffect(Unit) { vm.loadConversations() }

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
                IconButton(onClick = { vm.logout(); onLogout() }) {
                    Icon(Icons.AutoMirrored.Filled.ExitToApp, contentDescription = "退出登录")
                }
            }
        )
    }) { padding ->
        if (conversations.isEmpty()) {
            Column(
                modifier = Modifier.fillMaxSize().padding(padding),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center
            ) {
                Text("暂无会话", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(8.dp))
                Text("下拉刷新或等待新消息", style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f))
            }
            return@Scaffold
        }
        LazyColumn(modifier = Modifier.fillMaxSize().padding(padding)) {
            items(conversations, key = { it.id }) { conv ->
                ConversationItem(conv, user?.id, onClick = { onOpenConversation(conv.id) })
            }
        }
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
                verticalArrangement = androidx.compose.foundation.layout.Arrangement.Center) {
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
            formatTime(last?.createdAt),
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

private fun formatTime(iso: String?): String {
    if (iso.isNullOrBlank()) return ""
    return runCatching {
        val parser = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
        val date = parser.parse(iso) ?: return@runCatching ""
        val now = Date()
        val diff = now.time - date.time
        when {
            diff < 60_000 -> "刚刚"
            diff < 3600_000 -> "${diff / 60_000}分钟前"
            diff < 86400_000 -> "${diff / 3600_000}小时前"
            else -> SimpleDateFormat("MM-dd", Locale.US).format(date)
        }
    }.getOrDefault("")
}
