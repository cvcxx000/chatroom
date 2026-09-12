import { Router, Response } from 'express';
import { ok, fail } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';
import { listActiveAiConfigs } from '../models/aiConfigModel';
import { getAiConfigById } from '../models/aiConfigModel';
import { createConversation } from '../models/conversationModel';
import { ensureAiAssistantUser } from '../services/ai';

const router = Router();

/**
 * GET /api/ai/providers (auth)
 * Active AI configs for display (never returns api_key).
 */
router.get('/providers', async (_req: AuthedRequest, res: Response) => {
  const configs = await listActiveAiConfigs();
  return ok(
    res,
    configs.map((c) => ({
      id: c.id,
      provider: c.provider,
      name: c.name,
      model: c.model,
    })),
  );
});

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
