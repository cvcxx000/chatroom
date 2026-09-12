import { query } from '../config/db';

export interface UserAiConfig {
  id: string;
  user_id: string;
  provider: string;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  is_active: boolean;
  created_at: Date;
}

/** Public-facing shape without api_key. */
export interface PublicUserAiConfig {
  id: string;
  provider: string;
  name: string;
  base_url: string;
  model: string;
  is_active: boolean;
  created_at: Date;
}

export function toPublic(cfg: UserAiConfig): PublicUserAiConfig {
  return {
    id: cfg.id,
    provider: cfg.provider,
    name: cfg.name,
    base_url: cfg.base_url,
    model: cfg.model,
    is_active: cfg.is_active,
    created_at: cfg.created_at,
  };
}

export async function listUserAiConfigs(userId: string): Promise<UserAiConfig[]> {
  const res = await query<UserAiConfig>(
    'SELECT * FROM user_ai_configs WHERE user_id = $1 ORDER BY created_at ASC',
    [userId],
  );
  return res.rows;
}

export async function getActiveUserAiConfig(userId: string): Promise<UserAiConfig | null> {
  const res = await query<UserAiConfig>(
    'SELECT * FROM user_ai_configs WHERE user_id = $1 AND is_active = TRUE ORDER BY created_at ASC LIMIT 1',
    [userId],
  );
  return res.rows[0] || null;
}

export async function getUserAiConfigById(
  id: string,
  userId: string,
): Promise<UserAiConfig | null> {
  const res = await query<UserAiConfig>(
    'SELECT * FROM user_ai_configs WHERE id = $1 AND user_id = $2 LIMIT 1',
    [id, userId],
  );
  return res.rows[0] || null;
}

export async function createUserAiConfig(
  userId: string,
  data: { provider: string; name: string; baseUrl: string; apiKey: string; model: string },
): Promise<UserAiConfig> {
  const res = await query<UserAiConfig>(
    `INSERT INTO user_ai_configs (user_id, provider, name, base_url, api_key, model)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [userId, data.provider, data.name, data.baseUrl, data.apiKey, data.model],
  );
  return res.rows[0];
}

export async function updateUserAiConfig(
  id: string,
  userId: string,
  data: {
    provider?: string;
    name?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    isActive?: boolean;
  },
): Promise<UserAiConfig | null> {
  const sets: string[] = [];
  const params: unknown[] = [];
  if (data.provider !== undefined) {
    params.push(data.provider);
    sets.push(`provider = $${params.length}`);
  }
  if (data.name !== undefined) {
    params.push(data.name);
    sets.push(`name = $${params.length}`);
  }
  if (data.baseUrl !== undefined) {
    params.push(data.baseUrl);
    sets.push(`base_url = $${params.length}`);
  }
  if (data.apiKey !== undefined) {
    params.push(data.apiKey);
    sets.push(`api_key = $${params.length}`);
  }
  if (data.model !== undefined) {
    params.push(data.model);
    sets.push(`model = $${params.length}`);
  }
  if (data.isActive !== undefined) {
    params.push(data.isActive);
    sets.push(`is_active = $${params.length}`);
  }
  if (sets.length === 0) return getUserAiConfigById(id, userId);
  params.push(id, userId);
  const res = await query<UserAiConfig>(
    `UPDATE user_ai_configs SET ${sets.join(', ')}
     WHERE id = $${params.length - 1} AND user_id = $${params.length}
     RETURNING *`,
    params,
  );
  return res.rows[0] || null;
}

export async function deleteUserAiConfig(id: string, userId: string): Promise<void> {
  await query('DELETE FROM user_ai_configs WHERE id = $1 AND user_id = $2', [id, userId]);
}
