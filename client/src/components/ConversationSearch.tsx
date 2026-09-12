interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function ConversationSearch({ value, onChange }: Props) {
  return (
    <div className="conv-search">
      <span className="conv-search-icon">🔍</span>
      <input
        type="text"
        placeholder="搜索会话…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button className="icon-btn conv-search-clear" onClick={() => onChange('')} aria-label="清除">
          ×
        </button>
      )}
    </div>
  );
}
