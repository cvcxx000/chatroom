import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'fs';
import { join } from 'path';

/** [安全] 醒目警告：默认管理员使用已知弱口令 admin/admin123，必须尽快修改。 */
function warnDefaultAdminPassword(): void {
  // eslint-disable-next-line no-console
  console.warn('\n==============================================================');
  // eslint-disable-next-line no-console
  console.warn('[security] WARNING: default administrator account uses a KNOWN weak password.');
  // eslint-disable-next-line no-console
  console.warn('[security]   username: admin   password: admin123');
  // eslint-disable-next-line no-console
  console.warn('[security] You MUST log in and change this password immediately,');
  // eslint-disable-next-line no-console
  console.warn('[security] and never expose this instance without changing it.\n');
  // eslint-disable-next-line no-console
  console.warn('==============================================================\n');
}

async function init() {
  const dataDir = process.env.PGLITE_DATA || './.pgdata';
  const pg = new PGlite(dataDir);

  console.log('[init] 正在初始化数据库...');

  // 读取 SQL 文件，去掉 pgcrypto 扩展行（pglite 内置支持）
  let sql = readFileSync(join(__dirname, '../../sql/init.sql'), 'utf-8');
  sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;/g, '');

  // 按分号分割执行
  const statements = sql.split(';').filter(s => s.trim());
  for (const stmt of statements) {
    try {
      await pg.exec(stmt);
    } catch (err: any) {
      // 忽略已存在等非致命错误
      if (!err.message.includes('already exists') && !err.message.includes('does not exist')) {
        console.warn('[init] 警告:', err.message.substring(0, 100));
      }
    }
  }

  // 创建默认管理员（使用参数化查询，避免 SQL 注入）。
  // ON CONFLICT (username) DO NOTHING：已有数据时不会重复创建，也不会覆盖已修改的密码。
  try {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    const result = await pg.query(
      `INSERT INTO users (username, email, password_hash, display_name, is_admin)
       VALUES ($1, $2, $3, $4, true)
       ON CONFLICT (username) DO NOTHING`,
      ['admin', 'admin@localhost', hash, '管理员']
    );
    // rowCount === 1 表示本次新建了管理员；无论新建与否都提示弱口令风险。
    if (result && result.rowCount && result.rowCount > 0) {
      console.log('[init] 默认管理员已创建: admin / admin123');
    } else {
      console.log('[init] 管理员已存在，跳过创建（不会覆盖已有密码）。');
    }
    // [安全] 始终提醒：若仍为默认弱口令，必须立即修改。
    warnDefaultAdminPassword();
  } catch (err: any) {
    console.warn('[init] 管理员创建:', err.message);
  }

  // 创建内置 AI 助手用户（AI 消息的发送者），密码为随机强口令。
  try {
    const bcrypt = require('bcryptjs');
    const aiHash = bcrypt.hashSync(Math.random().toString(36).slice(2) + Date.now().toString(36), 10);
    await pg.query(
      `INSERT INTO users (username, email, password_hash, display_name, is_admin, is_verified)
       VALUES ($1, $2, $3, $4, false, true)
       ON CONFLICT (username) DO NOTHING`,
      ['ai_assistant', null, aiHash, 'AI 助手']
    );
    console.log('[init] AI 助手用户已创建: ai_assistant');
  } catch (err: any) {
    console.warn('[init] AI 助手创建:', err.message);
  }

  console.log('[init] 数据库初始化完成！');
  await pg.close();
  process.exit(0);
}

init().catch(err => {
  console.error('[init] 失败:', err);
  process.exit(1);
});
