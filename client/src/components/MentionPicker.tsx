import { UserAvatar } from './UserAvatar';

export interface MentionMember {
  id: string;
  name: string;
  username: string;
  avatar?: string | null;
}

interface Props {
  members: MentionMember[];
  activeIndex: number;
  onPick: (m: MentionMember) => void;
  onHover: (i: number) => void;
}

/**
 * @提及选择器：在输入框上方弹出群成员列表。
 * 键盘上下 / 回车由父组件 MessageInput 处理，这里只负责渲染与高亮。
 */
export function MentionPicker({ members, activeIndex, onPick, onHover }: Props) {
  if (members.length === 0) return null;
  return (
    <div className="mention-picker">
      <div className="mention-picker-title">选择要提醒的成员</div>
      {members.slice(0, 8).map((m, i) => (
        <button
          key={m.id}
          type="button"
          className={`mention-item ${i === activeIndex ? 'active' : ''}`}
          onMouseEnter={() => onHover(i)}
          onClick={() => onPick(m)}
        >
          <UserAvatar name={m.name || m.username} src={m.avatar ?? null} size={28} />
          <div className="mention-meta">
            <div className="mention-name">{m.name || m.username}</div>
            <div className="muted">@{m.username}</div>
          </div>
        </button>
      ))}
    </div>
  );
}

export default MentionPicker;
