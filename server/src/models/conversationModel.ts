import { query, getClient } from '../config/db';
import { Conversation, ConversationMember, Message, User } from './types';

export async function createConversation(data: {
  type: 'private' | 'group';
  name?: string | null;
  createdBy: string;
  memberIds: string[];
}): Promise<Conversation> {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const convRes = await client.query<Conversation>(
      `INSERT INTO conversations (type, name, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [data.type, data.name || null, data.createdBy],
    );
    const conv = convRes.rows[0];
    const allMembers = Array.from(new Set([data.createdBy, ...data.memberIds]));
    for (const uid of allMembers) {
      await client.query(
        `INSERT INTO conversation_members (conversation_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [conv.id, uid, uid === data.createdBy ? 'admin' : 'member'],
      );
    }
    await client.query('COMMIT');
    return conv;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function findConversationById(id: string): Promise<Conversation | null> {
  const res = await query<Conversation>(
    'SELECT * FROM conversations WHERE id = $1 LIMIT 1',
    [id],
  );
  return res.rows[0] || null;
}

export async function isMember(conversationId: string, userId: string): Promise<boolean> {
  const res = await query(
    'SELECT 1 FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
    [conversationId, userId],
  );
  return res.rows.length > 0;
}

export async function getMembers(conversationId: string): Promise<(ConversationMember & User)[]> {
  const res = await query<ConversationMember & User>(
    `SELECT cm.*, u.username, u.email, u.display_name, u.avatar_url,
            u.is_admin, u.is_banned, u.is_verified, u.created_at, u.last_login_at
     FROM conversation_members cm
     JOIN users u ON u.id = cm.user_id
     WHERE cm.conversation_id = $1
     ORDER BY cm.joined_at ASC`,
    [conversationId],
  );
  return res.rows;
}

export async function getMemberIds(conversationId: string): Promise<string[]> {
  const res = await query<{ user_id: string }>(
    'SELECT user_id FROM conversation_members WHERE conversation_id = $1',
    [conversationId],
  );
  return res.rows.map((r) => r.user_id);
}

export async function addMembers(
  conversationId: string,
  userIds: string[],
): Promise<void> {
  for (const uid of userIds) {
    await query(
      `INSERT INTO conversation_members (conversation_id, user_id, role)
       VALUES ($1, $2, 'member') ON CONFLICT DO NOTHING`,
      [conversationId, uid],
    );
  }
}

export async function removeMember(conversationId: string, userId: string): Promise<void> {
  await query(
    'DELETE FROM conversation_members WHERE conversation_id = $1 AND user_id = $2',
    [conversationId, userId],
  );
}

export async function renameConversation(id: string, name: string): Promise<void> {
  await query('UPDATE conversations SET name = $1 WHERE id = $2', [name, id]);
}

export async function getMemberRole(
  conversationId: string,
  userId: string,
): Promise<'member' | 'admin' | null> {
  const res = await query<{ role: 'member' | 'admin' }>(
    'SELECT role FROM conversation_members WHERE conversation_id = $1 AND user_id = $2 LIMIT 1',
    [conversationId, userId],
  );
  return res.rows[0]?.role || null;
}

/** For a private chat, find existing conversation between two users. */
export async function findPrivateConversationBetween(
  a: string,
  b: string,
): Promise<Conversation | null> {
  const res = await query<Conversation>(
    `SELECT c.* FROM conversations c
     JOIN conversation_members m1 ON m1.conversation_id = c.id AND m1.user_id = $1
     JOIN conversation_members m2 ON m2.conversation_id = c.id AND m2.user_id = $2
     WHERE c.type = 'private'
     LIMIT 1`,
    [a, b],
  );
  return res.rows[0] || null;
}

export interface ConversationListItem extends Conversation {
  last_message: Message | null;
  unread_count: number;
  member_count: number;
}

/** List conversations for a user with last message. */
export async function listConversations(userId: string): Promise<Conversation[]> {
  const res = await query<Conversation>(
    `SELECT DISTINCT c.* FROM conversations c
     JOIN conversation_members m ON m.conversation_id = c.id
     WHERE m.user_id = $1
     ORDER BY c.created_at DESC`,
    [userId],
  );
  return res.rows;
}

export async function getLastMessage(conversationId: string): Promise<Message | null> {
  const res = await query<Message>(
    'SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1',
    [conversationId],
  );
  return res.rows[0] || null;
}
