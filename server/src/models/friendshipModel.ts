import { query } from '../config/db';
import { Friendship, User } from './types';

export interface FriendshipWithUser extends Friendship {
  friend_username: string;
  friend_display_name: string | null;
  friend_avatar_url: string | null;
  friend_is_banned: boolean;
  friend_is_verified: boolean;
  friend_id_out: string;
}

/** Find a friendship row either direction between two users. */
export async function findFriendshipBetween(
  a: string,
  b: string,
): Promise<Friendship | null> {
  const res = await query<Friendship>(
    `SELECT * FROM friendships
     WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)
     LIMIT 1`,
    [a, b],
  );
  return res.rows[0] || null;
}

export async function getFriendshipById(id: number): Promise<Friendship | null> {
  const res = await query<Friendship>(
    'SELECT * FROM friendships WHERE id = $1 LIMIT 1',
    [id],
  );
  return res.rows[0] || null;
}

export async function createFriendRequest(
  requesterId: string,
  targetId: string,
): Promise<Friendship> {
  const res = await query<Friendship>(
    `INSERT INTO friendships (user_id, friend_id, status)
     VALUES ($1, $2, 'pending')
     RETURNING *`,
    [requesterId, targetId],
  );
  return res.rows[0];
}

export async function updateFriendshipStatus(
  id: number,
  status: Friendship['status'],
): Promise<void> {
  await query('UPDATE friendships SET status = $1 WHERE id = $2', [status, id]);
}

export async function deleteFriendship(id: number): Promise<void> {
  await query('DELETE FROM friendships WHERE id = $1', [id]);
}

export async function deleteFriendshipBetween(a: string, b: string): Promise<void> {
  await query(
    `DELETE FROM friendships
     WHERE (user_id = $1 AND friend_id = $2) OR (user_id = $2 AND friend_id = $1)`,
    [a, b],
  );
}

/** List accepted friends for a user (either direction). */
export async function listFriends(userId: string): Promise<User[]> {
  const res = await query<User>(
    `SELECT u.* FROM users u
     JOIN friendships f ON (f.user_id = u.id OR f.friend_id = u.id)
     WHERE (f.user_id = $1 OR f.friend_id = $1)
       AND f.status = 'accepted'
       AND u.id <> $1`,
    [userId],
  );
  return res.rows;
}

/** Pending requests where the user is the recipient. */
export async function listPendingRequests(userId: string): Promise<FriendshipWithUser[]> {
  const res = await query<FriendshipWithUser>(
    `SELECT f.*,
            u.username AS friend_username,
            u.display_name AS friend_display_name,
            u.avatar_url AS friend_avatar_url,
            u.is_banned AS friend_is_banned,
            u.is_verified AS friend_is_verified,
            f.user_id AS friend_id_out
     FROM friendships f
     JOIN users u ON u.id = f.user_id
     WHERE f.friend_id = $1 AND f.status = 'pending'
     ORDER BY f.created_at DESC`,
    [userId],
  );
  return res.rows;
}
