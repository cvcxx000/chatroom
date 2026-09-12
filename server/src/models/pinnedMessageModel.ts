import { query } from '../config/db';

export interface PinnedMessage {
  id: string;
  conversation_id: string;
  message_id: string;
  pinned_by: string | null;
  created_at: Date;
}

export async function pinMessage(
  conversationId: string,
  messageId: string,
  pinnedBy: string,
): Promise<PinnedMessage> {
  const res = await query<PinnedMessage>(
    `INSERT INTO pinned_messages (conversation_id, message_id, pinned_by)
     VALUES ($1, $2, $3)
     ON CONFLICT (conversation_id, message_id) DO NOTHING
     RETURNING *`,
    [conversationId, messageId, pinnedBy],
  );
  if (res.rows[0]) return res.rows[0];
  const existing = await query<PinnedMessage>(
    'SELECT * FROM pinned_messages WHERE conversation_id = $1 AND message_id = $2 LIMIT 1',
    [conversationId, messageId],
  );
  return existing.rows[0];
}

export async function unpinMessage(conversationId: string, messageId: string): Promise<void> {
  await query(
    'DELETE FROM pinned_messages WHERE conversation_id = $1 AND message_id = $2',
    [conversationId, messageId],
  );
}

export async function listPinnedMessages(conversationId: string): Promise<PinnedMessage[]> {
  const res = await query<PinnedMessage>(
    'SELECT * FROM pinned_messages WHERE conversation_id = $1 ORDER BY created_at DESC',
    [conversationId],
  );
  return res.rows;
}
