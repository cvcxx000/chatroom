import { query } from '../config/db';
import { AiConfig } from './types';

/** Public-facing shape: never includes api_key. */
export interface PublicAiConfig {
  id: string;
  provider: string;
  name: string;
  model: string;
  is_active: boolean;
  created_at: Date;
}

export async function createAiConfig(data: {
  provider: string;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  isActive?: boolean;
}): Promise<AiConfig> {
  const res = await query<AiConfig>(
    `INSERT INTO ai_configs (provider, name, base_url, api_key, model, is_active)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [data.provider, data.name, data.baseUrl, data.apiKey, data.model, data.isActive !== false],
  );
  return res.rows[0];
}

export async function listAiConfigs(): Promise<AiConfig[]> {
  const res = await query<AiConfig>(
    'SELECT * FROM ai_configs ORDER BY created_at ASC',
  );
  return res.rows;
}

export async function getAiConfigById(id: string): Promise<AiConfig | null> {
  const res = await query<AiConfig>(
    'SELECT * FROM ai_configs WHERE id = $1 LIMIT 1',
    [id],
  );
  return res.rows[0] || null;
}

export async function updateAiConfig(
  id: string,
  data: {
    provider?: string;
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    isActive?: boolean;
  },
): Promise<AiConfig | null> {
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (data.provider !== undefined) {
    fields.push(`provider = $${i++}`);
    params.push(data.provider);
  }
  if (data.name !== undefined) {
    fields.push(`name = $${i++}`);
    params.push(data.name);
  }
  if (data.baseUrl !== undefined) {
    fields.push(`base_url = $${i++}`);
    params.push(data.baseUrl);
  }
  if (data.apiKey !== undefined) {
    fields.push(`api_key = $${i++}`);
    params.push(data.apiKey);
  }
  if (data.model !== undefined) {
    fields.push(`model = $${i++}`);
    params.push(data.model);
  }
  if (data.isActive !== undefined) {
    fields.push(`is_active = $${i++}`);
    params.push(data.isActive);
  }
  if (fields.length === 0) return getAiConfigById(id);
  params.push(id);
  const res = await query<AiConfig>(
    `UPDATE ai_configs SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

export async function deleteAiConfig(id: string): Promise<void> {
  await query('DELETE FROM ai_configs WHERE id = $1', [id]);
}

/** Active configs without the api_key, for end-user display. */
export async function listActiveAiConfigs(): Promise<PublicAiConfig[]> {
  const res = await query<PublicAiConfig>(
    `SELECT id, provider, name, model, is_active, created_at
     FROM ai_configs
     WHERE is_active = TRUE
     ORDER BY created_at ASC`,
  );
  return res.rows;
}
