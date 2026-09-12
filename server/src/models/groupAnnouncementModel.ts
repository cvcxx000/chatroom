import { query } from '../config/db';

export interface GroupAnnouncement {
  id: string;
  conversation_id: string;
  content: string;
  created_by: string | null;
  created_at: Date;
}

/** Set (overwrite) the latest announcement for a conversation. */
export async function setAnnouncement(
  conversationId: string,
  content: string,
  createdBy: string,
): Promise<GroupAnnouncement> {
  const res = await query<GroupAnnouncement>(
    `INSERT INTO group_announcements (conversation_id, content, created_by)
     VALUES ($1, $2, $3) RETURNING *`,
    [conversationId, content, createdBy],
  );
  return res.rows[0];
}

export async function getLatestAnnouncement(
  conversationId: string,
): Promise<GroupAnnouncement | null> {
  const res = await query<GroupAnnouncement>(
    `SELECT * FROM group_announcements
     WHERE conversation_id = $1
     ORDER BY created_at DESC LIMIT 1`,
    [conversationId],
  );
  return res.rows[0] || null;
}

export async function listAnnouncements(conversationId: string): Promise<GroupAnnouncement[]> {
  const res = await query<GroupAnnouncement>(
    `SELECT * FROM group_announcements
     WHERE conversation_id = $1
     ORDER BY created_at DESC`,
    [conversationId],
  );
  return res.rows;
}
