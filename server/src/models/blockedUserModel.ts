import { query } from '../config/db';

export interface BlockedUser {
  id: string;
  user_id: string;
  blocked_user_id: string;
  created_at: Date;
}

export async function blockUser(userId: string, blockedUserId: string): Promise<BlockedUser> {
  const res = await query<BlockedUser>(
    `INSERT INTO blocked_users (user_id, blocked_user_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, blocked_user_id) DO NOTHING
     RETURNING *`,
    [userId, blockedUserId],
  );
  if (res.rows[0]) return res.rows[0];
  const existing = await query<BlockedUser>(
    'SELECT * FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2 LIMIT 1',
    [userId, blockedUserId],
  );
  return existing.rows[0];
}

export async function unblockUser(userId: string, blockedUserId: string): Promise<void> {
  await query(
    'DELETE FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2',
    [userId, blockedUserId],
  );
}

export async function listBlockedUsers(userId: string): Promise<BlockedUser[]> {
  const res = await query<BlockedUser>(
    'SELECT * FROM blocked_users WHERE user_id = $1 ORDER BY created_at DESC',
    [userId],
  );
  return res.rows;
}

export async function isBlocked(userId: string, blockedUserId: string): Promise<boolean> {
  const res = await query(
    'SELECT 1 FROM blocked_users WHERE user_id = $1 AND blocked_user_id = $2 LIMIT 1',
    [userId, blockedUserId],
  );
  return res.rows.length > 0;
}
