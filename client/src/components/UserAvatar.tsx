import { initialOf } from '../utils/format';

interface Props {
  name?: string | null;
  src?: string | null;
  size?: number;
  className?: string;
}

const PALETTE = [
  '#4f6ef7', '#00a884', '#e06c75', '#c678dd', '#d19a66',
  '#56b6c2', '#e5c07b', '#61afef', '#98c379', '#e86a92',
];

export function UserAvatar({ name, src, size = 40, className = '' }: Props) {
  const initial = initialOf(name);
  const idx = (name || '?').charCodeAt(0) % PALETTE.length;
  const bg = PALETTE[idx];
  const style: React.CSSProperties = { width: size, height: size, background: bg };
  if (src) {
    return (
      <img
        src={src}
        alt={name || 'avatar'}
        className={`user-avatar ${className}`}
        style={style}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    );
  }
  return (
    <div className={`user-avatar placeholder ${className}`} style={style} aria-hidden>
      {initial}
    </div>
  );
}
