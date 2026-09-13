import rateLimit from 'express-rate-limit';

// 通用 auth 路由限流（验证码重发、登出等非暴力破解端点）。
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later', code: 'RATE_LIMITED' },
});

// [安全] 登录 / 管理员登录专用限流：针对口令爆破，比 authLimiter 严格得多。
// 5 分钟内最多 10 次尝试。
export const loginLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many login attempts, please try again later', code: 'RATE_LIMITED' },
});

// [安全] 注册专用限流：防止批量注册 / 垃圾账号。15 分钟内最多 5 次。
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many registration attempts, please try again later', code: 'RATE_LIMITED' },
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
