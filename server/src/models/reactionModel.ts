import { query } from '../config/db';

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: Date;
}

/** Toggle a reaction for a user on a message. Returns true if added, false if removed. */
export async function toggleReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<{ added: boolean; reaction: MessageReaction | null }> {
  const existing = await query<MessageReaction>(
    'SELECT * FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3 LIMIT 1',
    [messageId, userId, emoji],
  );
  if (existing.rows[0]) {
    await query('DELETE FROM message_reactions WHERE id = $1', [existing.rows[0].id]);
    return { added: false, reaction: null };
  }
  const res = await query<MessageReaction>(
    `INSERT INTO message_reactions (message_id, user_id, emoji)
     VALUES ($1, $2, $3) RETURNING *`,
    [messageId, userId, emoji],
  );
  return { added: true, reaction: res.rows[0] };
}

export async function removeReaction(
  messageId: string,
  userId: string,
  emoji: string,
): Promise<void> {
  await query(
    'DELETE FROM message_reactions WHERE message_id = $1 AND user_id = $2 AND emoji = $3',
    [messageId, userId, emoji],
  );
}

export async function listReactionsForMessages(
  messageIds: string[],
): Promise<(MessageReaction & { username: string; display_name: string | null })[]> {
  if (messageIds.length === 0) return [];
  const res = await query<MessageReaction & { username: string; display_name: string | null }>(
    `SELECT r.*, u.username, u.display_name
     FROM message_reactions r
     JOIN users u ON u.id = r.user_id
     WHERE r.message_id = ANY($1)
     ORDER BY r.created_at ASC`,
    [messageIds],
  );
  return res.rows;
}

export async function listReactionsForMessage(
  messageId: string,
): Promise<(MessageReaction & { username: string; display_name: string | null })[]> {
  return listReactionsForMessages([messageId]);
}
