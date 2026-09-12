import { query } from '../config/db';
import { SharedLink } from './types';

export interface SharedLinkWithConversation extends SharedLink {
  conv_type: 'private' | 'group' | 'ai';
  conv_name: string | null;
}

export async function createShareLink(data: {
  conversationId: string;
  token: string;
  expiresAt: Date;
  passwordHash?: string | null;
  createdBy?: string | null;
}): Promise<SharedLink> {
  const res = await query<SharedLink>(
    `INSERT INTO shared_links (conversation_id, token, expires_at, password_hash, created_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [
      data.conversationId,
      data.token,
      data.expiresAt,
      data.passwordHash || null,
      data.createdBy || null,
    ],
  );
  return res.rows[0];
}

export async function findShareLinkByToken(token: string): Promise<SharedLink | null> {
  const res = await query<SharedLink>(
    'SELECT * FROM shared_links WHERE token = $1 LIMIT 1',
    [token],
  );
  return res.rows[0] || null;
}

/** List all (non-expired) share links for a conversation. */
export async function listShareLinksByConversation(
  conversationId: string,
): Promise<SharedLink[]> {
  const res = await query<SharedLink>(
    `SELECT * FROM shared_links
     WHERE conversation_id = $1 AND expires_at > now()
     ORDER BY created_at DESC`,
    [conversationId],
  );
  return res.rows;
}

export async function deleteShareLinkByToken(token: string): Promise<void> {
  await query('DELETE FROM shared_links WHERE token = $1', [token]);
}

/** Remove all expired share links. */
export async function cleanupExpired(): Promise<number> {
  const res = await query<{ count: string }>(
    'DELETE FROM shared_links WHERE expires_at <= now() RETURNING id',
  );
  return res.rowCount ?? res.rows.length;
}
