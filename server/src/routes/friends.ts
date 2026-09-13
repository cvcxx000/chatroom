import { Router, Response } from 'express';
import { ok, fail } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';
import { findUserById, toSafeUser } from '../models/userModel';
import {
  findFriendshipBetween,
  getFriendshipById,
  createFriendRequest,
  updateFriendshipStatus,
  deleteFriendshipBetween,
  listFriends,
  listPendingRequests,
} from '../models/friendshipModel';
import { sendToUser } from '../websocket/hub';

const router = Router();

// 安全：UUID 格式校验（friendship 的 user/friend 均为 UUID）
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
// friendship.id 为 SERIAL 正整数
const isPosInt = (v: unknown): boolean => Number.isInteger(v) && (v as number) > 0;

/** GET /api/friends */
router.get('/', async (req: AuthedRequest, res: Response) => {
  const friends = await listFriends(req.user!.id);
  return ok(res, friends.map(toSafeUser));
});

/** GET /api/friends/requests */
router.get('/requests', async (req: AuthedRequest, res: Response) => {
  const pending = await listPendingRequests(req.user!.id);
  return ok(res, pending);
});

/** POST /api/friends/request */
router.post('/request', async (req: AuthedRequest, res: Response) => {
  const { userId } = req.body || {};
  if (!userId) return fail(res, 400, 'userId required', 'BAD_REQUEST');
  if (!isUuid(userId)) return fail(res, 400, 'invalid userId', 'BAD_REQUEST');
  if (userId === req.user!.id) return fail(res, 400, 'cannot add yourself', 'BAD_REQUEST');
  const target = await findUserById(userId);
  if (!target) return fail(res, 404, 'user not found', 'NOT_FOUND');
  const existing = await findFriendshipBetween(req.user!.id, userId);
  if (existing) {
    if (existing.status === 'accepted') return fail(res, 409, 'already friends', 'ALREADY_FRIENDS');
    if (existing.status === 'pending') return fail(res, 409, 'request already pending', 'ALREADY_REQUESTED');
  }
  const fr = await createFriendRequest(req.user!.id, userId);
  sendToUser(userId, {
    type: 'friend_request',
    fromUser: toSafeUser(req.user!),
    requestId: fr.id,
  });
  return ok(res, { friendship: fr });
});

/** POST /api/friends/accept */
router.post('/accept', async (req: AuthedRequest, res: Response) => {
  const { requestId } = req.body || {};
  // 安全：requestId 必须为正整数，避免 Number() 对非数字输入产生 NaN 直达数据库报错
  const id = Number(requestId);
  if (!isPosInt(id)) return fail(res, 400, 'invalid requestId', 'BAD_REQUEST');
  const fr = await getFriendshipById(id);
  if (!fr) return fail(res, 404, 'request not found', 'NOT_FOUND');
  if (fr.friend_id !== req.user!.id) return fail(res, 403, 'not your request', 'FORBIDDEN');
  if (fr.status !== 'pending') return fail(res, 400, 'request not pending', 'BAD_REQUEST');
  await updateFriendshipStatus(fr.id, 'accepted');
  sendToUser(fr.user_id, {
    type: 'friend_accepted',
    user: toSafeUser(req.user!),
  });
  return ok(res, { ok: true });
});

/** POST /api/friends/reject */
router.post('/reject', async (req: AuthedRequest, res: Response) => {
  const { requestId } = req.body || {};
  // 安全：requestId 必须为正整数
  const id = Number(requestId);
  if (!isPosInt(id)) return fail(res, 400, 'invalid requestId', 'BAD_REQUEST');
  const fr = await getFriendshipById(id);
  if (!fr) return fail(res, 404, 'request not found', 'NOT_FOUND');
  if (fr.friend_id !== req.user!.id) return fail(res, 403, 'not your request', 'FORBIDDEN');
  await updateFriendshipStatus(fr.id, 'rejected');
  return ok(res, { ok: true });
});

/** DELETE /api/friends/:userId */
router.delete('/:userId', async (req: AuthedRequest, res: Response) => {
  if (!isUuid(req.params.userId)) return fail(res, 400, 'invalid userId', 'BAD_REQUEST');
  await deleteFriendshipBetween(req.user!.id, req.params.userId);
  return ok(res, { ok: true });
});

export default router;
