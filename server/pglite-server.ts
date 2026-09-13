import { PGlite } from '@electric-sql/pglite';
import { PGliteServer } from '@electric-sql/pglite-server';

const port = Number(process.env.PGPORT || 5432);
const dataDir = process.env.PGDATA || './.pgdata';
// [安全] 该 PG 兼容服务没有任何认证。默认只绑定回环地址，
// 防止无口令的数据库端口暴露到局域网/公网。确需远程访问时显式设置 PGLITE_SERVER_HOST。
const host = process.env.PGLITE_SERVER_HOST || '127.0.0.1';

console.log(`[pglite] 启动 PostgreSQL 兼容服务器，端口: ${port}, 绑定: ${host}, 数据目录: ${dataDir}`);

const pg = new PGlite(dataDir);
const server = new PGliteServer(pg);

server.listen(port, host).then(() => {
  console.log(`[pglite] 服务器已启动，监听 ${host}:${port}`);
}).catch((err: any) => {
  console.error('[pglite] 启动失败:', err);
  process.exit(1);
});
