import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { ok, fail } from '../utils/response';
import { AuthedRequest, requireAuth } from '../middleware/auth';
import { query } from '../config/db';
import {
  findShareLinkByToken,
  createShareLink,
  listShareLinksByConversation,
  deleteShareLinkByToken,
} from '../models/sharedLinkModel';
import { findConversationById, isMember, addMembers } from '../models/conversationModel';
import { SharedLink } from '../models/types';

const router = Router();

interface ShareLinkInfo {
  id: string;
  conversation_id: string;
  token: string;
  expires_at: Date;
  created_by: string | null;
  created_at: Date;
  has_password: boolean;
}

function publicView(link: SharedLink): ShareLinkInfo {
  return {
    id: link.id,
    conversation_id: link.conversation_id,
    token: link.token,
    expires_at: link.expires_at,
    created_by: link.created_by,
    created_at: link.created_at,
    has_password: Boolean(link.password_hash),
  };
}

/**
 * POST /api/share/generate (auth)
 * Body: { conversationId, expiresInHours?, password? }
 */
router.post('/generate', requireAuth, async (req: AuthedRequest, res: Response) => {
  const { conversationId, expiresInHours, password } = req.body || {};
  if (!conversationId) return fail(res, 400, 'conversationId required', 'BAD_REQUEST');

  const conv = await findConversationById(String(conversationId));
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member of this conversation', 'FORBIDDEN');
  }

  const hours = Number(expiresInHours) > 0 ? Number(expiresInHours) : 24;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  const token = crypto.randomBytes(24).toString('hex');

  let passwordHash: string | null = null;
  if (password) {
    passwordHash = await bcrypt.hash(String(password), 10);
  }

  const link = await createShareLink({
    conversationId: conv.id,
    token,
    expiresAt,
    passwordHash,
    createdBy: req.user!.id,
  });

  return ok(res, {
    token,
    url: `/share/${token}`,
    expiresAt: link.expires_at,
    hasPassword: Boolean(passwordHash),
  });
});

/**
 * GET /api/share/:token (public)
 * Returns lightweight metadata; never returns conversation content.
 */
router.get('/:token', async (req, res) => {
  const link = await findShareLinkByToken(req.params.token);
  if (!link) return fail(res, 404, 'share link not found', 'NOT_FOUND');
  if (new Date(link.expires_at).getTime() <= Date.now()) {
    return fail(res, 410, 'share link expired', 'EXPIRED');
  }
  const conv = await findConversationById(link.conversation_id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  return ok(res, {
    conversationId: conv.id,
    type: conv.type,
    name: conv.name,
    requiresPassword: Boolean(link.password_hash),
    expiresAt: link.expires_at,
  });
});

/**
 * POST /api/share/:token/join (auth)
 * Body: { password? }
 * Adds the current user as a member of the shared conversation.
 */
router.post('/:token/join', requireAuth, async (req: AuthedRequest, res: Response) => {
  const link = await findShareLinkByToken(req.params.token);
  if (!link) return fail(res, 404, 'share link not found', 'NOT_FOUND');
  if (new Date(link.expires_at).getTime() <= Date.now()) {
    return fail(res, 410, 'share link expired', 'EXPIRED');
  }

  if (link.password_hash) {
    const password = req.body?.password;
    if (!password) return fail(res, 400, 'password required', 'PASSWORD_REQUIRED');
    const match = await bcrypt.compare(String(password), link.password_hash);
    if (!match) return fail(res, 403, 'wrong password', 'WRONG_PASSWORD');
  }

  const conv = await findConversationById(link.conversation_id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');

  if (!(await isMember(conv.id, req.user!.id))) {
    await addMembers(conv.id, [req.user!.id]);
  }
  return ok(res, { conversationId: conv.id, joined: true });
});

/**
 * GET /api/share/list/:conversationId (auth)
 * Lists active share links for a conversation (members can see).
 */
router.get('/list/:conversationId', requireAuth, async (req: AuthedRequest, res: Response) => {
  const convId = req.params.conversationId;
  const conv = await findConversationById(convId);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member of this conversation', 'FORBIDDEN');
  }
  const links = await listShareLinksByConversation(conv.id);
  return ok(res, links.map(publicView));
});

/**
 * DELETE /api/share/:token (auth)
 * Only the creator may delete.
 */
router.delete('/:token', requireAuth, async (req: AuthedRequest, res: Response) => {
  const link = await findShareLinkByToken(req.params.token);
  if (!link) return fail(res, 404, 'share link not found', 'NOT_FOUND');
  if (link.created_by !== req.user!.id) {
    return fail(res, 403, 'only the creator can delete this link', 'FORBIDDEN');
  }
  await deleteShareLinkByToken(link.token);
  return ok(res, { ok: true });
});

export default router;
