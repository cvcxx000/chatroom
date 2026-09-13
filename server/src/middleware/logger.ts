import { Request, Response, NextFunction } from 'express';

/**
 * [安全] 对日志中的 URL 做脱敏处理。
 * 浏览器 WebSocket API 不支持自定义请求头，因此 token 只能通过
 * `/ws?token=xxx` 查询参数传递；若直接记录 originalUrl，token 会落入
 * 服务器访问日志、反向代理日志。这里将 token（及常见敏感参数）替换为 ***。
 */
function sanitizeUrl(url: string): string {
  try {
    // 仅对 query string 部分做替换，避免破坏路径。
    const qIndex = url.indexOf('?');
    if (qIndex === -1) return url;
    const path = url.slice(0, qIndex);
    const query = url.slice(qIndex + 1);
    const sanitizedQuery = query
      .split('&')
      .map((pair) => {
        const eq = pair.indexOf('=');
        if (eq === -1) return pair;
        const key = pair.slice(0, eq);
        // 命中敏感参数名（不区分大小写）则脱敏取值。
        if (/^(token|access_token|auth|password|pwd|secret|api_key|apikey)$/i.test(key)) {
          return `${key}=***`;
        }
        return pair;
      })
      .join('&');
    return `${path}?${sanitizedQuery}`;
  } catch {
    return url;
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    // eslint-disable-next-line no-console
    console.log(`[${new Date().toISOString()}] ${req.method} ${sanitizeUrl(req.originalUrl)} ${res.statusCode} ${ms}ms`);
  });
  next();
}
