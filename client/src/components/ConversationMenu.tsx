import { useEffect, useRef } from 'react';
import type { ConversationSettings } from '../types';

interface Props {
  x: number;
  y: number;
  settings?: ConversationSettings;
  onClose: () => void;
  onPin: () => void;
  onMute: () => void;
  onArchive: () => void;
  onMarkRead: () => void;
  onMarkUnread: () => void;
  onClear: () => void;
  onDelete: () => void;
}

export function ConversationMenu({
  x,
  y,
  settings,
  onClose,
  onPin,
  onMute,
  onArchive,
  onMarkRead,
  onMarkUnread,
  onClear,
  onDelete,
}: Props) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // keep menu within viewport
  const left = Math.min(x, window.innerWidth - 220);
  const top = Math.min(y, window.innerHeight - 380);

  const pinned = !!settings?.pinned;
  const muted = !!settings?.muted;
  const archived = !!settings?.archived;

  const items: Array<{ icon: string; label: string; onClick: () => void; danger?: boolean }> = [
    { icon: pinned ? '📌' : '📍', label: pinned ? '取消置顶' : '置顶会话', onClick: onPin },
    { icon: muted ? '🔔' : '🔕', label: muted ? '取消免打扰' : '消息免打扰', onClick: onMute },
    { icon: archived ? '📥' : '🗂️', label: archived ? '取消归档' : '归档会话', onClick: onArchive },
    { icon: '✓', label: '标记已读', onClick: onMarkRead },
    { icon: '◉', label: '标记未读', onClick: onMarkUnread },
    { icon: '🧹', label: '清空聊天记录', onClick: onClear, danger: true },
    { icon: '🗑️', label: '删除会话', onClick: onDelete, danger: true },
  ];

  return (
    <div
      ref={ref}
      className="conv-context-menu"
      style={{ left, top }}
      role="menu"
    >
      {items.map((it) => (
        <button
          key={it.label}
          className={`conv-menu-item ${it.danger ? 'danger' : ''}`}
          onClick={() => {
            it.onClick();
            onClose();
          }}
        >
          <span className="conv-menu-icon">{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}
