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

  // 消息与通知
  vibrate: boolean;
  desktop_notifications: boolean;
  auto_play_voice: boolean;
  auto_download_image: boolean;
  auto_download_file: boolean;
  group_mention_notify: boolean;
  friend_request_notify: boolean;
  system_announcement_notify: boolean;
  do_not_disturb: boolean;
  notification_sound: string;

  // 外观与显示
  theme_color: string;
  bubble_style: string;
  show_message_time: boolean;
  show_online_status: boolean;
  show_typing_status: boolean;
  read_receipts: boolean;
  avatar_shape: string;
  compact_mode: boolean;
  animations_enabled: boolean;

  // 隐私与安全
  who_can_add_me: string;
  who_can_see_online: string;
  who_can_see_profile: string;
  allow_stranger_temp_chat: boolean;
  allow_group_invite: boolean;
  e2e_encryption: boolean;
  screenshot_notification: boolean;
  anti_harassment: boolean;
  keyword_filter: string | null;
  show_ip_location: boolean;

  // 其他
  quick_reply_enabled: boolean;
  auto_archive_inactive: boolean;
  developer_mode: boolean;
  performance_monitor: boolean;
  network_proxy: string | null;
  login_expiry_hours: number;
  two_factor_enabled: boolean;
  auto_login: boolean;
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

  // 消息与通知
  vibrate: true,
  desktop_notifications: true,
  auto_play_voice: true,
  auto_download_image: true,
  auto_download_file: false,
  group_mention_notify: true,
  friend_request_notify: true,
  system_announcement_notify: true,
  do_not_disturb: false,
  notification_sound: 'default',

  // 外观与显示
  theme_color: 'blue',
  bubble_style: 'default',
  show_message_time: true,
  show_online_status: true,
  show_typing_status: true,
  read_receipts: true,
  avatar_shape: 'circle',
  compact_mode: false,
  animations_enabled: true,

  // 隐私与安全
  who_can_add_me: 'everyone',
  who_can_see_online: 'friends',
  who_can_see_profile: 'everyone',
  allow_stranger_temp_chat: true,
  allow_group_invite: true,
  e2e_encryption: false,
  screenshot_notification: false,
  anti_harassment: false,
  keyword_filter: null,
  show_ip_location: false,

  // 其他
  quick_reply_enabled: true,
  auto_archive_inactive: false,
  developer_mode: false,
  performance_monitor: false,
  network_proxy: null,
  login_expiry_hours: 72,
  two_factor_enabled: false,
  auto_login: false,
};

/** Columns allowed in partial updates (key = interface field, col = DB column name). */
const SETTINGS_COLUMNS: [keyof typeof DEFAULT_SETTINGS, string][] = [
  ['theme', 'theme'],
  ['font_size', 'font_size'],
  ['enter_to_send', 'enter_to_send'],
  ['message_preview', 'message_preview'],
  ['auto_download', 'auto_download'],
  ['notifications_enabled', 'notifications_enabled'],
  ['sound_enabled', 'sound_enabled'],
  ['language', 'language'],

  ['vibrate', 'vibrate'],
  ['desktop_notifications', 'desktop_notifications'],
  ['auto_play_voice', 'auto_play_voice'],
  ['auto_download_image', 'auto_download_image'],
  ['auto_download_file', 'auto_download_file'],
  ['group_mention_notify', 'group_mention_notify'],
  ['friend_request_notify', 'friend_request_notify'],
  ['system_announcement_notify', 'system_announcement_notify'],
  ['do_not_disturb', 'do_not_disturb'],
  ['notification_sound', 'notification_sound'],

  ['theme_color', 'theme_color'],
  ['bubble_style', 'bubble_style'],
  ['show_message_time', 'show_message_time'],
  ['show_online_status', 'show_online_status'],
  ['show_typing_status', 'show_typing_status'],
  ['read_receipts', 'read_receipts'],
  ['avatar_shape', 'avatar_shape'],
  ['compact_mode', 'compact_mode'],
  ['animations_enabled', 'animations_enabled'],

  ['who_can_add_me', 'who_can_add_me'],
  ['who_can_see_online', 'who_can_see_online'],
  ['who_can_see_profile', 'who_can_see_profile'],
  ['allow_stranger_temp_chat', 'allow_stranger_temp_chat'],
  ['allow_group_invite', 'allow_group_invite'],
  ['e2e_encryption', 'e2e_encryption'],
  ['screenshot_notification', 'screenshot_notification'],
  ['anti_harassment', 'anti_harassment'],
  ['keyword_filter', 'keyword_filter'],
  ['show_ip_location', 'show_ip_location'],

  ['quick_reply_enabled', 'quick_reply_enabled'],
  ['auto_archive_inactive', 'auto_archive_inactive'],
  ['developer_mode', 'developer_mode'],
  ['performance_monitor', 'performance_monitor'],
  ['network_proxy', 'network_proxy'],
  ['login_expiry_hours', 'login_expiry_hours'],
  ['two_factor_enabled', 'two_factor_enabled'],
  ['auto_login', 'auto_login'],
];

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
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const [key, col] of SETTINGS_COLUMNS) {
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
