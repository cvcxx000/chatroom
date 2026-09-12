import { query } from '../config/db';

export type UserStatusValue = 'online' | 'away' | 'busy' | 'offline';

export interface UserStatusRow {
  user_id: string;
  status: UserStatusValue;
  status_text: string | null;
  last_seen_at: Date;
  updated_at: Date;
}

export async function upsertUserStatus(
  userId: string,
  data: { status?: UserStatusValue; statusText?: string | null },
): Promise<UserStatusRow> {
  const res = await query<UserStatusRow>(
    `INSERT INTO user_status (user_id, status, status_text)
     VALUES ($1, COALESCE($2, 'offline'), $3)
     ON CONFLICT (user_id) DO UPDATE SET
       status = CASE WHEN $2 IS NULL THEN user_status.status ELSE $2 END,
       status_text = CASE WHEN $3 IS NULL THEN user_status.status_text ELSE $3 END,
       last_seen_at = now(),
       updated_at = now()
     RETURNING *`,
    [userId, data.status ?? null, data.statusText ?? null],
  );
  return res.rows[0];
}

export async function getUserStatus(userId: string): Promise<UserStatusRow | null> {
  const res = await query<UserStatusRow>(
    'SELECT * FROM user_status WHERE user_id = $1 LIMIT 1',
    [userId],
  );
  return res.rows[0] || null;
}

export async function touchLastSeen(userId: string): Promise<void> {
  await query(
    `INSERT INTO user_status (user_id, status, last_seen_at)
     VALUES ($1, 'offline', now())
     ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now(), updated_at = now()`,
    [userId],
  );
}
