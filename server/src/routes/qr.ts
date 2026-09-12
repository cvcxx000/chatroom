import { Router, Response } from 'express';
import crypto from 'crypto';
import { ok, fail } from '../utils/response';
import { AuthedRequest, requireAuth } from '../middleware/auth';
import { signToken } from '../utils/jwt';
import { findUserById, toSafeUser, updateLastLogin } from '../models/userModel';
import {
  createQrSession,
  findQrSessionByToken,
  updateQrSessionStatus,
} from '../models/qrSessionModel';

const router = Router();

function isExpired(expiresAt: Date): boolean {
  return new Date(expiresAt).getTime() <= Date.now();
}

/**
 * POST /api/qr/create (public)
 * Creates a pending QR login session valid for 5 minutes.
 */
router.post('/create', async (_req, res: Response) => {
  const token = crypto.randomBytes(24).toString('hex');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await createQrSession({ token, expiresAt });
  return ok(res, { token, expiresAt });
});

/**
 * GET /api/qr/:token/status (public)
 * PC polls this. Returns status and (when confirmed) the safe user.
 */
router.get('/:token/status', async (req, res: Response) => {
  const session = await findQrSessionByToken(req.params.token);
  if (!session) return fail(res, 404, 'session not found', 'NOT_FOUND');
  if (isExpired(session.expires_at) && session.status !== 'confirmed') {
    return ok(res, { status: 'expired' });
  }
  if (session.status === 'confirmed' && session.user_id) {
    const user = await findUserById(session.user_id);
    return ok(res, { status: session.status, user: user ? toSafeUser(user) : null });
  }
  return ok(res, { status: session.status });
});

/**
 * POST /api/qr/:token/scan (auth - phone)
 * pending -> scanned, records the scanning user.
 */
router.post('/:token/scan', requireAuth, async (req: AuthedRequest, res: Response) => {
  const session = await findQrSessionByToken(req.params.token);
  if (!session) return fail(res, 404, 'session not found', 'NOT_FOUND');
  if (isExpired(session.expires_at)) return fail(res, 410, 'session expired', 'EXPIRED');
  if (session.status !== 'pending') {
    return fail(res, 400, `cannot scan a session in '${session.status}' state`, 'BAD_STATE');
  }
  await updateQrSessionStatus(session.token, 'scanned', req.user!.id);
  return ok(res, { ok: true });
});

/**
 * POST /api/qr/:token/confirm (auth - phone)
 * scanned -> confirmed, performed by the same user who scanned.
 */
router.post('/:token/confirm', requireAuth, async (req: AuthedRequest, res: Response) => {
  const session = await findQrSessionByToken(req.params.token);
  if (!session) return fail(res, 404, 'session not found', 'NOT_FOUND');
  if (isExpired(session.expires_at)) return fail(res, 410, 'session expired', 'EXPIRED');
  if (session.status !== 'scanned') {
    return fail(res, 400, `cannot confirm a session in '${session.status}' state`, 'BAD_STATE');
  }
  if (session.user_id !== req.user!.id) {
    return fail(res, 403, 'only the scanning user can confirm', 'FORBIDDEN');
  }
  await updateQrSessionStatus(session.token, 'confirmed');
  return ok(res, { ok: true });
});

/**
 * POST /api/qr/:token/login (public - PC)
 * Exchanges a confirmed session for a JWT, then expires the session.
 */
router.post('/:token/login', async (req, res: Response) => {
  const session = await findQrSessionByToken(req.params.token);
  if (!session) return fail(res, 404, 'session not found', 'NOT_FOUND');
  if (session.status !== 'confirmed' || !session.user_id) {
    return fail(res, 400, 'session not confirmed', 'NOT_CONFIRMED');
  }
  const user = await findUserById(session.user_id);
  if (!user || user.is_banned) {
    return fail(res, 401, 'user unavailable', 'INVALID_USER');
  }
  await updateLastLogin(user.id);
  const token = signToken({ userId: user.id, isAdmin: user.is_admin });
  await updateQrSessionStatus(session.token, 'expired');
  return ok(res, {
    token,
    user: toSafeUser(user),
  });
});

export default router;
