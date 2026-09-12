import { query } from '../config/db';
import { QrSession, QrStatus } from './types';

export async function createQrSession(data: {
  token: string;
  expiresAt: Date;
}): Promise<QrSession> {
  const res = await query<QrSession>(
    `INSERT INTO qr_sessions (token, expires_at, status)
     VALUES ($1, $2, 'pending')
     RETURNING *`,
    [data.token, data.expiresAt],
  );
  return res.rows[0];
}

export async function findQrSessionByToken(token: string): Promise<QrSession | null> {
  const res = await query<QrSession>(
    'SELECT * FROM qr_sessions WHERE token = $1 LIMIT 1',
    [token],
  );
  return res.rows[0] || null;
}

export async function updateQrSessionStatus(
  token: string,
  status: QrStatus,
  userId?: string | null,
): Promise<QrSession | null> {
  if (userId !== undefined) {
    const res = await query<QrSession>(
      `UPDATE qr_sessions SET status = $1, user_id = $2 WHERE token = $3 RETURNING *`,
      [status, userId, token],
    );
    return res.rows[0] || null;
  }
  const res = await query<QrSession>(
    `UPDATE qr_sessions SET status = $1 WHERE token = $2 RETURNING *`,
    [status, token],
  );
  return res.rows[0] || null;
}

/** Expire sessions past their TTL (also flips row status lazily). */
export async function cleanupExpired(): Promise<number> {
  const res = await query<{ id: string }>(
    `UPDATE qr_sessions SET status = 'expired'
     WHERE expires_at <= now() AND status <> 'expired'
     RETURNING id`,
  );
  return res.rowCount ?? res.rows.length;
}
