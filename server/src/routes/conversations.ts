import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import crypto from 'crypto';
import { ok, fail } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';
import { env } from '../config/env';
import {
  createConversation,
  findConversationById,
  isMember,
  getMembers,
  addMembers,
  removeMember,
  renameConversation,
  getMemberRole,
  findPrivateConversationBetween,
  listConversations,
  getLastMessage,
} from '../models/conversationModel';
import {
  createMessage,
  listMessagesBefore,
} from '../models/messageModel';
import {
  createGroupFile,
  listGroupFiles,
} from '../models/groupFileModel';
import { findUserById, toSafeUser } from '../models/userModel';
import { broadcastToConversation } from '../websocket/hub';

const router = Router();

const UPLOAD_DIR = path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
});

/** GET /api/conversations */
router.get('/', async (req: AuthedRequest, res: Response) => {
  const convs = await listConversations(req.user!.id);
  const result = [];
  for (const c of convs) {
    const last = await getLastMessage(c.id);
    const members = await getMembers(c.id);
    result.push({
      id: c.id,
      type: c.type,
      name: c.name,
      createdAt: c.created_at,
      lastMessage: last,
      members: members.map((m) => ({
        userId: m.user_id,
        username: m.username,
        displayName: m.display_name,
        avatarUrl: m.avatar_url,
        role: m.role,
      })),
    });
  }
  return ok(res, result);
});

/** POST /api/conversations/private */
router.post('/private', async (req: AuthedRequest, res: Response) => {
  const { userId } = req.body || {};
  if (!userId) return fail(res, 400, 'userId required', 'BAD_REQUEST');
  const other = await findUserById(userId);
  if (!other) return fail(res, 404, 'user not found', 'NOT_FOUND');
  const existing = await findPrivateConversationBetween(req.user!.id, userId);
  if (existing) return ok(res, existing);
  const conv = await createConversation({
    type: 'private',
    createdBy: req.user!.id,
    memberIds: [userId],
  });
  return ok(res, conv);
});

/** POST /api/conversations/group */
router.post('/group', async (req: AuthedRequest, res: Response) => {
  const { name, memberIds } = req.body || {};
  if (!name) return fail(res, 400, 'name required', 'BAD_REQUEST');
  const ids: string[] = Array.isArray(memberIds) ? memberIds : [];
  const conv = await createConversation({
    type: 'group',
    name: String(name),
    createdBy: req.user!.id,
    memberIds: ids,
  });
  return ok(res, conv);
});

/** GET /api/conversations/:id */
router.get('/:id', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const members = await getMembers(conv.id);
  return ok(res, {
    ...conv,
    members: members.map((m) => ({
      userId: m.user_id,
      username: m.username,
      displayName: m.display_name,
      avatarUrl: m.avatar_url,
      role: m.role,
      joinedAt: m.joined_at,
    })),
  });
});

/** POST /api/conversations/:id/members */
router.post('/:id/members', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const userIds: string[] = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
  await addMembers(conv.id, userIds);
  return ok(res, { ok: true });
});

/** DELETE /api/conversations/:id/members/:userId */
router.delete('/:id/members/:userId', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  const role = await getMemberRole(conv.id, req.user!.id);
  if (!role) return fail(res, 403, 'not a member', 'FORBIDDEN');
  if (role !== 'admin' && req.params.userId !== req.user!.id) {
    return fail(res, 403, 'only group admin can remove others', 'FORBIDDEN');
  }
  await removeMember(conv.id, req.params.userId);
  return ok(res, { ok: true });
});

/** PUT /api/conversations/:id (rename group) */
router.put('/:id', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (conv.type !== 'group') return fail(res, 400, 'not a group', 'BAD_REQUEST');
  const role = await getMemberRole(conv.id, req.user!.id);
  if (role !== 'admin') return fail(res, 403, 'only group admin can rename', 'FORBIDDEN');
  const { name } = req.body || {};
  if (!name) return fail(res, 400, 'name required', 'BAD_REQUEST');
  await renameConversation(conv.id, String(name));
  return ok(res, { ok: true });
});

/** GET /api/conversations/:id/messages?before=&limit= */
router.get('/:id/messages', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const before = req.query.before ? String(req.query.before) : null;
  const limit = Math.min(parseInt(String(req.query.limit || '30'), 10) || 30, 100);
  const messages = await listMessagesBefore(conv.id, before, limit);
  return ok(res, messages);
});

/** POST /api/conversations/:id/messages */
router.post('/:id/messages', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const { content, messageType, fileUrl, fileName, fileSize } = req.body || {};
  const mt = (messageType || 'text') as 'text' | 'image' | 'file';
  const msg = await createMessage({
    conversationId: conv.id,
    senderId: req.user!.id,
    content: content || null,
    messageType: mt,
    fileUrl: fileUrl || null,
    fileName: fileName || null,
    fileSize: fileSize != null ? Number(fileSize) : null,
  });
  await broadcastToConversation(conv.id, {
    type: 'new_message',
    conversationId: conv.id,
    message: { ...msg, sender: toSafeUser(req.user!) },
  });
  return ok(res, msg);
});

/** GET /api/conversations/:id/files */
router.get('/:id/files', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const files = await listGroupFiles(conv.id);
  return ok(res, files);
});

/** POST /api/conversations/:id/files (multipart upload) */
router.post('/:id/files', upload.single('file'), async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  if (!req.file) return fail(res, 400, 'no file uploaded', 'NO_FILE');
  const fileUrl = `/uploads/${req.file.filename}`;
  const gf = await createGroupFile({
    conversationId: conv.id,
    uploaderId: req.user!.id,
    fileName: req.file.originalname,
    fileUrl,
    fileSize: req.file.size,
    fileType: req.file.mimetype,
  });
  return ok(res, gf);
});

export { UPLOAD_DIR };
export default router;
