import { Router, Response } from 'express';
import { ok, fail } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';
import {
  startTemp,
  getTempMessages,
  addTempMessage,
  isParticipant,
} from '../temp/store';
import { findUserById } from '../models/userModel';

const router = Router();

/** POST /api/temp/start */
router.post('/start', async (req: AuthedRequest, res: Response) => {
  const { userId } = req.body || {};
  if (!userId) return fail(res, 400, 'userId required', 'BAD_REQUEST');
  if (userId === req.user!.id) return fail(res, 400, 'cannot temp-chat yourself', 'BAD_REQUEST');
  const other = await findUserById(userId);
  if (!other) return fail(res, 404, 'user not found', 'NOT_FOUND');
  const result = startTemp(req.user!.id, userId);
  return ok(res, result);
});

/** GET /api/temp/:tempId */
router.get('/:tempId', async (req: AuthedRequest, res: Response) => {
  if (!isParticipant(req.params.tempId, req.user!.id)) {
    return fail(res, 403, 'not a participant', 'FORBIDDEN');
  }
  const messages = getTempMessages(req.params.tempId);
  return ok(res, { tempId: req.params.tempId, messages });
});

/** POST /api/temp/:tempId/send */
router.post('/:tempId/send', async (req: AuthedRequest, res: Response) => {
  if (!isParticipant(req.params.tempId, req.user!.id)) {
    return fail(res, 403, 'not a participant', 'FORBIDDEN');
  }
  const { content } = req.body || {};
  if (!content) return fail(res, 400, 'content required', 'BAD_REQUEST');
  const text = String(content);
  // [SECURITY] Enforce a reasonable message length to prevent abuse/DoS.
  if (text.length > 5000) {
    return fail(res, 400, 'message too long (max 5000 chars)', 'BAD_REQUEST');
  }
  const result = addTempMessage(req.params.tempId, req.user!.id, text);
  if (!result) return fail(res, 404, 'temp conversation not found or expired', 'TEMP_EXPIRED');
  return ok(res, result);
});

export default router;
