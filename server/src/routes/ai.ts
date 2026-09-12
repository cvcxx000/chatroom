import { Router, Response } from 'express';
import { ok, fail } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';
import { listActiveAiConfigs } from '../models/aiConfigModel';
import { getAiConfigById } from '../models/aiConfigModel';
import { createConversation } from '../models/conversationModel';
import { ensureAiAssistantUser } from '../services/ai';
import {
  listUserAiConfigs,
  getUserAiConfigById,
  createUserAiConfig,
  updateUserAiConfig,
  deleteUserAiConfig,
  toPublic,
} from '../models/userAiConfigModel';

const router = Router();

/**
 * GET /api/ai/providers (auth)
 * Prefer the current user's own active configs; fall back to admin global configs.
 * Never returns api_key.
 */
router.get('/providers', async (req: AuthedRequest, res: Response) => {
  const userConfigs = await listUserAiConfigs(req.user!.id);
  const activeUser = userConfigs.filter((c) => c.is_active);
  if (activeUser.length > 0) {
    return ok(
      res,
      activeUser.map((c) => ({ ...toPublic(c), scope: 'user' })),
    );
  }
  const configs = await listActiveAiConfigs();
  return ok(
    res,
    configs.map((c) => ({
      id: c.id,
      provider: c.provider,
      name: c.name,
      model: c.model,
      scope: 'global',
    })),
  );
});

/**
 * GET /api/ai/user-providers (auth) - list the current user's own AI configs.
 * Returns api_key masked (last 4 chars) so the UI can show it without leaking secrets.
 */
const listMyUserProviders = async (req: AuthedRequest, res: Response) => {
  const rows = await listUserAiConfigs(req.user!.id);
  return ok(
    res,
    rows.map((c) => ({
      ...toPublic(c),
      apiKeyMasked: c.api_key ? `***${c.api_key.slice(-4)}` : '',
    })),
  );
};

/**
 * POST /api/ai/user-providers (auth)
 * body: { provider, name, baseUrl, apiKey, model }
 */
const createMyUserProvider = async (req: AuthedRequest, res: Response) => {
  const { provider, name, baseUrl, apiKey, model } = req.body || {};
  if (!provider || !name || !baseUrl || !apiKey || !model) {
    return fail(res, 400, 'provider, name, baseUrl, apiKey, model required', 'BAD_REQUEST');
  }
  const row = await createUserAiConfig(req.user!.id, {
    provider: String(provider),
    name: String(name),
    baseUrl: String(baseUrl),
    apiKey: String(apiKey),
    model: String(model),
  });
  return ok(res, toPublic(row));
};

/**
 * PUT /api/ai/user-providers/:id (auth)
 */
const updateMyUserProvider = async (req: AuthedRequest, res: Response) => {
  const { provider, name, baseUrl, apiKey, model, isActive } = req.body || {};
  const row = await updateUserAiConfig(req.params.id, req.user!.id, {
    provider: provider !== undefined ? String(provider) : undefined,
    name: name !== undefined ? String(name) : undefined,
    baseUrl: baseUrl !== undefined ? String(baseUrl) : undefined,
    apiKey: apiKey !== undefined ? String(apiKey) : undefined,
    model: model !== undefined ? String(model) : undefined,
    isActive: isActive !== undefined ? Boolean(isActive) : undefined,
  });
  if (!row) return fail(res, 404, 'config not found', 'NOT_FOUND');
  return ok(res, toPublic(row));
};

/**
 * DELETE /api/ai/user-providers/:id (auth)
 */
const deleteMyUserProvider = async (req: AuthedRequest, res: Response) => {
  await deleteUserAiConfig(req.params.id, req.user!.id);
  return ok(res, { ok: true });
};

// Original /user-providers routes (kept for backward compatibility)
router.get('/user-providers', listMyUserProviders);
router.post('/user-providers', createMyUserProvider);
router.put('/user-providers/:id', updateMyUserProvider);
router.delete('/user-providers/:id', deleteMyUserProvider);

// Alias routes used by the frontend: /api/ai/providers/me (GET/POST) and /:id (PUT/DELETE)
router.get('/providers/me', listMyUserProviders);
router.post('/providers/me', createMyUserProvider);
router.put('/providers/me/:id', updateMyUserProvider);
router.delete('/providers/me/:id', deleteMyUserProvider);

/**
 * POST /api/ai/conversation (auth)
 * Body: { configId?, model? }
 * Creates a one-to-one conversation with the AI assistant.
 */
router.post('/conversation', async (req: AuthedRequest, res: Response) => {
  const { configId } = req.body || {};

  let config = null;
  if (configId) {
    config = await getAiConfigById(String(configId));
    if (!config) {
      // Maybe it's a user-level config
      const uc = await getUserAiConfigById(String(configId), req.user!.id);
      if (uc) {
        config = {
          id: uc.id,
          provider: uc.provider,
          name: uc.name,
          base_url: uc.base_url,
          api_key: uc.api_key,
          model: uc.model,
          is_active: uc.is_active,
          created_at: uc.created_at,
        };
      }
    }
    if (!config) return fail(res, 404, 'ai config not found', 'NOT_FOUND');
    if (!config.is_active) return fail(res, 400, 'ai config is inactive', 'INACTIVE');
  }

  const bot = await ensureAiAssistantUser();
  const conv = await createConversation({
    type: 'ai',
    name: 'AI 助手',
    createdBy: req.user!.id,
    memberIds: [bot.id],
  });

  return ok(res, {
    ...conv,
    configId: config ? config.id : null,
  });
});

export default router;
