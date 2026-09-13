import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { ok, fail } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';
import {
  searchUsers,
  findUserById,
  updateProfile,
  updatePasswordHash,
  toSafeUser,
} from '../models/userModel';
import { env } from '../config/env';
import {
  upsertUserStatus,
  getUserStatus,
  UserStatusValue,
} from '../models/userStatusModel';
import {
  blockUser,
  unblockUser,
  listBlockedUsers,
} from '../models/blockedUserModel';
import {
  createReport,
  REPORT_REASONS,
  ReportReason,
} from '../models/reportModel';
import {
  listLoginHistory,
} from '../models/loginHistoryModel';
import { UPLOAD_DIR } from './conversations';

const router = Router();

// 安全：UUID 格式校验
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

// 安全：头像允许的扩展名白名单（不能只信 mimetype）。
// 显式排除 .svg（可内嵌脚本，存储型 XSS）、.html/.htm 等可执行类型。
const ALLOWED_AVATAR_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

// 输入长度上限（对齐 DB 列与防 DoS）
const LIMITS = {
  displayName: 100, // users.display_name VARCHAR(100)
  email: 255, // users.email VARCHAR(255)
  statusText: 255, // user_status.status_text VARCHAR(255)
  searchQ: 100,
  reportDetail: 1000,
  password: 128,
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // 安全修复：除 mimetype 外同时校验扩展名，拒绝 .svg/.html 等危险类型
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_AVATAR_EXTS.has(ext)) {
      return cb(new Error('only images (jpg/jpeg/png/gif/webp) allowed'));
    }
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('only images allowed'));
  },
});

/** GET /api/users/search?q= */
router.get('/search', async (req: AuthedRequest, res: Response) => {
  const q = String(req.query.q || '').trim().slice(0, LIMITS.searchQ);
  if (!q) return ok(res, []);
  const users = await searchUsers(q, 20);
  return ok(res, users.filter((u) => u.id !== req.user!.id).map(toSafeUser));
});

/** GET /api/users/blocked - list blocked users. */
router.get('/blocked', async (req: AuthedRequest, res: Response) => {
  const rows = await listBlockedUsers(req.user!.id);
  const users = [];
  for (const r of rows) {
    const u = await findUserById(r.blocked_user_id);
    if (u) users.push({ ...r, user: toSafeUser(u) });
  }
  return ok(res, users);
});

/** GET /api/users/login-history - recent login records (up to 20). */
router.get('/login-history', async (req: AuthedRequest, res: Response) => {
  const rows = await listLoginHistory(req.user!.id, 20);
  return ok(res, rows);
});

/** GET /api/users/status - get my online status. */
router.get('/status', async (req: AuthedRequest, res: Response) => {
  const st = await getUserStatus(req.user!.id);
  if (st) return ok(res, st);
  return ok(res, {
    user_id: req.user!.id,
    status: 'offline',
    status_text: null,
    last_seen_at: req.user!.last_login_at || null,
    updated_at: new Date(),
  });
});

/** PUT /api/users/status - update my online status. body: { status, statusText } */
router.put('/status', async (req: AuthedRequest, res: Response) => {
  const { status, statusText } = req.body || {};
  const allowed: UserStatusValue[] = ['online', 'away', 'busy', 'offline'];
  const st = (status || 'online') as UserStatusValue;
  if (!allowed.includes(st)) {
    return fail(res, 400, 'invalid status', 'BAD_REQUEST');
  }
  const row = await upsertUserStatus(req.user!.id, {
    status: st,
    // 安全：statusText 长度限制（DB VARCHAR(255)）
    statusText:
      statusText != null ? String(statusText).slice(0, LIMITS.statusText) : null,
  });
  return ok(res, row);
});

/** GET /api/users/:id/profile */
router.get('/:id/profile', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 404, 'user not found', 'NOT_FOUND');
  const user = await findUserById(req.params.id);
  if (!user) return fail(res, 404, 'user not found', 'NOT_FOUND');
  return ok(res, toSafeUser(user));
});

/** GET /api/users/:id/status - get another user's status (with lastSeen). */
router.get('/:id/status', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 404, 'user not found', 'NOT_FOUND');
  const user = await findUserById(req.params.id);
  if (!user) return fail(res, 404, 'user not found', 'NOT_FOUND');
  const st = await getUserStatus(user.id);
  return ok(res, {
    userId: user.id,
    status: st?.status || 'offline',
    statusText: st?.status_text || null,
    lastSeenAt: st?.last_seen_at || user.last_login_at || null,
  });
});

/** PUT /api/users/profile - update profile (displayName, avatarUrl, email, statusText). */
router.put('/profile', async (req: AuthedRequest, res: Response) => {
  const { displayName, avatarUrl, email, statusText } = req.body || {};
  // 安全：各字段长度限制，防止超长输入导致 DB 报错/DoS
  if (displayName !== undefined && displayName !== null) {
    const dn = String(displayName);
    if (dn.length > LIMITS.displayName) {
      return fail(res, 400, `displayName too long (max ${LIMITS.displayName})`, 'BAD_REQUEST');
    }
  }
  if (email !== undefined && email !== null) {
    if (String(email).length > LIMITS.email) {
      return fail(res, 400, 'email too long', 'BAD_REQUEST');
    }
  }
  if (avatarUrl !== undefined && avatarUrl !== null && String(avatarUrl).length > 500) {
    return fail(res, 400, 'avatarUrl too long', 'BAD_REQUEST');
  }
  const updated = await updateProfile(req.user!.id, {
    displayName: displayName !== undefined ? String(displayName) : undefined,
    avatarUrl: avatarUrl !== undefined ? String(avatarUrl) : undefined,
    email: email !== undefined ? (email ? String(email) : null) : undefined,
  });
  if (!updated) return fail(res, 404, 'user not found', 'NOT_FOUND');
  if (statusText !== undefined) {
    await upsertUserStatus(req.user!.id, {
      statusText: statusText ? String(statusText).slice(0, LIMITS.statusText) : null,
    });
  }
  return ok(res, toSafeUser(updated));
});

/** POST /api/users/avatar - upload avatar (multipart field 'file'). */
router.post('/avatar', upload.single('file'), async (req: AuthedRequest, res: Response) => {
  if (!req.file) return fail(res, 400, 'no file uploaded', 'NO_FILE');
  const avatarUrl = `/uploads/${req.file.filename}`;
  const updated = await updateProfile(req.user!.id, { avatarUrl });
  return ok(res, { avatarUrl, user: updated ? toSafeUser(updated) : null });
});

/** PUT /api/users/password - change password. body: { oldPassword, newPassword } */
router.put('/password', async (req: AuthedRequest, res: Response) => {
  const { oldPassword, newPassword } = req.body || {};
  if (!oldPassword || !newPassword) {
    return fail(res, 400, 'oldPassword and newPassword required', 'BAD_REQUEST');
  }
  if (String(newPassword).length < 6) {
    return fail(res, 400, 'new password must be at least 6 chars', 'BAD_REQUEST');
  }
  // 安全：bcrypt 实际只处理前 72 字节，限制上限避免无意义大输入
  if (String(newPassword).length > LIMITS.password) {
    return fail(res, 400, `new password too long (max ${LIMITS.password})`, 'BAD_REQUEST');
  }
  if (String(oldPassword).length > LIMITS.password) {
    return fail(res, 400, 'old password too long', 'BAD_REQUEST');
  }
  const match = await bcrypt.compare(String(oldPassword), req.user!.password_hash);
  if (!match) return fail(res, 400, 'old password is incorrect', 'INVALID_PASSWORD');
  const hash = await bcrypt.hash(String(newPassword), 10);
  await updatePasswordHash(req.user!.id, hash);
  return ok(res, { ok: true });
});

/** POST /api/users/block/:userId - block a user. */
router.post('/block/:userId', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.userId)) return fail(res, 400, 'invalid userId', 'BAD_REQUEST');
  const target = await findUserById(req.params.userId);
  if (!target) return fail(res, 404, 'user not found', 'NOT_FOUND');
  if (target.id === req.user!.id) {
    return fail(res, 400, 'cannot block yourself', 'BAD_REQUEST');
  }
  await blockUser(req.user!.id, target.id);
  return ok(res, { blocked: true, userId: target.id });
});

/** DELETE /api/users/block/:userId - unblock a user. */
router.delete('/block/:userId', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.userId)) return fail(res, 400, 'invalid userId', 'BAD_REQUEST');
  await unblockUser(req.user!.id, req.params.userId);
  return ok(res, { blocked: false, userId: req.params.userId });
});

/** POST /api/users/:userId/block - block a user (alias used by the frontend). */
router.post('/:userId/block', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.userId)) return fail(res, 400, 'invalid userId', 'BAD_REQUEST');
  const target = await findUserById(req.params.userId);
  if (!target) return fail(res, 404, 'user not found', 'NOT_FOUND');
  if (target.id === req.user!.id) {
    return fail(res, 400, 'cannot block yourself', 'BAD_REQUEST');
  }
  await blockUser(req.user!.id, target.id);
  return ok(res, { blocked: true, userId: target.id });
});

/** DELETE /api/users/:userId/block - unblock a user (alias used by the frontend). */
router.delete('/:userId/block', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.userId)) return fail(res, 400, 'invalid userId', 'BAD_REQUEST');
  await unblockUser(req.user!.id, req.params.userId);
  return ok(res, { blocked: false, userId: req.params.userId });
});

/**
 * POST /api/users/:userId/report - report a user.
 * body: { reason: 'harassment'|'advertising'|'abuse'|'other', detail?: string }
 */
router.post('/:userId/report', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.userId)) return fail(res, 404, 'user not found', 'NOT_FOUND');
  const target = await findUserById(req.params.userId);
  if (!target) return fail(res, 404, 'user not found', 'NOT_FOUND');
  if (target.id === req.user!.id) {
    return fail(res, 400, 'cannot report yourself', 'BAD_REQUEST');
  }
  const { reason, detail } = req.body || {};
  if (!reason || !REPORT_REASONS.includes(reason)) {
    return fail(res, 400, `reason must be one of: ${REPORT_REASONS.join(', ')}`, 'BAD_REQUEST');
  }
  // 安全：举报详情长度限制
  const detailStr = detail != null ? String(detail).slice(0, LIMITS.reportDetail) : null;
  const row = await createReport(
    req.user!.id,
    target.id,
    reason as ReportReason,
    detailStr,
  );
  return ok(res, row);
});

export default router;
