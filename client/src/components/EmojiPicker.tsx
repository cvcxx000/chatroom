import { useState } from 'react';

interface EmojiCategory {
  name: string;
  icon: string;
  emojis: string[];
}

const CATEGORIES: EmojiCategory[] = [
  {
    name: '笑脸',
    icon: '😀',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
      '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣', '😖',
    ],
  },
  {
    name: '手势',
    icon: '👋',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞',
      '🤑', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️',
      '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲',
      '🙏', '💪', '🖐', '👋🏻', '🤝', '✍️', '💅', '👋🏽', '🤞🏻', '✌🏻',
    ],
  },
  {
    name: '动物',
    icon: '🐶',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯',
      '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐔', '🐧',
      '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄',
      '🐝', '🐛', '🦋', '🐌', '🐞', '🐢', '🐍', '🦎', '🐙', '🦑',
    ],
  },
  {
    name: '食物',
    icon: '🍎',
    emojis: [
      '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈',
      '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍆', '🥔',
      '🥕', '🌽', '🌶️', '🥒', '🥬', '🥦', '🍄', '🍞', '🥐', '🥖',
      '🥨', '🥯', '🥞', '🧇', '🧀', '🍖', '🍗', '🥩', '🥓', '🍔',
    ],
  },
  {
    name: '活动',
    icon: '⚽',
    emojis: [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
      '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️',
      '🥌', '🎿', '⛷️', '🏂', '🏋️', '🤸', '⛹️', '🤺', '🤾', '🏌️',
    ],
  },
  {
    name: '符号',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💯', '💢',
      '💥', '💫', '💦', '💨', '🕳️', '💬', '💭', '🗯️', '♨️', '💤',
      '✅', '❌', '✔️', '❎', '➕', '➖', '➗', '✖️', '🆗', '🔔',
    ],
  },
  {
    name: '物品',
    icon: '💡',
    emojis: [
      '⌚', '📱', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '💽',
      '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📞', '☎️',
      '📟', '📠', '📺', '📻', '🧭', '⏰', '⏱️', '⏲️', '🕰️', '⌛',
      '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🧯', '🛢️', '💸',
    ],
  },
];

interface Props {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
}

export function EmojiPicker({ onSelect, onClose }: Props) {
  const [active, setActive] = useState(0);
  const cat = CATEGORIES[active];

  return (
    <div className="emoji-picker">
      <div className="emoji-picker-grid">
        {cat.emojis.map((e, i) => (
          <button
            key={`${e}-${i}`}
            type="button"
            className="emoji-item"
            onClick={() => {
              onSelect(e);
            }}
          >
            {e}
          </button>
        ))}
      </div>
      <div className="emoji-picker-tabs">
        {CATEGORIES.map((c, i) => (
          <button
            key={c.name}
            type="button"
            className={`emoji-picker-tab ${i === active ? 'active' : ''}`}
            title={c.name}
            onClick={() => setActive(i)}
          >
            {c.icon}
          </button>
        ))}
        {onClose && (
          <button type="button" className="emoji-picker-tab" title="关闭" onClick={onClose}>
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default EmojiPicker;
