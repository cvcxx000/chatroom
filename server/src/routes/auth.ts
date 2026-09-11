import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ok, fail } from '../utils/response';
import { signToken } from '../utils/jwt';
import {
  findUserByUsername,
  findUserByEmail,
  findUserById,
  createUser,
  updateLastLogin,
  setVerified,
} from '../models/userModel';
import { setConfig, getConfig } from '../models/systemConfigModel';
import { sendVerificationEmail } from '../services/email';
import { AuthedRequest } from '../middleware/auth';

const router = Router();

// Verification tokens: temp in-memory store -> userId
const verificationTokens = new Map<string, string>();
const VERIFY_TTL = 24 * 60 * 60 * 1000; // 24h

function issueVerificationToken(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  verificationTokens.set(token, userId);
  setTimeout(() => verificationTokens.delete(token), VERIFY_TTL);
  return token;
}

/** POST /api/auth/register */
router.post('/register', async (req: Request, res: Response) => {
  const { username, email, password, displayName } = req.body || {};
  if (!username || !password) {
    return fail(res, 400, 'username and password are required', 'BAD_REQUEST');
  }
  if (String(username).length < 3 || String(username).length > 50) {
    return fail(res, 400, 'username must be 3-50 chars', 'BAD_REQUEST');
  }
  if (String(password).length < 6) {
    return fail(res, 400, 'password must be at least 6 chars', 'BAD_REQUEST');
  }
  const existingUser = await findUserByUsername(username);
  if (existingUser) return fail(res, 409, 'username already taken', 'USERNAME_TAKEN');
  if (email) {
    const existingEmail = await findUserByEmail(email);
    if (existingEmail) return fail(res, 409, 'email already registered', 'EMAIL_TAKEN');
  }

  const hash = await bcrypt.hash(password, 10);
  const user = await createUser({
    username,
    email: email || null,
    passwordHash: hash,
    displayName: displayName || username,
    isVerified: false,
  });

  // Send verification email if SMTP configured
  if (email) {
    const token = issueVerificationToken(user.id);
    await sendVerificationEmail(email, token).catch(() => undefined);
  }

  await updateLastLogin(user.id);
  const token = signToken({ userId: user.id, isAdmin: user.is_admin });
  return ok(res, {
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      isAdmin: user.is_admin,
      isVerified: user.is_verified,
    },
  });
});

/** POST /api/auth/login */
router.post('/login', async (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  if (!username || !password) return fail(res, 400, 'username and password required', 'BAD_REQUEST');
  const user = await findUserByUsername(username);
  if (!user) return fail(res, 401, 'invalid credentials', 'INVALID_CREDENTIALS');
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return fail(res, 401, 'invalid credentials', 'INVALID_CREDENTIALS');
  if (user.is_banned) return fail(res, 403, 'User is banned', 'USER_BANNED');
  await updateLastLogin(user.id);
  const token = signToken({ userId: user.id, isAdmin: user.is_admin });
  return ok(res, {
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      isAdmin: user.is_admin,
      isVerified: user.is_verified,
    },
  });
});

/** POST /api/auth/admin-login */
router.post('/admin-login', async (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  if (!username || !password) return fail(res, 400, 'username and password required', 'BAD_REQUEST');
  const user = await findUserByUsername(username);
  if (!user) return fail(res, 401, 'invalid credentials', 'INVALID_CREDENTIALS');
  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return fail(res, 401, 'invalid credentials', 'INVALID_CREDENTIALS');
  if (user.is_banned) return fail(res, 403, 'User is banned', 'USER_BANNED');
  if (!user.is_admin) return fail(res, 403, 'Admin access required', 'ADMIN_REQUIRED');
  await updateLastLogin(user.id);
  const token = signToken({ userId: user.id, isAdmin: true });
  return ok(res, {
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
      isAdmin: true,
      isVerified: user.is_verified,
    },
  });
});

/** GET /api/auth/me */
router.get('/me', async (req: AuthedRequest, res: Response) => {
  if (!req.user) return fail(res, 401, 'unauthorized', 'NO_TOKEN');
  const u = req.user;
  return ok(res, {
    id: u.id,
    username: u.username,
    email: u.email,
    displayName: u.display_name,
    avatarUrl: u.avatar_url,
    isAdmin: u.is_admin,
    isVerified: u.is_verified,
    createdAt: u.created_at,
  });
});

/** POST /api/auth/verify-email */
router.post('/verify-email', async (req: Request, res: Response) => {
  const { token } = req.body || {};
  if (!token) return fail(res, 400, 'token required', 'BAD_REQUEST');
  const userId = verificationTokens.get(token);
  if (!userId) return fail(res, 400, 'invalid or expired token', 'INVALID_TOKEN');
  await setVerified(userId, true);
  verificationTokens.delete(token);
  return ok(res, { verified: true });
});

/** POST /api/auth/resend-verification */
router.post('/resend-verification', async (req: Request, res: Response) => {
  const { email } = req.body || {};
  if (!email) return fail(res, 400, 'email required', 'BAD_REQUEST');
  const user = await findUserByEmail(email);
  if (user && !user.is_verified && user.email) {
    const token = issueVerificationToken(user.id);
    await sendVerificationEmail(user.email, token).catch(() => undefined);
  }
  // Always return success to avoid user enumeration.
  return ok(res, { sent: true });
});

export default router;
