import { useEffect, useRef, useState } from 'react';

export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: string;
  danger?: boolean;
}

interface Props {
  x: number;
  y: number;
  title?: string;
  items: ActionMenuItem[];
  onSelect: (key: string) => void;
  onClose: () => void;
}

const MENU_WIDTH = 160;
const MENU_ITEM_HEIGHT = 38;

/**
 * 消息操作菜单：在 (x, y) 处弹出，点击遮罩或选择某项后关闭。
 * 自动根据视口边界做翻转，避免溢出屏幕。
 */
export function MessageActions({ x, y, title, items, onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useEffect(() => {
    const menuHeight = items.length * MENU_ITEM_HEIGHT + (title ? 34 : 0) + 16;
    let left = x;
    let top = y;
    if (left + MENU_WIDTH > window.innerWidth - 8) left = window.innerWidth - MENU_WIDTH - 8;
    if (top + menuHeight > window.innerHeight - 8) top = Math.max(8, top - menuHeight);
    if (left < 8) left = 8;
    if (top < 8) top = 8;
    setPos({ left, top });
  }, [x, y, items.length, title]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="ctx-overlay" onMouseDown={onClose} onTouchStart={onClose}>
      <div
        ref={ref}
        className="ctx-menu"
        style={{ left: pos.left, top: pos.top }}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
      >
        {title && <div className="ctx-menu-title">{title}</div>}
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            className={`ctx-menu-item ${it.danger ? 'danger' : ''}`}
            onClick={() => {
              onSelect(it.key);
              onClose();
            }}
          >
            {it.icon && <span className="ctx-menu-icon">{it.icon}</span>}
            <span>{it.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export default MessageActions;
