import { Router, Response } from 'express';
import { ok, fail } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';
import { searchUsers, findUserById, updateProfile, toSafeUser } from '../models/userModel';

const router = Router();

/** GET /api/users/search?q= */
router.get('/search', async (req: AuthedRequest, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (!q) return ok(res, []);
  const users = await searchUsers(q, 20);
  return ok(res, users.filter((u) => u.id !== req.user!.id).map(toSafeUser));
});

/** GET /api/users/:id/profile */
router.get('/:id/profile', async (req: AuthedRequest, res: Response) => {
  const user = await findUserById(req.params.id);
  if (!user) return fail(res, 404, 'user not found', 'NOT_FOUND');
  return ok(res, toSafeUser(user));
});

/** PUT /api/users/profile */
router.put('/profile', async (req: AuthedRequest, res: Response) => {
  const { displayName, avatarUrl } = req.body || {};
  const updated = await updateProfile(req.user!.id, {
    displayName: displayName !== undefined ? String(displayName) : undefined,
    avatarUrl: avatarUrl !== undefined ? String(avatarUrl) : undefined,
  });
  if (!updated) return fail(res, 404, 'user not found', 'NOT_FOUND');
  return ok(res, toSafeUser(updated));
});

export default router;
