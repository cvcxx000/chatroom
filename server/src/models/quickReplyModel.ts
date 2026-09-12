import { query } from '../config/db';

export interface QuickReply {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: Date;
}

export async function listQuickReplies(userId: string): Promise<QuickReply[]> {
  const res = await query<QuickReply>(
    'SELECT * FROM quick_replies WHERE user_id = $1 ORDER BY created_at ASC',
    [userId],
  );
  return res.rows;
}

export async function createQuickReply(
  userId: string,
  title: string,
  content: string,
): Promise<QuickReply> {
  const res = await query<QuickReply>(
    `INSERT INTO quick_replies (user_id, title, content)
     VALUES ($1, $2, $3) RETURNING *`,
    [userId, title, content],
  );
  return res.rows[0];
}

export async function updateQuickReply(
  id: string,
  userId: string,
  data: { title?: string; content?: string },
): Promise<QuickReply | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (data.title !== undefined) {
    params.push(data.title);
    sets.push(`title = $${params.length}`);
  }
  if (data.content !== undefined) {
    params.push(data.content);
    sets.push(`content = $${params.length}`);
  }
  if (sets.length === 0) {
    const cur = await query<QuickReply>(
      'SELECT * FROM quick_replies WHERE id = $1 AND user_id = $2 LIMIT 1',
      [id, userId],
    );
    return cur.rows[0] || null;
  }
  params.push(id, userId);
  const res = await query<QuickReply>(
    `UPDATE quick_replies SET ${sets.join(', ')}
     WHERE id = $${params.length - 1} AND user_id = $${params.length}
     RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

export async function deleteQuickReply(id: string, userId: string): Promise<void> {
  await query('DELETE FROM quick_replies WHERE id = $1 AND user_id = $2', [id, userId]);
}
