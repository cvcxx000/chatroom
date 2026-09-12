import { useRef, useState } from 'react';
import type { Message, MessageReaction, MessageReplyRef, TempMessage, User } from '../types';
import { formatBytes, formatTime } from '../utils/format';
import { renderMarkdown } from '../utils/markdown';
import { UserAvatar } from './UserAvatar';
import { ImagePreview } from './ImagePreview';
import { FileIcon } from './FileIcon';
import { CountdownTimer } from './CountdownTimer';

interface BaseProps {
  isMine: boolean;
  senderName?: string;
  senderAvatar?: string | null;
  showSender?: boolean;
  createdAt: string;
  isTemp?: boolean;
  expiresAt?: string;
  isAi?: boolean;
  // ---- 新增能力（仅普通消息使用）----
  reactions?: MessageReaction[] | null;
  replyTo?: MessageReplyRef | null;
  isEdited?: boolean;
  isPinned?: boolean;
  /** 右键 / 长按触发操作菜单，事件对象用于定位菜单位置 */
  onActions?: (e: React.MouseEvent | React.TouchEvent) => void;
  /** 点击已有反应表情（切换该反应） */
  onReactClick?: (emoji: string) => void;
  /** 点击发送者头像弹出资料卡 */
  onAvatarClick?: (user: User) => void;
}

interface MsgProps extends BaseProps {
  kind: 'message';
  message: Message;
}

interface TempProps extends BaseProps {
  kind: 'temp';
  message: TempMessage;
}

type Props = MsgProps | TempProps;

function resolveFields(props: Props) {
  if (props.kind === 'message') {
    const m = props.message;
    return {
      content: m.content || '',
      messageType: m.messageType ?? m.message_type ?? 'text',
      fileUrl: m.fileUrl ?? m.file_url ?? null,
      fileName: m.fileName ?? m.file_name ?? null,
      fileSize: m.fileSize ?? m.file_size ?? null,
    };
  }
  return {
    content: props.message.content || '',
    messageType: 'text' as const,
    fileUrl: null as string | null,
    fileName: null as string | null,
    fileSize: null as number | null,
  };
}

export function MessageBubble(props: Props) {
  const {
    isMine,
    senderName,
    senderAvatar,
    showSender,
    createdAt,
    isTemp,
    expiresAt,
    isAi,
    reactions,
    replyTo,
    isEdited,
    isPinned,
    onActions,
    onReactClick,
    onAvatarClick,
  } = props;
  const f = resolveFields(props);
  const [previewOpen, setPreviewOpen] = useState(false);
  const longPressTimer = useRef<number | null>(null);

  const senderUser: User | undefined =
    props.kind === 'message' ? props.message.sender : props.message.sender;

  const cls = [
    'msg-row',
    isMine ? 'mine' : 'theirs',
    isTemp ? 'temp' : '',
    isAi ? 'ai-msg' : '',
    isPinned ? 'pinned' : '',
    onActions ? 'has-actions' : '',
  ].join(' ');

  // 长按（移动端）触发操作菜单
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!onActions) return;
    longPressTimer.current = window.setTimeout(() => {
      onActions(e);
    }, 500);
  };
  const clearLongPress = () => {
    if (longPressTimer.current) {
      window.clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const replyName =
    replyTo?.senderName || replyTo?.sender_name || (replyTo as any)?.sender?.username || '对方';
  const replyPreview = (replyTo?.content || '').slice(0, 80);

  return (
    <div
      className={cls}
      onContextMenu={
        onActions
          ? (e) => {
              e.preventDefault();
              onActions(e);
            }
          : undefined
      }
      onTouchStart={onActions ? handleTouchStart : undefined}
      onTouchEnd={onActions ? clearLongPress : undefined}
      onTouchMove={onActions ? clearLongPress : undefined}
    >
      {!isMine && (
        <div className="msg-avatar">
          {isAi ? (
            <div className="user-avatar ai-bot" style={{ width: 36, height: 36 }}>
              🤖
            </div>
          ) : (
            <UserAvatar
              name={senderName || '?'}
              src={senderAvatar}
              size={36}
              onClick={
                onAvatarClick && senderUser
                  ? () => onAvatarClick(senderUser)
                  : undefined
              }
            />
          )}
        </div>
      )}
      <div className="msg-body">
        {isAi && (
          <div className="msg-sender">
            <span className="ai-tag">AI</span>
          </div>
        )}
        {showSender && !isMine && !isAi && senderName && (
          <div className="msg-sender">{senderName}</div>
        )}
        {isPinned && (
          <div className="pinned-tag">📌 置顶消息</div>
        )}
        <div className={`bubble ${f.messageType !== 'text' ? 'bubble-file' : ''}`}>
          {replyTo && (
            <div className="bubble-reply-ref">
              <div className="bubble-reply-name">{replyName}</div>
              <div className="bubble-reply-preview">{replyPreview || ' '}</div>
            </div>
          )}
          {f.messageType === 'image' && f.fileUrl ? (
            <>
              <img
                className="bubble-image"
                src={f.fileUrl}
                alt={f.fileName || 'image'}
                onClick={() => setPreviewOpen(true)}
              />
              {f.content ? (
                <div className="bubble-text md-body">{renderMarkdown(f.content)}</div>
              ) : null}
            </>
          ) : f.messageType === 'file' && f.fileUrl ? (
            <a
              className="file-card"
              href={f.fileUrl}
              target="_blank"
              rel="noreferrer"
              download={f.fileName || undefined}
              onClick={(e) => e.stopPropagation()}
            >
              <FileIcon fileName={f.fileName} size={40} />
              <div className="file-meta">
                <div className="file-name" title={f.fileName || ''}>
                  {f.fileName || '文件'}
                </div>
                <div className="file-size">{formatBytes(f.fileSize)}</div>
              </div>
              <div className="file-dl">下载</div>
            </a>
          ) : (
            <div className="bubble-text md-body">{renderMarkdown(f.content)}</div>
          )}
          <div className="bubble-meta">
            {isTemp && expiresAt ? (
              <CountdownTimer expiresAt={expiresAt} className="bubble-countdown" />
            ) : null}
            {isEdited && <span className="bubble-edited">已编辑</span>}
            <span className="bubble-time">{formatTime(createdAt)}</span>
          </div>
        </div>
        {reactions && reactions.length > 0 && (
          <div className="bubble-reactions">
            {reactions.map((r) => (
              <button
                key={r.emoji}
                type="button"
                className={`reaction-chip ${r.mine ? 'mine' : ''}`}
                onClick={() => onReactClick?.(r.emoji)}
              >
                <span className="reaction-chip-emoji">{r.emoji}</span>
                {typeof r.count === 'number' && r.count > 0 && (
                  <span className="reaction-chip-count">{r.count}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      {previewOpen && (
        <ImagePreview
          open={previewOpen}
          src={f.fileUrl!}
          alt={f.fileName || 'image'}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </div>
  );
}
