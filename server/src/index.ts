import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { env, getCorsOrigins } from './config/env';
import { requestLogger } from './middleware/logger';
import { errorHandler, notFound } from './middleware/errorHandler';
import { requireAuth } from './middleware/auth';
import { requireAdmin } from './middleware/admin';
import { authLimiter, generalLimiter, loginLimiter, registerLimiter } from './middleware/rateLimit';

import setupRoutes from './routes/setup';
import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import friendRoutes from './routes/friends';
import conversationRoutes from './routes/conversations';
import fileRoutes from './routes/files';
import tempRoutes from './routes/temp';
import adminRoutes from './routes/admin';
import shareRoutes from './routes/share';
import qrRoutes from './routes/qr';
import aiRoutes from './routes/ai';
import terminalRoutes from './routes/terminal';
import messageRoutes from './routes/messages';
import conversationSettingsRoutes from './routes/conversationSettings';
import userSettingsRoutes from './routes/userSettings';
import quickReplyRoutes from './routes/quickReplies';
import reportRoutes from './routes/reports';

const app = express();
const server = http.createServer(app);

// [安全] 原生安全响应头中间件（不引入 helmet 依赖）。
// 必须尽早注册，确保所有响应（含静态文件 / SPA fallback）都带上这些头。
app.use((_req, res, next) => {
  // 禁止浏览器对响应 MIME 类型进行嗅探。
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // 禁止页面被 iframe 嵌入，防止点击劫持。
  res.setHeader('X-Frame-Options', 'DENY');
  // 老旧浏览器 XSS 过滤器（现代浏览器主要靠 CSP，这里做兼容兜底）。
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // 限制跨站请求泄露来源地址。
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// [安全] CORS：来源来自 CLIENT_ORIGIN（逗号分隔多域），不允许 '*'，生产环境不携带通配。
// 多域名时逐个 trim 并过滤空值；credentials:true 配合显式来源白名单。
app.use(
  cors({
    origin: getCorsOrigins(),
    credentials: true,
  }),
);
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use(generalLimiter);

// Static uploads
const UPLOAD_DIR = path.resolve(process.cwd(), env.UPLOAD_DIR);
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
app.use('/uploads', express.static(UPLOAD_DIR));

// Serve frontend static files (production build)
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
}

// Routes
app.use('/api/setup', setupRoutes);

// [安全] 针对暴力破解拆分限流：
// 登录 / 管理员登录 -> loginLimiter（5 分钟 10 次）；注册 -> registerLimiter（15 分钟 5 次）。
// 这些更严格的限流器先于 authRoutes 挂载，会先生效；其余 /api/auth 子路径仍走 authLimiter。
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/admin-login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth', authLimiter, authRoutes);

app.use('/api/users', requireAuth, userRoutes);
app.use('/api/friends', requireAuth, friendRoutes);
app.use('/api/conversations', requireAuth, conversationRoutes);
app.use('/api/files', requireAuth, fileRoutes);
app.use('/api/temp', requireAuth, tempRoutes);
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/qr', qrRoutes);
app.use('/api/ai', requireAuth, aiRoutes);
app.use('/api/terminal', requireAuth, terminalRoutes);
app.use('/api/messages', requireAuth, messageRoutes);
app.use('/api/conversation-settings', requireAuth, conversationSettingsRoutes);
app.use('/api/settings', requireAuth, userSettingsRoutes);
app.use('/api/quick-replies', requireAuth, quickReplyRoutes);
app.use('/api/reports', requireAuth, reportRoutes);

// [安全] /health 仅返回最小状态，不泄露环境变量、版本或内部细节。
app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
});

// SPA fallback: serve index.html for non-API routes
app.get('*', (_req, res, next) => {
  if (_req.path.startsWith('/api/') || _req.path.startsWith('/uploads/')) return next();
  const indexFile = path.join(CLIENT_DIST, 'index.html');
  if (fs.existsSync(indexFile)) {
    res.sendFile(indexFile);
  } else {
    next();
  }
});

app.use(notFound);
app.use(errorHandler);

// WebSocket
import { initWebsocket } from './websocket/server';
initWebsocket(server);

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`[server] listening on http://localhost:${env.PORT}`);
  // eslint-disable-next-line no-console
  console.log(`[server] CORS origin: ${env.CLIENT_ORIGIN}`);
});

export { app, server };
