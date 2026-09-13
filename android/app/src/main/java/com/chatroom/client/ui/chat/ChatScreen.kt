package com.chatroom.client.ui.chat

import androidx.compose.foundation.background
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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.chatroom.client.data.model.Message
import com.chatroom.client.ui.ChatViewModel
import com.chatroom.client.utils.DateTimeUtils

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    conversationId: String,
    vm: ChatViewModel,
    onBack: () -> Unit
) {
    val messages by vm.messages.collectAsState()
    val currentUser by vm.currentUser.collectAsState()
    val conversations by vm.conversations.collectAsState()
    var input by remember { mutableStateOf("") }
    val listState = rememberLazyListState()

    LaunchedEffect(conversationId) {
        vm.openConversation(conversationId)
    }
    DisposableEffect(Unit) {
        onDispose { vm.leaveConversation() }
    }

    // 新消息时自动滚动到底部（reverseLayout=true，index 0 为最新消息在底部）
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(0)
        }
    }

    val conversation = conversations.firstOrNull { it.id == conversationId }
    val isGroup = conversation?.type == "group"
    val title = remember(conversation, currentUser) {
        when {
            conversation == null -> "聊天"
            conversation.type == "group" -> conversation.name ?: "群聊"
            else -> {
                val other = conversation.members?.firstOrNull { it.userId != currentUser?.id }
                other?.displayName ?: other?.username ?: conversation.name ?: "私聊"
            }
        }
    }

    Scaffold(topBar = {
        TopAppBar(
            title = { Text(title) },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                }
            }
        )
    }) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth(),
                reverseLayout = true,
                contentPadding = androidx.compose.foundation.layout.PaddingValues(
                    horizontal = 12.dp,
                    vertical = 8.dp
                ),
                verticalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                items(messages, key = { it.id }) { msg ->
                    val senderId = msg.senderId ?: msg.sender?.id
                    MessageBubble(
                        message = msg,
                        isMe = senderId == currentUser?.id,
                        showSenderName = isGroup
                    )
                }
            }

            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 8.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it },
                    modifier = Modifier.weight(1f),
                    placeholder = { Text("输入消息…") },
                    maxLines = 4
                )
                Spacer(Modifier.width(8.dp))
                Button(onClick = {
                    val text = input.trim()
                    if (text.isNotEmpty()) {
                        vm.sendMessage(conversationId, text)
                        input = ""
                    }
                }) {
                    Text("发送")
                }
            }
        }
    }
}

@Composable
private fun MessageBubble(
    message: Message,
    isMe: Boolean,
    showSenderName: Boolean
) {
    val bubbleColor = if (isMe) {
        MaterialTheme.colorScheme.primary
    } else {
        Color(0xFFE0E0E0)
    }
    val textColor = if (isMe) {
        MaterialTheme.colorScheme.onPrimary
    } else {
        MaterialTheme.colorScheme.onSurface
    }
    val senderName = message.sender?.displayName ?: message.sender?.username
    val avatarName = message.sender?.displayName ?: message.sender?.username
    val avatarUserId = message.sender?.id ?: message.senderId

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (isMe) Arrangement.End else Arrangement.Start,
        verticalAlignment = Alignment.Bottom
    ) {
        // 对方消息：头像在左侧
        if (!isMe) {
            Avatar(name = avatarName, userId = avatarUserId)
            Spacer(Modifier.width(8.dp))
        }

        Column(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(bubbleColor)
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            if (!isMe && showSenderName && !senderName.isNullOrBlank()) {
                Text(
                    senderName,
                    style = MaterialTheme.typography.labelSmall,
                    color = textColor.copy(alpha = 0.7f)
                )
                Spacer(Modifier.height(2.dp))
            }
            Text(
                message.content ?: "",
                color = textColor,
                style = MaterialTheme.typography.bodyLarge
            )
            Spacer(Modifier.height(2.dp))
            Text(
                DateTimeUtils.formatMessageTime(message.createdAt),
                style = MaterialTheme.typography.bodySmall,
                color = textColor.copy(alpha = 0.6f)
            )
        }

        // 自己消息：头像在右侧
        if (isMe) {
            Spacer(Modifier.width(8.dp))
            Avatar(name = avatarName, userId = avatarUserId)
        }
    }
}

/**
 * 文字头像：圆形背景色根据 userId 哈希，中间显示昵称首字。
 */
@Composable
fun Avatar(name: String?, userId: String?, size: Dp = 36.dp) {
    val initial = remember(name) {
        name?.trim()?.firstOrNull()?.uppercaseChar()?.toString() ?: "?"
    }
    val bgColor = remember(userId) { avatarColor(userId) }
    Box(
        modifier = Modifier
            .size(size)
            .clip(CircleShape)
            .background(bgColor),
        contentAlignment = Alignment.Center
    ) {
        Text(
            initial,
            color = Color.White,
            style = MaterialTheme.typography.labelMedium,
            fontWeight = FontWeight.Bold
        )
    }
}

private val AVATAR_COLORS = listOf(
    Color(0xFFE57373),
    Color(0xFF64B5F6),
    Color(0xFF81C784),
    Color(0xFFFFB74D),
    Color(0xFF9575CD),
    Color(0xFF4DB6AC),
    Color(0xFFF06292),
    Color(0xFF7986CB)
)

private fun avatarColor(userId: String?): Color {
    if (userId.isNullOrBlank()) return AVATAR_COLORS[0]
    val idx = (userId.hashCode() and 0x7FFFFFFF) % AVATAR_COLORS.size
    return AVATAR_COLORS[idx]
}
