import { useState } from 'react';
import type { Message, TempMessage } from '../types';
import { formatBytes, formatTime } from '../utils/format';
import { UserAvatar } from './UserAvatar';
import { ImagePreview } from './ImagePreview';
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
  const { isMine, senderName, senderAvatar, showSender, createdAt, isTemp, expiresAt, isAi } = props;
  const f = resolveFields(props);
  const [previewOpen, setPreviewOpen] = useState(false);

  const cls = [
    'msg-row',
    isMine ? 'mine' : 'theirs',
    isTemp ? 'temp' : '',
    isAi ? 'ai-msg' : '',
  ].join(' ');

  return (
    <div className={cls}>
      {!isMine && (
        <div className="msg-avatar">
          {isAi ? (
            <div className="user-avatar ai-bot" style={{ width: 36, height: 36 }}>
              🤖
            </div>
          ) : (
            <UserAvatar name={senderName || '?'} src={senderAvatar} size={36} />
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
        <div className={`bubble ${f.messageType !== 'text' ? 'bubble-file' : ''}`}>
          {f.messageType === 'image' && f.fileUrl ? (
            <>
              <img
                className="bubble-image"
                src={f.fileUrl}
                alt={f.fileName || 'image'}
                onClick={() => setPreviewOpen(true)}
              />
              {f.content ? <div className="bubble-text">{f.content}</div> : null}
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
              <div className="file-icon">📎</div>
              <div className="file-meta">
                <div className="file-name" title={f.fileName || ''}>
                  {f.fileName || '文件'}
                </div>
                <div className="file-size">{formatBytes(f.fileSize)}</div>
              </div>
              <div className="file-dl">下载</div>
            </a>
          ) : (
            <div className="bubble-text">{f.content}</div>
          )}
          <div className="bubble-meta">
            {isTemp && expiresAt ? (
              <CountdownTimer expiresAt={expiresAt} className="bubble-countdown" />
            ) : null}
            <span className="bubble-time">{formatTime(createdAt)}</span>
          </div>
        </div>
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
