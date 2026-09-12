import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { env } from './config/env';
import { requestLogger } from './middleware/logger';
import { errorHandler, notFound } from './middleware/errorHandler';
import { requireAuth } from './middleware/auth';
import { requireAdmin } from './middleware/admin';
import { authLimiter, generalLimiter } from './middleware/rateLimit';

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

app.use(
  cors({
    origin: env.CLIENT_ORIGIN.split(',').map((s) => s.trim()),
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
