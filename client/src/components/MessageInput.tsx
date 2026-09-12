import { useEffect, useRef, useState } from 'react';
import { EmojiPicker } from './EmojiPicker';
import { MentionPicker, type MentionMember } from './MentionPicker';
import { Spinner } from './Spinner';
import type { QuickReply } from '../types';

export interface ReplyContext {
  senderName?: string;
  preview: string;
}

interface Props {
  onSendText: (text: string) => Promise<void> | void;
  onSendImage?: (file: File) => Promise<void> | void;
  onSendFile?: (file: File) => Promise<void> | void;
  disabled?: boolean;
  placeholder?: string;
  onTyping?: (isTyping: boolean) => void;
  // ---- 新增能力 ----
  replyTo?: ReplyContext | null;
  onCancelReply?: () => void;
  /** 非空时进入编辑模式，textarea 预填该内容，发送走 onFinishEdit */
  editContent?: string | null;
  onFinishEdit?: (content: string) => void;
  /** 群成员列表，用于 @提及 */
  members?: MentionMember[];
  enableMention?: boolean;
  /** true=Enter 发送 / Shift+Enter 换行；false=Enter 换行 */
  enterToSend?: boolean;
  /** 快捷回复列表，传入后显示快捷回复按钮 */
  quickReplies?: QuickReply[];
  /** 语音按钮占位提示（如“按住说话”） */
  onVoicePlaceholder?: () => void;
}

export function MessageInput({
  onSendText,
  onSendImage,
  onSendFile,
  disabled,
  placeholder = '输入消息…',
  onTyping,
  replyTo,
  onCancelReply,
  editContent,
  onFinishEdit,
  members = [],
  enableMention = false,
  enterToSend = true,
  quickReplies = [],
  onVoicePlaceholder,
}: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showQuick, setShowQuick] = useState(false);
  // @提及状态
  const [mentionIndex, setMentionIndex] = useState(-1);
  const imgRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimer = useRef<number | null>(null);

  const editing = typeof editContent === 'string' && editContent !== null;

  // 进入编辑模式时预填内容
  useEffect(() => {
    if (editing) {
      setText(editContent);
      window.setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.setSelectionRange(ta.value.length, ta.value.length);
        }
      }, 30);
    }
  }, [editing, editContent]);

  // ---------- @提及解析 ----------
  // 根据光标前文本，判断当前是否处于 @xxx 输入中
  const parseMention = (value: string, caret: number) => {
    if (!enableMention) return null;
    const before = value.slice(0, caret);
    const at = before.lastIndexOf('@');
    if (at === -1) return null;
    // @ 之前必须是行首或空白，避免匹配邮箱等场景
    if (at > 0 && !/\s/.test(before[at - 1])) return null;
    const token = before.slice(at + 1);
    if (/\s/.test(token)) return null; // 已空格结束
    return { at, query: token };
  };

  const mentionState = (() => {
    if (!textareaRef.current) return null;
    const caret = textareaRef.current.selectionStart ?? text.length;
    return parseMention(text, caret);
  })();

  const filteredMembers: MentionMember[] = mentionState
    ? members.filter((m) => {
        const q = mentionState.query.toLowerCase();
        if (!q) return true;
        return (
          m.username.toLowerCase().includes(q) ||
          (m.name || '').toLowerCase().includes(q)
        );
      })
    : [];

  const mentionOpen = !!mentionState && enableMention;

  const applyMention = (m: MentionMember) => {
    if (!mentionState) return;
    const caret = textareaRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, mentionState.at);
    const after = text.slice(caret);
    const inserted = `@${m.username} `;
    const next = before + inserted + after;
    setText(next);
    setMentionIndex(-1);
    window.setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        const pos = before.length + inserted.length;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      }
    }, 0);
  };

  const triggerTyping = () => {
    onTyping?.(true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => onTyping?.(false), 1500);
  };

  const doSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || busy || disabled) return;
    if (editing && onFinishEdit) {
      onFinishEdit(trimmed);
      setText('');
      setBusy(false);
      return;
    }
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
    // 提及面板打开时，先处理键盘导航
    if (mentionOpen && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex((i) => (i - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        applyMention(filteredMembers[mentionIndex >= 0 ? mentionIndex : 0]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionIndex(-1);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && enterToSend) {
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
      {/* 回复 / 编辑预览条 */}
      {(replyTo || editing) && (
        <div className="input-context-bar">
          <div className="input-context-meta">
            {editing ? (
              <>
                <span className="input-context-tag">编辑消息</span>
                <span className="muted">5 分钟内可重新编辑</span>
              </>
            ) : (
              <>
                <span className="input-context-tag">回复 {replyTo?.senderName || ''}</span>
                <span className="input-context-preview">{replyTo?.preview || ''}</span>
              </>
            )}
          </div>
          <button
            type="button"
            className="icon-btn"
            onClick={() => {
              if (editing) {
                onCancelReply?.();
                setText('');
              } else {
                onCancelReply?.();
              }
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* @提及面板 */}
      {mentionOpen && filteredMembers.length > 0 && (
        <MentionPicker
          members={filteredMembers}
          activeIndex={mentionIndex}
          onPick={applyMention}
          onHover={setMentionIndex}
        />
      )}

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
            <EmojiPicker
              onSelect={(e) => {
                setText((t) => t + e);
              }}
              onClose={() => setShowEmoji(false)}
            />
          )}
        </div>
        {quickReplies.length > 0 && (
          <div className="emoji-wrap">
            <button
              type="button"
              className="icon-btn"
              title="快捷回复"
              onClick={() => setShowQuick((v) => !v)}
              disabled={disabled || busy}
            >
              💬
            </button>
            {showQuick && (
              <div className="quickreply-popover">
                {quickReplies.map((q) => (
                  <button
                    key={q.id}
                    type="button"
                    className="quickreply-item"
                    onClick={() => {
                      setText((t) => t + q.content);
                      setShowQuick(false);
                      textareaRef.current?.focus();
                    }}
                  >
                    {q.title && <span className="quickreply-title">{q.title}</span>}
                    <span className="quickreply-content">{q.content}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {onVoicePlaceholder && (
          <button
            type="button"
            className="icon-btn"
            title="语音"
            onMouseDown={onVoicePlaceholder}
            onTouchStart={onVoicePlaceholder}
            disabled={disabled || busy}
          >
            🎤
          </button>
        )}
      </div>
      <textarea
        ref={textareaRef}
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
          {editing ? '保存' : '发送'}
        </button>
      </div>
    </div>
  );
}
