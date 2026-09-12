import { query } from '../config/db';

export interface LoginHistory {
  id: string;
  user_id: string;
  ip_address: string | null;
  user_agent: string | null;
  device_type: string | null;
  location: string | null;
  login_at: Date;
}

export async function createLoginHistory(
  userId: string,
  data: {
    ipAddress?: string | null;
    userAgent?: string | null;
    deviceType?: string | null;
    location?: string | null;
  },
): Promise<LoginHistory> {
  const res = await query<LoginHistory>(
    `INSERT INTO login_history (user_id, ip_address, user_agent, device_type, location)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [userId, data.ipAddress ?? null, data.userAgent ?? null, data.deviceType ?? null, data.location ?? null],
  );
  return res.rows[0];
}

export async function listLoginHistory(
  userId: string,
  limit = 20,
): Promise<LoginHistory[]> {
  const res = await query<LoginHistory>(
    'SELECT * FROM login_history WHERE user_id = $1 ORDER BY login_at DESC LIMIT $2',
    [userId, limit],
  );
  return res.rows;
}

/** Best-effort device type guess from a User-Agent string. */
export function detectDeviceType(userAgent?: string | null): string | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipad|ipod/.test(ua)) return /ipad|tablet/.test(ua) ? 'tablet' : 'mobile';
  if (/windows|macintosh|mac os|linux|x11/.test(ua)) return 'desktop';
  return 'unknown';
}
