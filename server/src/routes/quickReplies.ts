import { Router, Response } from 'express';
import { ok, fail } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';
import {
  listQuickReplies,
  createQuickReply,
  updateQuickReply,
  deleteQuickReply,
} from '../models/quickReplyModel';

const router = Router();

/** GET /api/quick-replies */
router.get('/', async (req: AuthedRequest, res: Response) => {
  const rows = await listQuickReplies(req.user!.id);
  return ok(res, rows);
});

/** POST /api/quick-replies body: { title, content } */
router.post('/', async (req: AuthedRequest, res: Response) => {
  const { title, content } = req.body || {};
  if (!title || !content) {
    return fail(res, 400, 'title and content required', 'BAD_REQUEST');
  }
  // [SECURITY] Enforce length limits.
  if (String(title).length > 100) {
    return fail(res, 400, 'title too long (max 100 chars)', 'BAD_REQUEST');
  }
  if (String(content).length > 5000) {
    return fail(res, 400, 'content too long (max 5000 chars)', 'BAD_REQUEST');
  }
  const row = await createQuickReply(req.user!.id, String(title), String(content));
  return ok(res, row);
});

/** PUT /api/quick-replies/:id */
router.put('/:id', async (req: AuthedRequest, res: Response) => {
  const { title, content } = req.body || {};
  // [SECURITY] Enforce length limits on updates.
  if (title !== undefined && String(title).length > 100) {
    return fail(res, 400, 'title too long (max 100 chars)', 'BAD_REQUEST');
  }
  if (content !== undefined && String(content).length > 5000) {
    return fail(res, 400, 'content too long (max 5000 chars)', 'BAD_REQUEST');
  }
  const row = await updateQuickReply(req.params.id, req.user!.id, {
    title: title !== undefined ? String(title) : undefined,
    content: content !== undefined ? String(content) : undefined,
  });
  if (!row) return fail(res, 404, 'quick reply not found', 'NOT_FOUND');
  return ok(res, row);
});

/** DELETE /api/quick-replies/:id */
router.delete('/:id', async (req: AuthedRequest, res: Response) => {
  await deleteQuickReply(req.params.id, req.user!.id);
  return ok(res, { ok: true });
});

export default router;
