import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
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
  const client = new Pool({
    host,
    port: parseInt(port || '5432', 10),
    database,
    user: username,
    password: password || '',
    connectionTimeoutMillis: 8000,
    max: 1,
  });
  try {
    await client.query('SELECT 1');
    return ok(res, { ok: true });
  } catch {
    // [SECURITY] Do not leak raw connection error to the client.
    return fail(res, 400, 'Database connection failed.', 'DB_CONNECT_FAILED');
  } finally {
    await client.end().catch(() => undefined);
  }
});

/**
 * Sanitize a value before writing it to .env to prevent
 * newline/CRLF injection (e.g. host="evil.com\nADMIN_TOKEN=x").
 */
function sanitizeEnvValue(v: unknown): string {
  return String(v ?? '').replace(/[\r\n]+/g, '');
}

/** POST /api/setup/init */
router.post('/init', async (req: Request, res: Response) => {
  const { dbConfig, admin, smtp } = req.body || {};
  if (!dbConfig || !admin) {
    return fail(res, 400, 'dbConfig and admin are required', 'BAD_REQUEST');
  }
  if (!admin.username || !admin.password) {
    return fail(res, 400, 'admin.username and admin.password are required', 'BAD_REQUEST');
  }
  // [SECURITY] Basic credential validation during initial setup.
  if (String(admin.username).length > 64 || String(admin.password).length < 8 || String(admin.password).length > 128) {
    return fail(res, 400, 'username must be <=64 chars and password 8-128 chars', 'BAD_REQUEST');
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(String(admin.username))) {
    return fail(res, 400, 'username may only contain letters, digits, _ . -', 'BAD_REQUEST');
  }

  // [SECURITY] Prevent re-initialization: if the system is already configured
  // and an admin exists, refuse to overwrite .env / JWT_SECRET / DB config.
  if (isDbConfigured()) {
    try {
      const existingAdmins = await countAdmins();
      if (existingAdmins > 0) {
        return fail(res, 403, 'System already initialized. Re-init is forbidden.', 'ALREADY_INITIALIZED');
      }
    } catch {
      // DB unreachable – fall through and allow init (fresh install or recovery).
    }
  }

  // 1. Connect to DB and run init.sql
  const client = new Pool({
    host: dbConfig.host,
    port: parseInt(String(dbConfig.port || '5432'), 10),
    database: dbConfig.database,
    user: dbConfig.username,
    password: dbConfig.password || '',
    connectionTimeoutMillis: 10000,
    max: 5,
  });

  try {
    await client.query('SELECT 1');
  } catch {
    await client.end().catch(() => undefined);
    // [SECURITY] Do not leak raw DB error (host/user details) to the client.
    return fail(res, 400, 'Cannot connect to database.', 'DB_CONNECT_FAILED');
  }

  try {
    if (fs.existsSync(SQL_PATH)) {
      const sql = fs.readFileSync(SQL_PATH, 'utf8');
      await client.query(sql);
    } else {
      // Fallback: inline minimal schema creation.
      await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
    }
  } catch {
    await client.end().catch(() => undefined);
    return fail(res, 500, 'Migration failed.', 'MIGRATION_FAILED');
  }

  // 2. Create admin user (bypassing models since pool isn't re-initialized yet)
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
  } catch {
    await client.end().catch(() => undefined);
    return fail(res, 500, 'Admin creation failed.', 'ADMIN_CREATE_FAILED');
  }

  await client.end().catch(() => undefined);

  // 3. Write .env
  const jwtSecret = require('crypto').randomBytes(48).toString('hex');
  // [SECURITY] Sanitize every value: strip CR/LF to prevent .env injection.
  const envLines = [
    'PORT=4000',
    'NODE_ENV=development',
    `CLIENT_ORIGIN=${sanitizeEnvValue(process.env.CLIENT_ORIGIN || 'http://localhost:5173')}`,
    `DB_HOST=${sanitizeEnvValue(dbConfig.host)}`,
    `DB_PORT=${sanitizeEnvValue(dbConfig.port || 5432)}`,
    `DB_NAME=${sanitizeEnvValue(dbConfig.database)}`,
    `DB_USER=${sanitizeEnvValue(dbConfig.username)}`,
    `DB_PASSWORD=${sanitizeEnvValue(dbConfig.password || '')}`,
    `JWT_SECRET=${jwtSecret}`,
    'JWT_EXPIRES_IN=7d',
    'UPLOAD_DIR=uploads',
    'MAX_FILE_SIZE_MB=50',
  ];
  if (smtp && smtp.host) {
    envLines.push(
      `SMTP_HOST=${sanitizeEnvValue(smtp.host)}`,
      `SMTP_PORT=${sanitizeEnvValue(smtp.port || 587)}`,
      `SMTP_USER=${sanitizeEnvValue(smtp.user || '')}`,
      `SMTP_PASS=${sanitizeEnvValue(smtp.pass || '')}`,
      `SMTP_FROM=${sanitizeEnvValue(smtp.from || '')}`,
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
