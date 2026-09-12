interface Props {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
}

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🎉', '🔥'];

/**
 * 消息表情反应选择器：从消息操作菜单触发，点击即调用 reactions API。
 */
export function ReactionPicker({ onSelect, onClose }: Props) {
  return (
    <div className="reaction-picker">
      {QUICK_REACTIONS.map((e) => (
        <button
          key={e}
          type="button"
          className="reaction-picker-item"
          onClick={() => onSelect(e)}
        >
          {e}
        </button>
      ))}
      {onClose && (
        <button type="button" className="reaction-picker-item reaction-picker-close" onClick={onClose}>
          ✕
        </button>
      )}
    </div>
  );
}

export default ReactionPicker;
