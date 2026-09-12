import { query } from '../config/db';

export interface GroupNickname {
  id: string;
  conversation_id: string;
  user_id: string;
  nickname: string;
}

export async function setGroupNickname(
  conversationId: string,
  userId: string,
  nickname: string,
): Promise<GroupNickname> {
  const res = await query<GroupNickname>(
    `INSERT INTO group_nicknames (conversation_id, user_id, nickname)
     VALUES ($1, $2, $3)
     ON CONFLICT (conversation_id, user_id) DO UPDATE SET nickname = EXCLUDED.nickname
     RETURNING *`,
    [conversationId, userId, nickname],
  );
  return res.rows[0];
}

export async function getGroupNickname(
  conversationId: string,
  userId: string,
): Promise<GroupNickname | null> {
  const res = await query<GroupNickname>(
    'SELECT * FROM group_nicknames WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
    [conversationId, userId],
  );
  return res.rows[0] || null;
}

export async function getGroupNicknames(
  conversationId: string,
): Promise<GroupNickname[]> {
  const res = await query<GroupNickname>(
    'SELECT * FROM group_nicknames WHERE conversation_id = $1',
    [conversationId],
  );
  return res.rows;
}
