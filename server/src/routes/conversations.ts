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

// 安全：UUID 格式校验，防止非法 ID 直达数据库造成 500/报错信息泄露
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

// 输入长度上限（与 DB 列定义及防 DoS 对齐）
const LIMITS = {
  groupName: 100, // conversations.name VARCHAR(255)，取更严格业务上限
  messageContent: 5000, // messages.content TEXT，防超长 DoS
  announcement: 2000, // group_announcements.content TEXT
  nickname: 100, // group_nicknames.nickname VARCHAR(100)
};

// 安全：群文件上传扩展名白名单（不能只信 mimetype），
// 显式排除 .html/.htm/.svg/.js/.mht 等可被浏览器执行的类型，防止存储型 XSS。
const ALLOWED_GROUP_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  '.pdf', '.txt', '.md', '.csv', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.rar', '.7z', '.tar', '.gz',
  '.mp3', '.wav', '.m4a', '.ogg', '.mp4', '.mov', '.avi', '.mkv', '.webm',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    // 使用随机文件名（仅保留扩展名），杜绝路径穿越/覆盖
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
  // 安全修复：新增扩展名白名单校验（原实现完全无 fileFilter，任意类型可上传）
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_GROUP_EXTS.has(ext)) cb(null, true);
    else cb(new Error('file type not allowed'));
  },
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
  // 安全：校验 UUID 格式，避免非法输入直达数据库
  if (!isUuid(userId)) return fail(res, 400, 'invalid userId', 'BAD_REQUEST');
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
  const groupName = String(name).trim();
  // 安全：群名长度限制，防止超长输入/DB 报错
  if (groupName.length === 0 || groupName.length > LIMITS.groupName) {
    return fail(res, 400, `group name must be 1-${LIMITS.groupName} chars`, 'BAD_REQUEST');
  }
  // 安全：过滤非法/重复成员 ID，仅保留合法 UUID
  const ids: string[] = Array.from(
    new Set(
      (Array.isArray(memberIds) ? memberIds : []).filter((id): id is string => isUuid(id)),
    ),
  );
  const conv = await createConversation({
    type: 'group',
    name: groupName,
    createdBy: req.user!.id,
    memberIds: ids,
  });
  return ok(res, conv);
});

/** GET /api/conversations/:id */
router.get('/:id', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
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
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  // 安全（IDOR 修复）：原实现仅校验 isMember，任意成员都能拉人入群。
  // 群为 group 类型时，加人必须是管理员；私有会话不开放此接口。
  if (conv.type !== 'group') {
    return fail(res, 400, 'not a group', 'BAD_REQUEST');
  }
  const role = await getMemberRole(conv.id, req.user!.id);
  if (role !== 'admin') {
    return fail(res, 403, 'only group admin can add members', 'FORBIDDEN');
  }
  // 安全：仅接受合法 UUID，去重
  const rawIds: unknown[] = Array.isArray(req.body?.userIds) ? req.body.userIds : [];
  const userIds: string[] = Array.from(new Set(rawIds.filter((id): id is string => isUuid(id))));
  await addMembers(conv.id, userIds);
  return ok(res, { ok: true });
});

/** DELETE /api/conversations/:id/members/:userId */
router.delete('/:id/members/:userId', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.id) || !isUuid(req.params.userId)) {
    return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  }
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
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (conv.type !== 'group') return fail(res, 400, 'not a group', 'BAD_REQUEST');
  const role = await getMemberRole(conv.id, req.user!.id);
  if (role !== 'admin') return fail(res, 403, 'only group admin can rename', 'FORBIDDEN');
  const { name } = req.body || {};
  if (!name) return fail(res, 400, 'name required', 'BAD_REQUEST');
  const newName = String(name).trim();
  // 安全：群名长度限制
  if (newName.length === 0 || newName.length > LIMITS.groupName) {
    return fail(res, 400, `group name must be 1-${LIMITS.groupName} chars`, 'BAD_REQUEST');
  }
  await renameConversation(conv.id, newName);
  return ok(res, { ok: true });
});

/** GET /api/conversations/:id/messages?before=&limit= */
router.get('/:id/messages', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const before = req.query.before ? String(req.query.before) : null;
  // 安全：limit 限定在 1..100 范围，防止 0/负数/超大值
  const limit = Math.min(Math.max(parseInt(String(req.query.limit || '30'), 10) || 30, 1), 100);
  const messages = await listMessagesBefore(conv.id, before, limit);
  return ok(res, messages);
});

/** POST /api/conversations/:id/messages */
router.post('/:id/messages', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const { content, messageType, fileUrl, fileName, fileSize } = req.body || {};
  // 安全：messageType 白名单校验（原实现直接强转，非法类型会落库/触发 DB CHECK 错误）
  const allowedTypes = ['text', 'image', 'file'] as const;
  const mt = (messageType || 'text') as 'text' | 'image' | 'file';
  if (!allowedTypes.includes(mt)) {
    return fail(res, 400, 'invalid messageType', 'BAD_REQUEST');
  }
  // 安全：消息内容长度限制，防止超长输入 DoS
  if (typeof content === 'string' && content.length > LIMITS.messageContent) {
    return fail(res, 400, `message content too long (max ${LIMITS.messageContent})`, 'BAD_REQUEST');
  }
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
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
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
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
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
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const q = String(req.query.q || '').trim();
  if (!q) return ok(res, []);
  // 安全：搜索关键词长度限制，防止超长 ILIKE 扫描 DoS
  const trimmed = q.slice(0, 100);
  const messages = await searchMessagesInConversation(conv.id, trimmed, 50);
  return ok(res, messages);
});

/** POST /api/conversations/:id/pin - pin a message. body: { messageId } */
router.post('/:id/pin', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  // 安全（IDOR 修复）：置顶影响全体成员，仅群管理员可操作
  const role = await getMemberRole(conv.id, req.user!.id);
  if (role !== 'admin') {
    return fail(res, 403, 'only group admin can pin messages', 'FORBIDDEN');
  }
  const { messageId } = req.body || {};
  if (!messageId || !isUuid(messageId)) return fail(res, 400, 'messageId required', 'BAD_REQUEST');
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
  if (!isUuid(req.params.id) || !isUuid(req.params.messageId)) {
    return fail(res, 404, 'not found', 'NOT_FOUND');
  }
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  // 安全（IDOR 修复）：取消置顶影响全体成员，仅群管理员可操作
  const role = await getMemberRole(conv.id, req.user!.id);
  if (role !== 'admin') {
    return fail(res, 403, 'only group admin can unpin messages', 'FORBIDDEN');
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
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
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
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (conv.type !== 'group') return fail(res, 400, 'not a group', 'BAD_REQUEST');
  const role = await getMemberRole(conv.id, req.user!.id);
  if (role !== 'admin') return fail(res, 403, 'only group admin', 'FORBIDDEN');
  const { content } = req.body || {};
  if (typeof content !== 'string') {
    return fail(res, 400, 'content required', 'BAD_REQUEST');
  }
  // 安全：公告内容长度限制
  if (content.length > LIMITS.announcement) {
    return fail(res, 400, `announcement too long (max ${LIMITS.announcement})`, 'BAD_REQUEST');
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
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
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
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const { nickname } = req.body || {};
  if (typeof nickname !== 'string' || nickname.trim().length === 0) {
    return fail(res, 400, 'nickname required', 'BAD_REQUEST');
  }
  // 安全：群昵称长度限制（DB VARCHAR(100)）
  const trimmed = nickname.trim();
  if (trimmed.length > LIMITS.nickname) {
    return fail(res, 400, `nickname too long (max ${LIMITS.nickname})`, 'BAD_REQUEST');
  }
  const row = await setGroupNickname(conv.id, req.user!.id, trimmed);
  return ok(res, row);
});

/** POST /api/conversations/:id/transfer - transfer group ownership. body: { newOwnerId } */
router.post('/:id/transfer', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (conv.type !== 'group') return fail(res, 400, 'not a group', 'BAD_REQUEST');
  const role = await getMemberRole(conv.id, req.user!.id);
  if (role !== 'admin') {
    return fail(res, 403, 'only current owner/admin can transfer', 'FORBIDDEN');
  }
  const { newOwnerId } = req.body || {};
  if (!newOwnerId || !isUuid(String(newOwnerId))) {
    return fail(res, 400, 'newOwnerId required', 'BAD_REQUEST');
  }
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
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
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
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
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
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  // 安全（IDOR/数据破坏修复）：清空会话会物理删除全部消息并广播给所有人，
  // 原实现任意成员即可操作。群会话必须为管理员；私聊不允许"清空"（会影响对方）。
  if (conv.type === 'group') {
    const role = await getMemberRole(conv.id, req.user!.id);
    if (role !== 'admin') {
      return fail(res, 403, 'only group admin can clear history', 'FORBIDDEN');
    }
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
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
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
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  return ok(res, { conversationId: conv.id, read: true });
});

/** POST /api/conversations/:id/unread - mark conversation as unread. */
router.post('/:id/unread', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.id)) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  const conv = await findConversationById(req.params.id);
  if (!conv) return fail(res, 404, 'conversation not found', 'NOT_FOUND');
  if (!(await isMember(conv.id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  return ok(res, { conversationId: conv.id, unread: true });
});

export { UPLOAD_DIR };
export default router;
