import { initialOf } from '../utils/format';
import type { UserStatusType } from '../types';

interface Props {
  name?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
  status?: UserStatusType | null;
  onClick?: () => void;
}

const PALETTE = [
  '#4f6ef7', '#00a884', '#e06c75', '#c678dd', '#d19a66',
  '#56b6c2', '#e5c07b', '#61afef', '#98c379', '#e86a92',
];

export function UserAvatar({ name, src, size = 40, className = '', status, onClick }: Props) {
  const initial = initialOf(name);
  const idx = (name || '?').charCodeAt(0) % PALETTE.length;
  const bg = PALETTE[idx];
  const style: React.CSSProperties = { width: size, height: size, background: bg };

  const avatar = src ? (
    <img
      src={src}
      alt={name || 'avatar'}
      className={`user-avatar ${className}`}
      style={style}
      onClick={onClick}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).style.display = 'none';
      }}
    />
  ) : (
    <div
      className={`user-avatar placeholder ${className}`}
      style={style}
      aria-hidden
      onClick={onClick}
    >
      {initial}
    </div>
  );

  if (!status && !onClick) return avatar;

  return (
    <span className="avatar-wrap" onClick={onClick}>
      {avatar}
      {status && <span className={`status-dot status-${status}`} />}
    </span>
  );
}
