import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { env } from './env';

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      host: env.DB_HOST,
      port: env.DB_PORT,
      database: env.DB_NAME,
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });

    pool.on('error', (err) => {
      // eslint-disable-next-line no-console
      console.error('[pg] unexpected idle client error', err);
    });
  }
  return pool;
}

/** Test a one-off connection with the given credentials (used by setup wizard). */
export async function testConnection(opts: {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}): Promise<boolean> {
  const client = new Pool({
    host: opts.host,
    port: opts.port,
    database: opts.database,
    user: opts.username,
    password: opts.password,
    connectionTimeoutMillis: 8000,
    max: 1,
  });
  try {
    await client.query('SELECT 1');
    return true;
  } finally {
    await client.end().catch(() => undefined);
  }
}

/** Run a query with retries on connection errors. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  retries = 3,
): Promise<QueryResult<T>> {
  const pool = getPool();
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await pool.query<T>(text, params as any[]);
    } catch (err: any) {
      lastErr = err;
      // Retry on transient connection errors only
      const code = err?.code || '';
      const transient =
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT' ||
        code === '57P01' || // admin_shutdown
        code === '08006' || // connection failure
        code === '08001' ||
        code === 'EHOSTUNREACH' ||
        code === 'ENOTFOUND';
      if (!transient || attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/** Acquire a client from the pool (for transactions). */
export async function getClient(): Promise<PoolClient> {
  return getPool().connect();
}

export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
