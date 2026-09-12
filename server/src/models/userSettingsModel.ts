import { query } from '../config/db';

export interface UserSettingsRow {
  user_id: string;
  theme: 'light' | 'dark' | 'system';
  font_size: number;
  enter_to_send: boolean;
  message_preview: boolean;
  auto_download: boolean;
  notifications_enabled: boolean;
  sound_enabled: boolean;
  language: string;
}

export const DEFAULT_SETTINGS: Omit<UserSettingsRow, 'user_id'> = {
  theme: 'system',
  font_size: 14,
  enter_to_send: true,
  message_preview: true,
  auto_download: true,
  notifications_enabled: true,
  sound_enabled: true,
  language: 'zh-CN',
};

export async function getUserSettings(userId: string): Promise<UserSettingsRow> {
  const res = await query<UserSettingsRow>(
    'SELECT * FROM user_settings WHERE user_id = $1 LIMIT 1',
    [userId],
  );
  if (res.rows[0]) return res.rows[0];
  // Create defaults row
  const inserted = await query<UserSettingsRow>(
    `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING RETURNING *`,
    [userId],
  );
  if (inserted.rows[0]) return inserted.rows[0];
  const again = await query<UserSettingsRow>(
    'SELECT * FROM user_settings WHERE user_id = $1 LIMIT 1',
    [userId],
  );
  return again.rows[0];
}

export async function updateUserSettings(
  userId: string,
  data: Partial<Omit<UserSettingsRow, 'user_id'>>,
): Promise<UserSettingsRow> {
  // Ensure row exists
  await query(
    `INSERT INTO user_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
  const columns: [keyof typeof DEFAULT_SETTINGS, string][] = [
    ['theme', 'theme'],
    ['font_size', 'font_size'],
    ['enter_to_send', 'enter_to_send'],
    ['message_preview', 'message_preview'],
    ['auto_download', 'auto_download'],
    ['notifications_enabled', 'notifications_enabled'],
    ['sound_enabled', 'sound_enabled'],
    ['language', 'language'],
  ];
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of columns) {
    if (data[key] !== undefined) {
      params.push(data[key]);
      sets.push(`${col} = $${params.length}`);
    }
  }
  if (sets.length > 0) {
    params.push(userId);
    await query(
      `UPDATE user_settings SET ${sets.join(', ')} WHERE user_id = $${params.length}`,
      params,
    );
  }
  return getUserSettings(userId);
}
