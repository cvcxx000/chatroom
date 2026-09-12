import type { Conversation, ConversationSettings } from '../types';
import { formatTime } from '../utils/format';
import { UserAvatar } from './UserAvatar';
import { Badge } from './Badge';

interface Props {
  conversation: Conversation;
  active?: boolean;
  onClick: () => void;
  settings?: ConversationSettings;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function ConversationItem({ conversation, active, onClick, settings, onContextMenu }: Props) {
  const isGroup = conversation.type === 'group';
  const isAi = conversation.type === 'ai';
  const other = conversation.otherUser;
  const name = isGroup
    ? conversation.name || '群聊'
    : isAi
      ? conversation.name || 'AI 助手'
      : other
        ? other.displayName || other.display_name || other.username
        : '私聊';
  const last = conversation.lastMessage ?? conversation.last_message;
  const lastSender =
    last && last.sender ? last.sender.displayName || last.sender.display_name || last.sender.username : '';
  const preview = last
    ? last.messageType === 'image'
      ? `[图片]`
      : last.messageType === 'file'
        ? `[文件] ${last.fileName || last.file_name || ''}`.trim()
        : last.content
    : '暂无消息';

  const pinned = !!settings?.pinned;
  const muted = !!settings?.muted;
  const unread = conversation.unreadCount ?? conversation.unread_count ?? 0;

  return (
    <button
      className={`conv-item ${active ? 'active' : ''} ${pinned ? 'pinned' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
    >
      {isAi ? (
        <div className="user-avatar ai-bot" style={{ width: 44, height: 44 }}>
          🤖
        </div>
      ) : (
        <UserAvatar
          name={isGroup ? name : other?.username}
          src={isGroup ? null : other?.avatarUrl ?? other?.avatar_url ?? null}
          size={44}
        />
      )}
      <div className="conv-item-body">
        <div className="conv-item-line">
          {pinned && <span className="conv-pin" title="已置顶">📌</span>}
          <span className="conv-item-name">{name}</span>
          {isGroup && <Badge>群 {conversation.members?.length ?? 0}人</Badge>}
          {isAi && <Badge variant="warn">AI</Badge>}
          {muted && <span className="conv-mute" title="免打扰">🔕</span>}
          {last && <span className="conv-item-time">{formatTime(last.createdAt)}</span>}
        </div>
        <div className="conv-item-line">
          <span className="conv-item-preview">
            {lastSender ? `${lastSender}: ` : ''}
            {preview}
          </span>
          {unread > 0 && <span className="conv-unread">{unread > 99 ? '99+' : unread}</span>}
        </div>
      </div>
    </button>
  );
}
