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
  listRecentMessages,
  updateMessageContent,
  searchMessagesInConversation,
  getMessageById,
  clearMessagesInConversation,
} from '../models/messageModel';
import {
  createGroupFile,
  listGroupFiles,
} from '../models/groupFileModel';
import { findUserById, toSafeUser } from '../models/userModel';
import { broadcastToConversation } from '../websocket/hub';
import { Conversation, Message } from '../models/types';
import {
  ensureAiAssistantUser,
  getActiveAiConfig,
  callAiStream,
  ChatMessage,
} from '../services/ai';
import {
  pinMessage,
  unpinMessage,
  listPinnedMessages,
} from '../models/pinnedMessageModel';
import {
  setAnnouncement,
  getLatestAnnouncement,
} from '../models/groupAnnouncementModel';
import { setGroupNickname } from '../models/groupNicknameModel';
import {
  transferGroupOwnership,
  deleteConversation,
  countAdminsInConversation,
  setMemberRole,
} from '../models/conversationModel';

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

/**
 * Build the prompt history and stream an AI reply into the conversation.
 * Runs in the background; never throws into the request path.
 */
async function triggerAiReply(conv: Conversation): Promise<void> {
  let placeholder: Message | null = null;
  try {
    const bot = await ensureAiAssistantUser();
    const botSafe = toSafeUser(bot);

    const history = await listRecentMessages(conv.id, 20);
    const messages: ChatMessage[] = history
      .filter((m) => m.content && m.content.trim().length > 0)
      .map((m) => ({
        role: m.sender_id === bot.id ? 'assistant' : 'user',
        content: m.content as string,
      }));
    messages.unshift({
      role: 'system',
      content: '你是一个友好、简洁的聊天助手，用中文回答用户的问题。',
    });

    const config = await getActiveAiConfig();
    if (!config) {
      const aiMsg = await createMessage({
        conversationId: conv.id,
        senderId: bot.id,
        content: '未配置 AI API Key，请联系管理员在后台配置。',
        messageType: 'text',
      });
      await broadcastToConversation(conv.id, {
        type: 'new_message',
        conversationId: conv.id,
        message: { ...aiMsg, sender: botSafe },
      });
      return;
    }

    // Placeholder message; deltas stream in, final content persisted on done.
    placeholder = await createMessage({
      conversationId: conv.id,
      senderId: bot.id,
      content: '',
      messageType: 'text',
    });
    const ph = placeholder;
    await broadcastToConversation(conv.id, {
      type: 'ai_stream',
      conversationId: conv.id,
      messageId: ph.id,
      delta: '',
      sender: botSafe,
    });

    await callAiStream(
      config,
      messages,
      (delta) => {
        broadcastToConversation(conv.id, {
          type: 'ai_stream',
          conversationId: conv.id,
          messageId: ph.id,
          delta,
        });
      },
      async (finalText) => {
        try {
          const text = finalText || '（无回复内容）';
          const saved = await updateMessageContent(ph.id, text);
          await broadcastToConversation(conv.id, {
            type: 'ai_stream',
            conversationId: conv.id,
            messageId: ph.id,
            done: true,
            message: saved || ph,
          });
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error('[ai] finalize failed', e);
        }
      },
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[ai] reply failed', e);
    // Surface a friendly error in the placeholder message instead of leaving it empty.
    if (placeholder) {
      try {
        const saved = await updateMessageContent(
          placeholder.id,
          'AI 服务暂时不可用，请稍后重试或联系管理员。',
        );
        await broadcastToConversation(conv.id, {
          type: 'ai_stream',
          conversationId: conv.id,
          messageId: placeholder.id,
          done: true,
          error: true,
          message: saved || placeholder,
        });
      } catch (e2) {
        // eslint-disable-next-line no-console
        console.error('[ai] error fallback failed', e2);
      }
    }
  }
}

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

  // Trigger an AI reply for AI conversations, or when a group mentions @AI.
  const text = typeof content === 'string' ? content : '';
  const mentionedAi = /@ai\b/i.test(text.trim());
  const shouldReply =
    mt === 'text' &&
    text.trim().length > 0 &&
    (conv.type === 'ai' || (conv.type === 'group' && mentionedAi));
  if (shouldReply) {
    // Fire-and-forget; the HTTP response returns immediately.
    void triggerAiReply(conv);
  }

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

// ============================================================
// Message search / pin (conversation-scoped)
// ============================================================

/** GET /api/conversations/:id/search?q= - search messages in conversation. */
router.get('/:id/search', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const q = String(req.query.q || '').trim();
  if (!q) return ok(res, []);
  const messages = await searchMessagesInConversation(conv.id, q, 50);
  return ok(res, messages);
});

/** POST /api/conversations/:id/pin - pin a message. body: { messageId } */
router.post('/:id/pin', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const { messageId } = req.body || {};
  if (!messageId) return fail(res, 400, 'messageId required', 'BAD_REQUEST');
  const msg = await getMessageById(String(messageId));
  if (!msg || msg.conversation_id !== conv.id) {
    return fail(res, 404, 'message not found in this conversation', 'NOT_FOUND');
  }
  const pinned = await pinMessage(conv.id, msg.id, req.user!.id);
  await broadcastToConversation(conv.id, {
    type: 'message_pinned',
    conversationId: conv.id,
    messageId: msg.id,
    pinnedBy: req.user!.id,
  });
  return ok(res, pinned);
});

/** DELETE /api/conversations/:id/pin/:messageId - unpin a message. */
router.delete('/:id/pin/:messageId', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  await unpinMessage(conv.id, req.params.messageId);
  await broadcastToConversation(conv.id, {
    type: 'message_unpinned',
    conversationId: conv.id,
    messageId: req.params.messageId,
  });
  return ok(res, { ok: true });
});

/** GET /api/conversations/:id/pinned - list pinned messages. */
router.get('/:id/pinned', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const pinned = await listPinnedMessages(conv.id);
  const messages = [];
  for (const p of pinned) {
    const m = await getMessageById(p.message_id);
    if (m) messages.push({ ...p, message: m });
  }
  return ok(res, messages);
});

// ============================================================
// Group management
// ============================================================

/** PUT /api/conversations/:id/announcement - set group announcement (admin). */
router.put('/:id/announcement', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (conv.type !== 'group') return fail(res, 400, 'not a group', 'BAD_REQUEST');
  const role = await getMemberRole(conv.id, req.user!.id);
  if (role !== 'admin') return fail(res, 403, 'only group admin', 'FORBIDDEN');
  const { content } = req.body || {};
  if (typeof content !== 'string') {
    return fail(res, 400, 'content required', 'BAD_REQUEST');
  }
  const ann = await setAnnouncement(conv.id, content, req.user!.id);
  await broadcastToConversation(conv.id, {
    type: 'announcement_updated',
    conversationId: conv.id,
    announcement: ann,
  });
  return ok(res, ann);
});

/** GET /api/conversations/:id/announcement - get latest group announcement. */
router.get('/:id/announcement', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const ann = await getLatestAnnouncement(conv.id);
  return ok(res, ann);
});

/** PUT /api/conversations/:id/nickname - set my group nickname. */
router.put('/:id/nickname', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const { nickname } = req.body || {};
  if (typeof nickname !== 'string' || nickname.trim().length === 0) {
    return fail(res, 400, 'nickname required', 'BAD_REQUEST');
  }
  const row = await setGroupNickname(conv.id, req.user!.id, nickname.trim());
  return ok(res, row);
});

/** POST /api/conversations/:id/transfer - transfer group ownership. body: { newOwnerId } */
router.post('/:id/transfer', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (conv.type !== 'group') return fail(res, 400, 'not a group', 'BAD_REQUEST');
  const role = await getMemberRole(conv.id, req.user!.id);
  if (role !== 'admin') {
    return fail(res, 403, 'only current owner/admin can transfer', 'FORBIDDEN');
  }
  const { newOwnerId } = req.body || {};
  if (!newOwnerId) return fail(res, 400, 'newOwnerId required', 'BAD_REQUEST');
  const newOwner = await findUserById(String(newOwnerId));
  if (!newOwner) return fail(res, 404, 'new owner not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, newOwner.id))) {
    return fail(res, 400, 'new owner is not a member', 'BAD_REQUEST');
  }
  await transferGroupOwnership(conv.id, req.user!.id, newOwner.id);
  await broadcastToConversation(conv.id, {
    type: 'ownership_transferred',
    conversationId: conv.id,
    oldOwnerId: req.user!.id,
    newOwnerId: newOwner.id,
  });
  return ok(res, { ok: true });
});

/** POST /api/conversations/:id/leave - leave a group. */
router.post('/:id/leave', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (conv.type !== 'group') return fail(res, 400, 'not a group', 'BAD_REQUEST');
  const role = await getMemberRole(conv.id, req.user!.id);
  if (!role) return fail(res, 403, 'not a member', 'FORBIDDEN');
  // If the last admin leaves, promote another member if any.
  if (role === 'admin') {
    const adminCount = await countAdminsInConversation(conv.id);
    if (adminCount <= 1) {
      const members = await getMembers(conv.id);
      const other = members.find((m) => m.user_id !== req.user!.id);
      if (other) {
        await setMemberRole(conv.id, other.user_id, 'admin');
      }
    }
  }
  await removeMember(conv.id, req.user!.id);
  await broadcastToConversation(conv.id, {
    type: 'member_left',
    conversationId: conv.id,
    userId: req.user!.id,
  });
  return ok(res, { ok: true });
});

/** GET /api/conversations/:id/qrcode - get group invite QR token. */
router.get('/:id/qrcode', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const token = crypto.randomBytes(24).toString('hex');
  const payload = JSON.stringify({ t: 'group_invite', c: conv.id, token });
  return ok(res, { token, payload, conversationId: conv.id });
});

/** POST /api/conversations/:id/clear - clear chat history. */
router.post('/:id/clear', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  await clearMessagesInConversation(conv.id);
  await broadcastToConversation(conv.id, {
    type: 'conversation_cleared',
    conversationId: conv.id,
  });
  return ok(res, { ok: true });
});

/** DELETE /api/conversations/:id - delete conversation / leave. */
router.delete('/:id', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  // For groups: just remove membership. For private/ai: hard-delete.
  if (conv.type === 'group') {
    await removeMember(conv.id, req.user!.id);
  } else {
    await deleteConversation(conv.id);
  }
  return ok(res, { ok: true });
});

/** POST /api/conversations/:id/read - mark conversation as read. */
router.post('/:id/read', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  return ok(res, { conversationId: conv.id, read: true });
});

/** POST /api/conversations/:id/unread - mark conversation as unread. */
router.post('/:id/unread', async (req: AuthedRequest, res: Response) => {
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  return ok(res, { conversationId: conv.id, unread: true });
});

export { UPLOAD_DIR };
export default router;
