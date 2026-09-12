import { query } from '../config/db';
import { Message } from './types';

export async function createMessage(data: {
  conversationId: string;
  senderId: string;
  content: string | null;
  messageType: 'text' | 'image' | 'file';
  fileUrl?: string | null;
  fileName?: string | null;
  fileSize?: number | null;
}): Promise<Message> {
  const res = await query<Message>(
    `INSERT INTO messages (conversation_id, sender_id, content, message_type, file_url, file_name, file_size)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      data.conversationId,
      data.senderId,
      data.content,
      data.messageType,
      data.fileUrl || null,
      data.fileName || null,
      data.fileSize != null ? String(data.fileSize) : null,
    ],
  );
  return res.rows[0];
}

/** Cursor-based pagination: messages older than `before` (ISO timestamp), newest first. */
export async function listMessagesBefore(
  conversationId: string,
  before: string | null,
  limit = 30,
): Promise<Message[]> {
  if (before) {
    const res = await query<Message>(
      `SELECT * FROM messages
       WHERE conversation_id = $1 AND created_at < $2
       ORDER BY created_at DESC
       LIMIT $3`,
      [conversationId, before, limit],
    );
    return res.rows;
  }
  const res = await query<Message>(
    `SELECT * FROM messages
     WHERE conversation_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [conversationId, limit],
  );
  return res.rows;
}

export async function countMessages(): Promise<number> {
  const res = await query<{ count: string }>('SELECT COUNT(*)::int AS count FROM messages');
  return parseInt(res.rows[0]?.count || '0', 10);
}

/** Update a message's content (used to finalize streamed AI replies). */
export async function updateMessageContent(
  id: string,
  content: string,
): Promise<Message | null> {
  const res = await query<Message>(
    'UPDATE messages SET content = $1 WHERE id = $2 RETURNING *',
    [content, id],
  );
  return res.rows[0] || null;
}

/** Fetch the latest N messages in chronological order (oldest -> newest). */
export async function listRecentMessages(
  conversationId: string,
  limit = 20,
): Promise<Message[]> {
  const rows = await listMessagesBefore(conversationId, null, limit);
  return rows.reverse();
}
