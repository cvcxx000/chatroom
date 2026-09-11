import { useEffect, useState } from 'react';

interface Props {
  expiresAt: string | number | Date;
  onExpire?: () => void;
  className?: string;
}

function toMs(expiresAt: string | number | Date): number {
  if (typeof expiresAt === 'number') return expiresAt;
  return new Date(expiresAt).getTime();
}

export function CountdownTimer({ expiresAt, onExpire, className = '' }: Props) {
  const target = toMs(expiresAt);
  const [remaining, setRemaining] = useState<number>(Math.max(0, target - Date.now()));

  useEffect(() => {
    setRemaining(Math.max(0, target - Date.now()));
    const t = window.setInterval(() => {
      const left = Math.max(0, target - Date.now());
      setRemaining(left);
      if (left <= 0) {
        window.clearInterval(t);
        onExpire?.();
      }
    }, 250);
    return () => window.clearInterval(t);
  }, [target, onExpire]);

  const totalSec = Math.max(0, Math.ceil(remaining / 1000));
  const mm = Math.floor(totalSec / 60);
  const ss = totalSec % 60;
  const pct = Math.max(0, Math.min(1, remaining / 120000)); // 2 min window
  const danger = totalSec <= 15;

  return (
    <span className={`countdown ${danger ? 'countdown-danger' : ''} ${className}`} title="消息过期时间">
      <span className="countdown-bar" style={{ width: `${Math.round(pct * 100)}%` }} />
      <span className="countdown-text">
        {mm}:{String(ss).padStart(2, '0')}
      </span>
    </span>
  );
}
