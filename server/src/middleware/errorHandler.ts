import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../utils/response';

// [安全] 敏感字段名集合：递归脱敏时一律替换为 ***。
const SENSITIVE_KEYS =
  /^(password|password_hash|pwd|passwd|token|access_token|refresh_token|authorization|secret|api_key|apikey|smtp_pass)$/i;

/** 递归地把对象中的敏感字段值替换为 ***，避免密码/token 落入日志。 */
function redact<T>(obj: T, seen: WeakSet<object> = new WeakSet()): T {
  if (!obj || typeof obj !== 'object') return obj;
  if (seen.has(obj as object)) return obj;
  seen.add(obj as object);
  if (Array.isArray(obj)) {
    return obj.map((item) => redact(item, seen)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.test(k)) {
      out[k] = '***';
    } else {
      out[k] = redact(v, seen);
    }
  }
  return out as T;
}

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
  // [安全] 只记录脱敏后的错误信息，且绝不把 req.body（含密码）直接打到日志。
  // 对外仍只返回通用 500，不泄露堆栈/内部细节。
  // eslint-disable-next-line no-console
  console.error('[error]', redact(err));
  res.status(500).json({ success: false, error: 'Internal server error', code: 'INTERNAL' });
}

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ success: false, error: 'Not found', code: 'NOT_FOUND' });
}
