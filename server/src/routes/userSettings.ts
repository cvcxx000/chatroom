import { Router, Response } from 'express';
import { ok } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';
import {
  getUserSettings,
  updateUserSettings,
} from '../models/userSettingsModel';

const router = Router();

/** GET /api/settings - get my user settings. */
router.get('/', async (req: AuthedRequest, res: Response) => {
  const settings = await getUserSettings(req.user!.id);
  return ok(res, settings);
});

/** PUT /api/settings - partially update my settings. */
router.put('/', async (req: AuthedRequest, res: Response) => {
  const body = (req.body || {}) as Record<string, unknown>;
  const allowedKeys = [
    'theme',
    'font_size',
    'enter_to_send',
    'message_preview',
    'auto_download',
    'notifications_enabled',
    'sound_enabled',
    'language',
  ] as const;
  const data: Record<string, unknown> = {};
  for (const k of allowedKeys) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  const settings = await updateUserSettings(req.user!.id, data);
  return ok(res, settings);
});

export default router;
