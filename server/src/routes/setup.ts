import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { getPool } from '../config/db';
import { ok, fail } from '../utils/response';
import { isDbConfigured } from '../config/env';
import { countAdmins, findUserByUsername, createUser } from '../models/userModel';
import { setConfig } from '../models/systemConfigModel';
import { saveSmtpConfig } from '../services/email';

const router = Router();

const SERVER_ROOT = path.resolve(__dirname, '..', '..');
const ENV_PATH = path.join(SERVER_ROOT, '.env');
const SQL_PATH = path.resolve(SERVER_ROOT, '..', 'sql', 'init.sql');

/** GET /api/setup/status */
router.get('/status', async (_req: Request, res: Response) => {
  try {
    const dbConfigured = isDbConfigured();
    let adminExists = false;
    let dbReachable = false;
    if (dbConfigured) {
      try {
        // Try a quick query to see if DB + tables are reachable.
        const { query } = require('../config/db');
        const r = await query('SELECT 1 FROM users LIMIT 1').catch(() => ({ rows: [] }));
        dbReachable = true;
        adminExists = (await countAdmins()) > 0;
        void r;
      } catch {
        dbReachable = false;
      }
    }
    return ok(res, {
      dbConfigured,
      dbReachable,
      adminExists,
      initialized: dbConfigured && adminExists,
    });
  } catch (err: any) {
    return ok(res, { dbConfigured: false, dbReachable: false, adminExists: false, initialized: false });
  }
});

/** POST /api/setup/test-db */
router.post('/test-db', async (req: Request, res: Response) => {
  const { host, port, database, username, password } = req.body || {};
  if (!host || !database || !username) {
    return fail(res, 400, 'host, database and username are required', 'BAD_REQUEST');
  }
  try {
    const db = getPool();
    await db.query('SELECT 1');
    return ok(res, { ok: true });
  } catch (err: any) {
    return fail(res, 400, `Database connection failed: ${err.message}`, 'DB_CONNECT_FAILED');
  }
});

/** POST /api/setup/init */
router.post('/init', async (req: Request, res: Response) => {
  const { dbConfig, admin, smtp } = req.body || {};
  if (!dbConfig || !admin) {
    return fail(res, 400, 'dbConfig and admin are required', 'BAD_REQUEST');
  }
  if (!admin.username || !admin.password) {
    return fail(res, 400, 'admin.username and admin.password are required', 'BAD_REQUEST');
  }

  // 1. Connect to DB and run init.sql (pglite 兼容层)
  const client = getPool();

  try {
    await client.query('SELECT 1');
  } catch (err: any) {
    return fail(res, 400, `Cannot connect to database: ${err.message}`, 'DB_CONNECT_FAILED');
  }

  try {
    if (fs.existsSync(SQL_PATH)) {
      const sql = fs.readFileSync(SQL_PATH, 'utf8');
      // pglite 不支持一次执行多条语句，按分号拆分逐条执行
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));
      for (const stmt of statements) {
        await client.query(stmt);
      }
    } else {
      await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    }
  } catch (err: any) {
    return fail(res, 500, `Migration failed: ${err.message}`, 'MIGRATION_FAILED');
  }

  // 2. Create admin user
  try {
    const existing = await client.query('SELECT id FROM users WHERE username = $1 LIMIT 1', [admin.username]);
    if (existing.rows.length === 0) {
      const hash = await bcrypt.hash(admin.password, 10);
      await client.query(
        `INSERT INTO users (username, email, password_hash, display_name, is_admin, is_verified)
         VALUES ($1, $2, $3, $4, TRUE, TRUE)`,
        [admin.username, admin.email || null, hash, admin.displayName || admin.username],
      );
    }
  } catch (err: any) {
    return fail(res, 500, `Admin creation failed: ${err.message}`, 'ADMIN_CREATE_FAILED');
  }

  // 3. Write .env (保持当前端口和JWT配置)
  const jwtSecret = require('crypto').randomBytes(48).toString('hex');
  const envLines = [
    `PORT=${process.env.PORT || 80}`,
    'NODE_ENV=production',
    `CLIENT_ORIGIN=${process.env.CLIENT_ORIGIN || '*'}`,
    `DB_HOST=${dbConfig.host}`,
    `DB_PORT=${dbConfig.port || 5432}`,
    `DB_NAME=${dbConfig.database}`,
    `DB_USER=${dbConfig.username}`,
    `DB_PASSWORD=${dbConfig.password || ''}`,
    `JWT_SECRET=${jwtSecret}`,
    'JWT_EXPIRES_IN=5h',
    'UPLOAD_DIR=uploads',
    'MAX_FILE_SIZE_MB=50',
  ];
  if (smtp && smtp.host) {
    envLines.push(
      `SMTP_HOST=${smtp.host || ''}`,
      `SMTP_PORT=${smtp.port || 587}`,
      `SMTP_USER=${smtp.user || ''}`,
      `SMTP_PASS=${smtp.pass || ''}`,
      `SMTP_FROM=${smtp.from || ''}`,
      `SMTP_SECURE=${smtp.secure ? 'true' : 'false'}`,
    );
  }
  fs.writeFileSync(ENV_PATH, envLines.join('\n') + '\n', 'utf8');

  // 4. Store SMTP config in DB (best-effort; pool will re-read on next boot)
  try {
    process.env.DB_HOST = dbConfig.host;
    process.env.DB_PORT = String(dbConfig.port || 5432);
    process.env.DB_NAME = dbConfig.database;
    process.env.DB_USER = dbConfig.username;
    process.env.DB_PASSWORD = dbConfig.password || '';
    process.env.JWT_SECRET = jwtSecret;
    if (smtp && smtp.host) {
      await saveSmtpConfig({
        host: smtp.host || '',
        port: parseInt(String(smtp.port || 587), 10),
        user: smtp.user || '',
        pass: smtp.pass || '',
        from: smtp.from || '',
        secure: Boolean(smtp.secure),
      }).catch(() => undefined);
      await setConfig('smtp_host', smtp.host).catch(() => undefined);
    }
  } catch {
    /* ignore */
  }

  return ok(res, { initialized: true });
});

export default router;
