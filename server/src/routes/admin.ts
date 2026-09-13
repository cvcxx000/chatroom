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
import {
  listAiConfigs,
  createAiConfig,
  getAiConfigById,
  updateAiConfig,
  deleteAiConfig,
} from '../models/aiConfigModel';
import { listActiveTemp, getTempMessages } from '../temp/store';
import { env } from '../config/env';
import { dockerService } from '../services/docker';

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
  } catch {
    // [SECURITY] Do not leak SMTP server error details (host/user).
    return fail(res, 500, 'Failed to send test email. Check SMTP config.', 'SMTP_FAILED');
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

/** Mask an API key: show first 4 and last 4 chars only. */
function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '*'.repeat(key.length);
  return `${key.slice(0, 4)}${'*'.repeat(Math.max(4, key.length - 8))}${key.slice(-4)}`;
}

/** GET /api/admin/ai-configs */
router.get('/ai-configs', async (_req: AuthedRequest, res: Response) => {
  const configs = await listAiConfigs();
  return ok(
    res,
    configs.map((c) => ({
      id: c.id,
      provider: c.provider,
      name: c.name,
      baseUrl: c.base_url,
      apiKey: maskApiKey(c.api_key),
      model: c.model,
      isActive: c.is_active,
      createdAt: c.created_at,
    })),
  );
});

/** POST /api/admin/ai-configs */
router.post('/ai-configs', async (req: AuthedRequest, res: Response) => {
  const { provider, name, baseUrl, apiKey, model, isActive } = req.body || {};
  if (!provider || !name || !baseUrl || !apiKey || !model) {
    return fail(res, 400, 'provider, name, baseUrl, apiKey and model are required', 'BAD_REQUEST');
  }
  // [SECURITY] Enforce length limits.
  if (String(apiKey).length > 512) {
    return fail(res, 400, 'apiKey too long (max 512 chars)', 'BAD_REQUEST');
  }
  if (String(baseUrl).length > 2048) {
    return fail(res, 400, 'baseUrl too long', 'BAD_REQUEST');
  }
  const cfg = await createAiConfig({
    provider: String(provider).slice(0, 64),
    name: String(name).slice(0, 128),
    baseUrl: String(baseUrl),
    apiKey: String(apiKey),
    model: String(model).slice(0, 128),
    isActive: isActive !== false,
  });
  return ok(res, { id: cfg.id });
});

/** PUT /api/admin/ai-configs/:id */
router.put('/ai-configs/:id', async (req: AuthedRequest, res: Response) => {
  const existing = await getAiConfigById(req.params.id);
  if (!existing) return fail(res, 404, 'ai config not found', 'NOT_FOUND');
  const { provider, name, baseUrl, apiKey, model, isActive } = req.body || {};
  // [SECURITY] Enforce length limits.
  if (apiKey !== undefined && apiKey !== '' && String(apiKey).length > 512) {
    return fail(res, 400, 'apiKey too long (max 512 chars)', 'BAD_REQUEST');
  }
  if (baseUrl !== undefined && String(baseUrl).length > 2048) {
    return fail(res, 400, 'baseUrl too long', 'BAD_REQUEST');
  }
  const updated = await updateAiConfig(req.params.id, {
    provider: provider !== undefined ? String(provider).slice(0, 64) : undefined,
    name: name !== undefined ? String(name).slice(0, 128) : undefined,
    baseUrl: baseUrl !== undefined ? String(baseUrl) : undefined,
    // Empty apiKey means "leave it unchanged".
    apiKey: apiKey === '' || apiKey === undefined ? undefined : String(apiKey),
    model: model !== undefined ? String(model).slice(0, 128) : undefined,
    isActive: isActive !== undefined ? isActive === true || isActive === 'true' : undefined,
  });
  return ok(res, { ok: true, id: updated?.id });
});

/** DELETE /api/admin/ai-configs/:id */
router.delete('/ai-configs/:id', async (req: AuthedRequest, res: Response) => {
  await deleteAiConfig(req.params.id);
  return ok(res, { ok: true });
});

/** Format bytes as a human-readable docker-style memory string, e.g. 512m. */
function formatMemory(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0';
  const mb = Math.round(bytes / 1024 / 1024);
  if (mb >= 1024 && mb % 1024 === 0) return `${mb / 1024}g`;
  return `${mb}m`;
}

/** Parse a memory value that may be a byte number or a docker-style string. */
function parseMemory(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const m = value.trim().match(/^(\d+(?:\.\d+)?)\s*([mg])?$/i);
    if (m) {
      const num = parseFloat(m[1]);
      const unit = (m[2] || 'm').toLowerCase();
      return unit === 'g' ? Math.round(num * 1024 * 1024 * 1024) : Math.round(num * 1024 * 1024);
    }
  }
  return undefined;
}

/** GET /api/admin/terminals - list all running terminal containers. */
router.get('/terminals', async (_req: AuthedRequest, res: Response) => {
  if (!dockerService.available) {
    return ok(res, { containers: [], dockerAvailable: false });
  }
  try {
    const containers = await dockerService.listContainers();
    return ok(res, { containers, dockerAvailable: true });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[admin] list terminals failed:', err);
    return ok(res, { containers: [], dockerAvailable: false });
  }
});

/** POST /api/admin/terminals/:id/stop - force stop any user's container. */
router.post('/terminals/:id/stop', async (req: AuthedRequest, res: Response) => {
  if (!dockerService.available) {
    return fail(res, 503, 'Docker is not available', 'DOCKER_UNAVAILABLE');
  }
  try {
    await dockerService.stopContainer(req.params.id);
    return ok(res, { ok: true });
  } catch {
    // [SECURITY] Do not leak Docker daemon error details.
    return fail(res, 500, 'Failed to stop container.', 'STOP_FAILED');
  }
});

/** GET /api/admin/terminal-config - read default resource limits. */
router.get('/terminal-config', (_req: AuthedRequest, res: Response) => {
  const cfg = dockerService.getTerminalConfig();
  return ok(res, {
    cpus: cfg.cpus,
    memory: formatMemory(cfg.memory),
    image: cfg.image,
    timeoutMinutes: cfg.timeoutMinutes,
    networkDisabled: cfg.networkDisabled,
  });
});

/** PUT /api/admin/terminal-config - update default resource limits (in-memory). */
router.put('/terminal-config', (req: AuthedRequest, res: Response) => {
  const body = req.body || {};
  const patch: Partial<ReturnType<typeof dockerService.getTerminalConfig>> = {};
  if (body.cpus !== undefined) {
    const cpus = Number(body.cpus);
    // [SECURITY] Bound cpus to prevent resource exhaustion (max 8 CPUs).
    if (!Number.isFinite(cpus) || cpus <= 0 || cpus > 8) {
      return fail(res, 400, 'cpus must be a positive number not exceeding 8', 'BAD_REQUEST');
    }
    patch.cpus = cpus;
  }
  if (body.memory !== undefined) {
    const mem = parseMemory(body.memory);
    // [SECURITY] Bound memory to 8 GB to prevent container OOM/host DoS.
    if (mem === undefined || mem > 8 * 1024 * 1024 * 1024) {
      return fail(res, 400, 'memory must be e.g. 512m and not exceed 8g', 'BAD_REQUEST');
    }
    patch.memory = mem;
  }
  if (body.image !== undefined) {
    if (typeof body.image !== 'string' || !body.image.trim()) {
      return fail(res, 400, 'image must be a non-empty string', 'BAD_REQUEST');
    }
    // [SECURITY] Reject shell/command metacharacters in image name to prevent injection.
    if (/[;&|`$<>\\]/.test(body.image)) {
      return fail(res, 400, 'image contains invalid characters', 'BAD_REQUEST');
    }
    patch.image = body.image.trim();
  }
  if (body.timeoutMinutes !== undefined) {
    const t = Number(body.timeoutMinutes);
    // [SECURITY] Bound timeout to [1, 240] minutes (4 hours).
    if (!Number.isFinite(t) || t <= 0 || t > 240) {
      return fail(res, 400, 'timeoutMinutes must be between 1 and 240', 'BAD_REQUEST');
    }
    patch.timeoutMinutes = t;
  }
  if (body.networkDisabled !== undefined) {
    patch.networkDisabled = body.networkDisabled === true || body.networkDisabled === 'true';
  }
  const updated = dockerService.updateTerminalConfig(patch);
  return ok(res, {
    cpus: updated.cpus,
    memory: formatMemory(updated.memory),
    image: updated.image,
    timeoutMinutes: updated.timeoutMinutes,
    networkDisabled: updated.networkDisabled,
  });
});

export default router;
