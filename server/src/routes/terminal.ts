import { Router, Response } from 'express';
import { ok, fail } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';
import { dockerService } from '../services/docker';

const router = Router();

/**
 * POST /api/terminal/start
 * Create a fresh sandboxed container for the current user and return the
 * containerId plus the websocket path to attach the terminal to.
 */
router.post('/start', async (req: AuthedRequest, res: Response) => {
  if (!dockerService.available) {
    return res
      .status(503)
      .json({
        success: false,
        error: '虚拟终端功能需要服务器安装 Docker，请联系管理员',
        code: 'DOCKER_UNAVAILABLE',
      });
  }
  try {
    const containerId = await dockerService.createContainer(req.user!.id);
    return ok(res, { containerId, wsPath: '/ws' });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[terminal] start failed:', err);
    return fail(res, 500, err && err.message ? err.message : 'failed to start terminal', 'START_FAILED');
  }
});

/** Ensure the container exists and belongs to the requesting user. */
async function assertOwnership(
  req: AuthedRequest,
  res: Response,
): Promise<string | null> {
  const containerId = req.params.id;
  if (!dockerService.available) {
    res
      .status(503)
      .json({
        success: false,
        error: '虚拟终端功能需要服务器安装 Docker，请联系管理员',
        code: 'DOCKER_UNAVAILABLE',
      });
    return null;
  }
  let owner: string | null = null;
  try {
    owner = await dockerService.getContainerOwner(containerId);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[terminal] ownership check failed:', err);
  }
  if (!owner) {
    fail(res, 404, 'container not found', 'NOT_FOUND');
    return null;
  }
  if (owner !== req.user!.id) {
    fail(res, 403, 'forbidden: container does not belong to you', 'FORBIDDEN');
    return null;
  }
  return containerId;
}

/**
 * POST /api/terminal/:id/stop
 * Stop and remove the container (only if it belongs to the user).
 */
router.post('/:id/stop', async (req: AuthedRequest, res: Response) => {
  const containerId = await assertOwnership(req, res);
  if (!containerId) return;
  try {
    await dockerService.stopContainer(containerId);
    return ok(res, { ok: true });
  } catch (err: any) {
    return fail(res, 500, err && err.message ? err.message : 'failed to stop container', 'STOP_FAILED');
  }
});

/**
 * GET /api/terminal/:id/status
 * Return the container status (only if it belongs to the user).
 */
router.get('/:id/status', async (req: AuthedRequest, res: Response) => {
  const containerId = await assertOwnership(req, res);
  if (!containerId) return;
  try {
    const status = await dockerService.getContainerStatus(containerId);
    return ok(res, status);
  } catch (err: any) {
    return fail(res, 500, err && err.message ? err.message : 'failed to query status', 'STATUS_FAILED');
  }
});

export default router;
