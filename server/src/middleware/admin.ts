import { Response, NextFunction } from 'express';
import { AuthedRequest } from './auth';

export function requireAdmin(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized', code: 'NO_TOKEN' });
    return;
  }
  if (!req.user.is_admin) {
    res.status(403).json({ success: false, error: 'Admin access required', code: 'ADMIN_REQUIRED' });
    return;
  }
  next();
}
