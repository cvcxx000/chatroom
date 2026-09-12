import { Router, Response } from 'express';
import { ok } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';
import { listReportsByUser } from '../models/reportModel';

const router = Router();

/** GET /api/reports/mine - list reports submitted by the current user. */
router.get('/mine', async (req: AuthedRequest, res: Response) => {
  const rows = await listReportsByUser(req.user!.id);
  return ok(res, rows);
});

export default router;
