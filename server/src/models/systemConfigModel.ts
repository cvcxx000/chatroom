import { query } from '../config/db';

export interface SystemConfigRow {
  key: string;
  value: string | null;
  updated_at: Date;
}

export async function getConfig(key: string): Promise<string | null> {
  const res = await query<SystemConfigRow>(
    'SELECT value FROM system_config WHERE key = $1 LIMIT 1',
    [key],
  );
  return res.rows[0]?.value ?? null;
}

export async function setConfig(key: string, value: string): Promise<void> {
  await query(
    `INSERT INTO system_config (key, value, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value],
  );
}

export async function getAllConfig(): Promise<Record<string, string>> {
  const res = await query<SystemConfigRow>('SELECT key, value FROM system_config');
  const out: Record<string, string> = {};
  for (const r of res.rows) {
    out[r.key] = r.value || '';
  }
  return out;
}
