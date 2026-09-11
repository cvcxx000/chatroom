import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import { findUserById } from '../models/userModel';
import { User } from '../models/types';

export interface AuthedRequest extends Request {
  user?: User;
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!token) {
      res.status(401).json({ success: false, error: 'No token provided', code: 'NO_TOKEN' });
      return;
    }
    const payload = verifyToken(token);
    const user = await findUserById(payload.userId);
    if (!user) {
      res.status(401).json({ success: false, error: 'User not found', code: 'USER_NOT_FOUND' });
      return;
    }
    if (user.is_banned) {
      res.status(403).json({ success: false, error: 'User is banned', code: 'USER_BANNED' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ success: false, error: 'Invalid or expired token', code: 'INVALID_TOKEN' });
  }
}
