import { Router, Response } from 'express';
import { ok, fail } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';
import {
  listConversationSettings,
  updateConversationSetting,
} from '../models/conversationSettingsModel';
import { isMember, findConversationById } from '../models/conversationModel';

const router = Router();

/** GET /api/conversation-settings - get all conversation settings for me. */
router.get('/', async (req: AuthedRequest, res: Response) => {
  const rows = await listConversationSettings(req.user!.id);
  return ok(res, rows);
});

/** PUT /api/conversation-settings/:conversationId - update settings. */
router.put('/:conversationId', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.conversationId);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const { isPinned, isMuted, isArchived } = req.body || {};
  const row = await updateConversationSetting(conv.id, req.user!.id, {
    isPinned: isPinned !== undefined ? Boolean(isPinned) : undefined,
    isMuted: isMuted !== undefined ? Boolean(isMuted) : undefined,
    isArchived: isArchived !== undefined ? Boolean(isArchived) : undefined,
  });
  return ok(res, row);
});

export default router;
