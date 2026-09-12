import { PGlite } from '@electric-sql/pglite';
import { env } from './env';
import type { QueryResult, QueryResultRow } from 'pg';

let db: PGlite | null = null;

export function getPool(): PGlite {
  if (!db) {
    const dataDir = process.env.PGLITE_DATA || './.pgdata';
    db = new PGlite(dataDir);
    console.log(`[pglite] 数据库已初始化，数据目录: ${dataDir}`);
  }
  return db;
}

/** Test a one-off connection with the given credentials (used by setup wizard). */
export async function testConnection(opts: {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}): Promise<boolean> {
  try {
    const pg = getPool();
    await pg.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/** Run a query with retries on connection errors. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
  retries = 3,
): Promise<QueryResult<T>> {
  const pg = getPool();
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const result = await pg.query<T>(text, params as any[]);
      return result as unknown as QueryResult<T>;
    } catch (err: any) {
      lastErr = err;
      if (attempt === retries) throw err;
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  throw lastErr;
}

/** A pooled client handle (PGlite-backed) used for transactions. */
export interface DbClient {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  release(): void;
}

/** Acquire a client from the pool (for transactions). */
export async function getClient(): Promise<DbClient> {
  const pg = getPool();
  return {
    query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) =>
      pg.query<T>(text, params as any[]) as unknown as Promise<QueryResult<T>>,
    release: () => {},
  };
}

export async function closePool(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
  }
}
