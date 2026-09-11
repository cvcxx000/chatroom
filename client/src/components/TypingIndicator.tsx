interface Props {
  names?: string[];
}

export function TypingIndicator({ names = [] }: Props) {
  if (names.length === 0) return null;
  const label =
    names.length === 1
      ? `${names[0]} 正在输入`
      : names.length === 2
        ? `${names[0]} 和 ${names[1]} 正在输入`
        : '多人正在输入';
  return (
    <div className="typing-indicator">
      <span className="typing-dots" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="typing-label">{label}…</span>
    </div>
  );
}
