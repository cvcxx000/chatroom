import { query } from '../config/db';

export interface ConversationSetting {
  id: string;
  conversation_id: string;
  user_id: string;
  is_pinned: boolean;
  is_muted: boolean;
  is_archived: boolean;
}

export async function getOrCreateSetting(
  conversationId: string,
  userId: string,
): Promise<ConversationSetting> {
  const existing = await query<ConversationSetting>(
    'SELECT * FROM conversation_settings WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
    [conversationId, userId],
  );
  if (existing.rows[0]) return existing.rows[0];
  const inserted = await query<ConversationSetting>(
    `INSERT INTO conversation_settings (conversation_id, user_id)
     VALUES ($1, $2) RETURNING *`,
    [conversationId, userId],
  );
  return inserted.rows[0];
}

export async function listConversationSettings(
  userId: string,
): Promise<ConversationSetting[]> {
  const res = await query<ConversationSetting>(
    'SELECT * FROM conversation_settings WHERE user_id = $1',
    [userId],
  );
  return res.rows;
}

export async function updateConversationSetting(
  conversationId: string,
  userId: string,
  data: { isPinned?: boolean; isMuted?: boolean; isArchived?: boolean },
): Promise<ConversationSetting> {
  await getOrCreateSetting(conversationId, userId);
  const sets: string[] = [];
  const params: unknown[] = [];
  if (data.isPinned !== undefined) {
    params.push(data.isPinned);
    sets.push(`is_pinned = $${params.length}`);
  }
  if (data.isMuted !== undefined) {
    params.push(data.isMuted);
    sets.push(`is_muted = $${params.length}`);
  }
  if (data.isArchived !== undefined) {
    params.push(data.isArchived);
    sets.push(`is_archived = $${params.length}`);
  }
  if (sets.length > 0) {
    params.push(conversationId, userId);
    await query(
      `UPDATE conversation_settings SET ${sets.join(', ')}
       WHERE conversation_id = $${params.length - 1} AND user_id = $${params.length}`,
      params,
    );
  }
  return getOrCreateSetting(conversationId, userId);
}
