import type { Conversation } from '../types';
import { formatTime } from '../utils/format';
import { UserAvatar } from './UserAvatar';
import { Badge } from './Badge';

interface Props {
  conversation: Conversation;
  active?: boolean;
  onClick: () => void;
}

export function ConversationItem({ conversation, active, onClick }: Props) {
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
      ? `[图片] ${last.content}`.trim()
      : last.messageType === 'file'
        ? `[文件] ${last.fileName || last.fileName || last.content}`
        : last.content
    : '暂无消息';

  return (
    <button className={`conv-item ${active ? 'active' : ''}`} onClick={onClick}>
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
          <span className="conv-item-name">{name}</span>
          {isGroup && <Badge>群 {conversation.members?.length ?? 0}人</Badge>}
          {isAi && <Badge variant="warn">AI</Badge>}
          {last && <span className="conv-item-time">{formatTime(last.createdAt)}</span>}
        </div>
        <div className="conv-item-line">
          <span className="conv-item-preview">
            {lastSender ? `${lastSender}: ` : ''}
            {preview}
          </span>
        </div>
      </div>
    </button>
  );
}
