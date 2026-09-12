import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'fs';
import { join } from 'path';

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
  
  // 创建默认管理员
  try {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    await pg.query(
      `INSERT INTO users (username, email, password_hash, display_name, is_admin) 
       VALUES ($1, $2, $3, $4, true) 
       ON CONFLICT (username) DO NOTHING`,
      ['admin', 'admin@localhost', hash, '管理员']
    );
    console.log('[init] 默认管理员已创建: admin / admin123');
  } catch (err: any) {
    console.warn('[init] 管理员创建:', err.message);
  }
  
  // 创建内置 AI 助手用户（AI 消息的发送者）
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
