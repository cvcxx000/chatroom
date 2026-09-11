import { useRef, useState } from 'react';
import { Spinner } from './Spinner';

interface Props {
  onSendText: (text: string) => Promise<void> | void;
  onSendImage?: (file: File) => Promise<void> | void;
  onSendFile?: (file: File) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  onTyping?: (isTyping: boolean) => void;
}

const EMOJIS = ['😀', '😂', '🤣', '😊', '😍', '👍', '🙏', '👏', '🔥', '🎉', '💯', '❤️', '😅', '😎', '🥳', '😭'];

export function MessageInput({
  onSendText,
  onSendImage,
  onSendFile,
  disabled,
  placeholder = '输入消息…',
  onTyping,
}: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const imgRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const typingTimer = useRef<number | null>(null);

  const triggerTyping = () => {
    onTyping?.(true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => onTyping?.(false), 1500);
  };

  const doSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy || disabled) return;
    setBusy(true);
    try {
      await onSendText(trimmed);
      setText('');
      onTyping?.(false);
    } finally {
      setBusy(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void doSend();
    }
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !onSendImage) return;
    setBusy(true);
    try {
      await onSendImage(f);
    } finally {
      setBusy(false);
      if (imgRef.current) imgRef.current.value = '';
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f || !onSendFile) return;
    setBusy(true);
    try {
      await onSendFile(f);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className={`msg-input ${disabled ? 'disabled' : ''}`}>
      <div className="msg-input-toolbar">
        {onSendImage && (
          <>
            <button
              type="button"
              className="icon-btn"
              title="发送图片"
              onClick={() => imgRef.current?.click()}
              disabled={disabled || busy}
            >
              🖼️
            </button>
            <input
              ref={imgRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImage}
              disabled={disabled || busy}
            />
          </>
        )}
        {onSendFile && (
          <>
            <button
              type="button"
              className="icon-btn"
              title="发送文件"
              onClick={() => fileRef.current?.click()}
              disabled={disabled || busy}
            >
              📎
            </button>
            <input
              ref={fileRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFile}
              disabled={disabled || busy}
            />
          </>
        )}
        <div className="emoji-wrap">
          <button
            type="button"
            className="icon-btn"
            title="表情"
            onClick={() => setShowEmoji((v) => !v)}
            disabled={disabled || busy}
          >
            😊
          </button>
          {showEmoji && (
            <div className="emoji-popover">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className="emoji-item"
                  onClick={() => {
                    setText((t) => t + e);
                    setShowEmoji(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <textarea
        className="msg-input-textarea"
        rows={3}
        placeholder={placeholder}
        value={text}
        disabled={disabled || busy}
        onChange={(e) => {
          setText(e.target.value);
          if (e.target.value) triggerTyping();
        }}
        onKeyDown={handleKey}
      />
      <div className="msg-input-send">
        <button
          type="button"
          className="btn btn-primary"
          onClick={doSend}
          disabled={disabled || busy || !text.trim()}
        >
          {busy ? <Spinner size={14} /> : null}
          发送
        </button>
      </div>
    </div>
  );
}
