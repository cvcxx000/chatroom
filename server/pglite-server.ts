import { PGlite } from '@electric-sql/pglite';
import { PGliteServer } from '@electric-sql/pglite-server';

const port = Number(process.env.PGPORT || 5432);
const dataDir = process.env.PGDATA || './.pgdata';

console.log(`[pglite] 启动 PostgreSQL 兼容服务器，端口: ${port}, 数据目录: ${dataDir}`);

const pg = new PGlite(dataDir);
const server = new PGliteServer(pg);

server.listen(port).then(() => {
  console.log(`[pglite] 服务器已启动，监听端口 ${port}`);
}).catch((err: any) => {
  console.error('[pglite] 启动失败:', err);
  process.exit(1);
});
