import { query } from '../config/db';
import { User, toSafeUser, SafeUser } from './types';

export { toSafeUser, SafeUser };

export async function findUserByUsername(username: string): Promise<User | null> {
  const res = await query<User>(
    'SELECT * FROM users WHERE username = $1 LIMIT 1',
    [username],
  );
  return res.rows[0] || null;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const res = await query<User>(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
    [email],
  );
  return res.rows[0] || null;
}

export async function findUserById(id: string): Promise<User | null> {
  const res = await query<User>('SELECT * FROM users WHERE id = $1 LIMIT 1', [id]);
  return res.rows[0] || null;
}

export async function createUser(data: {
  username: string;
  email: string | null;
  passwordHash: string;
  displayName: string | null;
  isAdmin?: boolean;
  isVerified?: boolean;
}): Promise<User> {
  const res = await query<User>(
    `INSERT INTO users (username, email, password_hash, display_name, is_admin, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.username,
      data.email,
      data.passwordHash,
      data.displayName || data.username,
      data.isAdmin ? true : false,
      data.isVerified ? true : false,
    ],
  );
  return res.rows[0];
}

export async function updateLastLogin(id: string): Promise<void> {
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
}

export async function updateProfile(
  id: string,
  data: { displayName?: string; avatarUrl?: string },
): Promise<User | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (data.displayName !== undefined) {
    fields.push(`display_name = $${i++}`);
    params.push(data.displayName);
  }
  if (data.avatarUrl !== undefined) {
    fields.push(`avatar_url = $${i++}`);
    params.push(data.avatarUrl);
  }
  if (fields.length === 0) return findUserById(id);
  params.push(id);
  const res = await query<User>(
    `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

export async function setBanned(id: string, banned: boolean): Promise<void> {
  await query('UPDATE users SET is_banned = $1 WHERE id = $2', [banned, id]);
}

export async function setVerified(id: string, verified: boolean): Promise<void> {
  await query('UPDATE users SET is_verified = $1 WHERE id = $2', [verified, id]);
}

export async function countAdmins(): Promise<number> {
  const res = await query<{ count: string }>(
    'SELECT COUNT(*)::int AS count FROM users WHERE is_admin = TRUE',
  );
  return parseInt(res.rows[0]?.count || '0', 10);
}

export async function searchUsers(q: string, limit = 20): Promise<User[]> {
  const pattern = `%${q}%`;
  const res = await query<User>(
    `SELECT * FROM users
     WHERE username ILIKE $1 OR email ILIKE $1 OR display_name ILIKE $1
     ORDER BY username ASC
     LIMIT $2`,
    [pattern, limit],
  );
  return res.rows;
}

export interface AdminUserList {
  users: User[];
  total: number;
}

export async function listUsers(
  page: number,
  pageSize: number,
  search?: string,
): Promise<AdminUserList> {
  const offset = (page - 1) * pageSize;
  const where: string[] = [];
  const params: unknown[] = [];
  if (search) {
    params.push(`%${search}%`);
    where.push(`(username ILIKE $${params.length} OR email ILIKE $${params.length} OR display_name ILIKE $${params.length})`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const countRes = await query<{ count: string }>(
    `SELECT COUNT(*)::int AS count FROM users ${whereSql}`,
    params,
  );
  params.push(pageSize, offset);
  const res = await query<User>(
    `SELECT * FROM users ${whereSql} ORDER BY created_at ASC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return { users: res.rows, total: parseInt(countRes.rows[0]?.count || '0', 10) };
}

export async function countUsers(): Promise<number> {
  const res = await query<{ count: string }>('SELECT COUNT(*)::int AS count FROM users');
  return parseInt(res.rows[0]?.count || '0', 10);
}
