import { Router, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { ok, fail } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';
import {
  listUsers,
  findUserById,
  setBanned,
  countUsers,
} from '../models/userModel';
import { countMessages } from '../models/messageModel';
import { countGroupFiles } from '../models/groupFileModel';
import { getOnlineCount, kickUser } from '../websocket/hub';
import {
  getSmtpConfig,
  saveSmtpConfig,
  sendMail,
  isSmtpConfigured,
} from '../services/email';
import { listActiveTemp, getTempMessages } from '../temp/store';
import { env } from '../config/env';

const router = Router();

/** GET /api/admin/users?page=&pageSize=&search= */
router.get('/users', async (req: AuthedRequest, res: Response) => {
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(String(req.query.pageSize || '20'), 10)));
  const search = req.query.search ? String(req.query.search) : undefined;
  const { users, total } = await listUsers(page, pageSize, search);
  return ok(res, { users, total, page, pageSize });
});

/** PUT /api/admin/users/:id/ban */
router.put('/users/:id/ban', async (req: AuthedRequest, res: Response) => {
  const target = await findUserById(req.params.id);
  if (!target) return fail(res, 404, 'user not found', 'NOT_FOUND');
  if (target.id === req.user!.id) return fail(res, 400, 'cannot ban yourself', 'BAD_REQUEST');
  await setBanned(target.id, true);
  kickUser(target.id, { type: 'user_banned' });
  return ok(res, { ok: true });
});

/** PUT /api/admin/users/:id/unban */
router.put('/users/:id/unban', async (req: AuthedRequest, res: Response) => {
  const target = await findUserById(req.params.id);
  if (!target) return fail(res, 404, 'user not found', 'NOT_FOUND');
  await setBanned(target.id, false);
  return ok(res, { ok: true });
});

/** GET /api/admin/stats */
router.get('/stats', async (_req: AuthedRequest, res: Response) => {
  const userCount = await countUsers();
  const messageCount = await countMessages();
  const fileCount = await countGroupFiles();
  let storageBytes = 0;
  try {
    const dir = path.resolve(process.cwd(), env.UPLOAD_DIR);
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) {
        try {
          storageBytes += fs.statSync(path.join(dir, f)).size;
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* ignore */
  }
  return ok(res, {
    userCount,
    messageCount,
    fileCount,
    onlineCount: getOnlineCount(),
    storageBytes,
  });
});

/** GET /api/admin/smtp */
router.get('/smtp', async (_req: AuthedRequest, res: Response) => {
  const cfg = await getSmtpConfig();
  // Never return the password.
  return ok(res, {
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    from: cfg.from,
    secure: cfg.secure,
    configured: await isSmtpConfigured(),
    hasPassword: Boolean(cfg.pass),
  });
});

/** PUT /api/admin/smtp */
router.put('/smtp', async (req: AuthedRequest, res: Response) => {
  const { host, port, user, pass, from, secure } = req.body || {};
  if (!host) return fail(res, 400, 'host required', 'BAD_REQUEST');
  const current = await getSmtpConfig();
  await saveSmtpConfig({
    host,
    port: parseInt(String(port || current.port), 10),
    user: user || '',
    // Only overwrite password if a new one is provided.
    pass: pass || current.pass,
    from: from || current.from,
    secure: secure === true || secure === 'true',
  });
  return ok(res, { ok: true });
});

/** POST /api/admin/smtp/test */
router.post('/smtp/test', async (req: AuthedRequest, res: Response) => {
  const to = req.body?.to || req.user!.email;
  if (!to) return fail(res, 400, 'recipient email required', 'BAD_REQUEST');
  try {
    await sendMail(to, 'ChatRoom SMTP test', 'This is a test email from ChatRoom.');
    return ok(res, { sent: true, to });
  } catch (err: any) {
    return fail(res, 500, `send failed: ${err.message}`, 'SMTP_FAILED');
  }
});

/** GET /api/admin/temp-conversations */
router.get('/temp-conversations', async (req: AuthedRequest, res: Response) => {
  // Authorization log
  // eslint-disable-next-line no-console
  console.log(`[admin] temp-conversations listed by admin ${req.user!.username} (${req.user!.id})`);
  const list = listActiveTemp();
  return ok(res, list);
});

/** GET /api/admin/temp-conversations/:id */
router.get('/temp-conversations/:id', async (req: AuthedRequest, res: Response) => {
  // eslint-disable-next-line no-console
  console.log(`[admin] temp-conversation ${req.params.id} viewed by admin ${req.user!.username} (${req.user!.id})`);
  const messages = getTempMessages(req.params.id);
  return ok(res, { tempId: req.params.id, messages });
});

export default router;
