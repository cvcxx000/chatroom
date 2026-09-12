import { useEffect, useRef } from 'react';
import type { Message } from '../types';
import { formatTime } from '../utils/format';

interface Props {
  open: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  results: Message[];
  searching: boolean;
  onJump: (m: Message) => void;
  onClose: () => void;
}

/**
 * 消息搜索面板：在聊天区右侧滑出，输入关键词后展示当前会话的命中消息。
 * 数据请求由父组件（MainChat）负责，这里只做展示与跳转。
 */
export function MessageSearch({
  open,
  query,
  onQueryChange,
  results,
  searching,
  onJump,
  onClose,
}: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      // 自动聚焦，移动端弹起键盘
      window.setTimeout(() => inputRef.current?.focus(), 60);
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="msg-search-panel">
      <div className="msg-search-header">
        <input
          ref={inputRef}
          className="msg-search-input"
          placeholder="搜索当前会话消息…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <button type="button" className="icon-btn" onClick={onClose} title="关闭搜索">
          ✕
        </button>
      </div>
      <div className="msg-search-body">
        {searching && <div className="empty-list">搜索中…</div>}
        {!searching && query.trim() && results.length === 0 && (
          <div className="empty-list">没有找到匹配「{query}」的消息</div>
        )}
        {!searching && !query.trim() && (
          <div className="empty-list">输入关键词开始搜索</div>
        )}
        {!searching &&
          results.map((m) => {
            const name =
              m.sender?.displayName || m.sender?.display_name || m.sender?.username || '未知';
            return (
              <button
                key={m.id}
                type="button"
                className="msg-search-item"
                onClick={() => onJump(m)}
              >
                <div className="msg-search-item-head">
                  <span className="msg-search-item-name">{name}</span>
                  <span className="msg-search-item-time">{formatTime(m.createdAt)}</span>
                </div>
                <div className="msg-search-item-content">{m.content}</div>
              </button>
            );
          })}
      </div>
    </div>
  );
}

export default MessageSearch;
