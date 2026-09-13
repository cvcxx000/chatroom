import { Router, Response } from 'express';
import { ok, fail } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';
import {
  getMessageById,
  editMessageContent,
  deleteMessageById,
  createMessage,
} from '../models/messageModel';
import {
  findConversationById,
  isMember,
  getMemberRole,
} from '../models/conversationModel';
import {
  toggleReaction,
  removeReaction,
  listReactionsForMessage,
} from '../models/reactionModel';
import { broadcastToConversation } from '../websocket/hub';
import { toSafeUser } from '../models/userModel';

const router = Router();

const EDIT_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const DELETE_FOR_EVERYONE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

// 安全：UUID 格式校验，避免非法 ID 直达数据库
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
// emoji 列 DB 为 VARCHAR(32)
const MAX_EMOJI_LEN = 32;

/** PUT /api/messages/:id - Edit own message within 5 minutes. */
router.put('/:id', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 404, 'message not found', 'NOT_FOUND');
  const msg = await getMessageById(req.params.id);
  if (!msg) return fail(res, 404, 'message not found', 'NOT_FOUND');
  if (msg.sender_id !== req.user!.id) {
    return fail(res, 403, 'can only edit your own messages', 'FORBIDDEN');
  }
  const age = Date.now() - new Date(msg.created_at).getTime();
  if (age > EDIT_WINDOW_MS) {
    return fail(res, 400, 'message edit window expired (5 minutes)', 'EDIT_WINDOW_EXPIRED');
  }
  const { content } = req.body || {};
  if (typeof content !== 'string' || content.trim().length === 0) {
    return fail(res, 400, 'content required', 'BAD_REQUEST');
  }
  // 安全：编辑内容长度限制，与发送一致防超长
  if (content.length > 5000) {
    return fail(res, 400, 'content too long (max 5000)', 'BAD_REQUEST');
  }
  const updated = await editMessageContent(msg.id, content);
  await broadcastToConversation(msg.conversation_id, {
    type: 'message_updated',
    conversationId: msg.conversation_id,
    message: updated,
  });
  return ok(res, updated);
});

/** DELETE /api/messages/:id - Delete message. body: { forEveryone: boolean } */
router.delete('/:id', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 404, 'message not found', 'NOT_FOUND');
  const msg = await getMessageById(req.params.id);
  if (!msg) return fail(res, 404, 'message not found', 'NOT_FOUND');
  const { forEveryone } = req.body || {};
  const isPlatformAdmin = req.user!.is_admin;
  // 安全（IDOR 修复）：删除他人消息需为发送者、平台管理员，或该群的群管理员。
  // 原实现只判断 req.user.is_admin（全局），群管理员无法合规删除。
  const role = await getMemberRole(msg.conversation_id, req.user!.id);
  const isGroupAdmin = role === 'admin';
  if (msg.sender_id !== req.user!.id && !isPlatformAdmin && !isGroupAdmin) {
    return fail(res, 403, 'can only delete your own messages', 'FORBIDDEN');
  }
  if (forEveryone) {
    const age = Date.now() - new Date(msg.created_at).getTime();
    if (age > DELETE_FOR_EVERYONE_WINDOW_MS) {
      return fail(
        res,
        400,
        'delete-for-everyone window expired (2 minutes)',
        'DELETE_WINDOW_EXPIRED',
      );
    }
    await deleteMessageById(msg.id);
    await broadcastToConversation(msg.conversation_id, {
      type: 'message_deleted',
      conversationId: msg.conversation_id,
      messageId: msg.id,
      forEveryone: true,
    });
    return ok(res, { deleted: true, forEveryone: true });
  }
  // "Delete for me" only: no hard delete, just acknowledge (client hides it).
  return ok(res, { deleted: true, forEveryone: false });
});

/** POST /api/messages/:id/reactions - Add/toggle reaction. body: { emoji } */
router.post('/:id/reactions', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 404, 'message not found', 'NOT_FOUND');
  const msg = await getMessageById(req.params.id);
  if (!msg) return fail(res, 404, 'message not found', 'NOT_FOUND');
  if (!(await isMember(msg.conversation_id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const { emoji } = req.body || {};
  if (!emoji || typeof emoji !== 'string') {
    return fail(res, 400, 'emoji required', 'BAD_REQUEST');
  }
  // 安全：emoji 长度限制（DB VARCHAR(32)）
  if (emoji.length > MAX_EMOJI_LEN) {
    return fail(res, 400, 'emoji too long', 'BAD_REQUEST');
  }
  const { added } = await toggleReaction(msg.id, req.user!.id, emoji);
  const reactions = await listReactionsForMessage(msg.id);
  await broadcastToConversation(msg.conversation_id, {
    type: 'message_reaction',
    conversationId: msg.conversation_id,
    messageId: msg.id,
    userId: req.user!.id,
    emoji,
    added,
  });
  return ok(res, { added, reactions });
});

/** DELETE /api/messages/:id/reactions/:emoji - Remove reaction. */
router.delete('/:id/reactions/:emoji', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 404, 'message not found', 'NOT_FOUND');
  const msg = await getMessageById(req.params.id);
  if (!msg) return fail(res, 404, 'message not found', 'NOT_FOUND');
  // 安全（IDOR 修复）：原实现未校验会话成员，任何登录用户都可对任意消息发起删除反应请求。
  if (!(await isMember(msg.conversation_id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const emoji = req.params.emoji;
  if (!emoji || emoji.length > MAX_EMOJI_LEN) {
    return fail(res, 400, 'invalid emoji', 'BAD_REQUEST');
  }
  await removeReaction(msg.id, req.user!.id, emoji);
  const reactions = await listReactionsForMessage(msg.id);
  await broadcastToConversation(msg.conversation_id, {
    type: 'message_reaction',
    conversationId: msg.conversation_id,
    messageId: msg.id,
    userId: req.user!.id,
    emoji,
    added: false,
  });
  return ok(res, { reactions });
});

/** POST /api/messages/:id/forward - Forward message. body: { targetConversationId } */
router.post('/:id/forward', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 404, 'message not found', 'NOT_FOUND');
  const msg = await getMessageById(req.params.id);
  if (!msg) return fail(res, 404, 'message not found', 'NOT_FOUND');
  if (!(await isMember(msg.conversation_id, req.user!.id))) {
    return fail(res, 403, 'not a member of source conversation', 'FORBIDDEN');
  }
  const { targetConversationId } = req.body || {};
  if (!targetConversationId || !isUuid(String(targetConversationId))) {
    return fail(res, 400, 'targetConversationId required', 'BAD_REQUEST');
  }
  const target = await findConversationById(String(targetConversationId));
  if (!target) return fail(res, 404, 'target conversation not found', 'NOT_FOUND');
  if (!(await isMember(target.id, req.user!.id))) {
    return fail(res, 403, 'not a member of target conversation', 'FORBIDDEN');
  }
  const forwarded = await createMessage({
    conversationId: target.id,
    senderId: req.user!.id,
    content: msg.content,
    messageType: msg.message_type,
    fileUrl: msg.file_url,
    fileName: msg.file_name,
    fileSize: msg.file_size != null ? Number(msg.file_size) : null,
  });
  await broadcastToConversation(target.id, {
    type: 'new_message',
    conversationId: target.id,
    message: { ...forwarded, sender: toSafeUser(req.user!) },
  });
  return ok(res, forwarded);
});

export default router;
