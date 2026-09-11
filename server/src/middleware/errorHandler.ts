import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/response';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ success: false, error: err.message, code: err.code });
    return;
  }
  // eslint-disable-next-line no-console
  console.error('[error]', err);
  res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL' });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
}
