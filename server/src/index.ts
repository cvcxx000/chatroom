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

// Routes
app.use('/api/setup', setupRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', requireAuth, userRoutes);
app.use('/api/friends', requireAuth, friendRoutes);
app.use('/api/conversations', requireAuth, conversationRoutes);
app.use('/api/files', requireAuth, fileRoutes);
app.use('/api/temp', requireAuth, tempRoutes);
app.use('/api/admin', requireAuth, requireAdmin, adminRoutes);

app.get('/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', uptime: process.uptime() } });
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
