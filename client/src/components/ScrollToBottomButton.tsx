interface Props {
  visible: boolean;
  unreadCount?: number;
  onClick: () => void;
}

/**
 * 滚动到底部浮动按钮：消息列表不在底部时显示，
 * 点击平滑滚动到底部，并附带未读消息数角标。
 */
export function ScrollToBottomButton({ visible, unreadCount = 0, onClick }: Props) {
  if (!visible) return null;
  return (
    <button type="button" className="scroll-bottom-btn" onClick={onClick} title="回到底部">
      {unreadCount > 0 ? (
        <span className="scroll-bottom-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
      ) : null}
      <span aria-hidden="true">↓</span>
    </button>
  );
}

export default ScrollToBottomButton;
