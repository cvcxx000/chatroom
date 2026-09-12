// Shared API types matching the ChatRoom API spec.

export interface User {
  id: string;
  username: string;
  email?: string | null;
  displayName?: string | null;
  display_name?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
  isAdmin?: boolean;
  is_admin?: boolean;
  isBanned?: boolean;
  is_banned?: boolean;
  isVerified?: boolean;
  is_verified?: boolean;
  createdAt?: string;
  created_at?: string;
  lastLoginAt?: string | null;
  last_login_at?: string | null;
}

export type MessageType = 'text' | 'image' | 'file';

export interface Message {
  id: string;
  conversationId?: string;
  conversation_id?: string;
  senderId?: string;
  sender_id?: string;
  sender?: User;
  content: string;
  messageType: MessageType;
  message_type?: MessageType;
  fileUrl?: string | null;
  file_url?: string | null;
  fileName?: string | null;
  file_name?: string | null;
  fileSize?: number | null;
  file_size?: number | null;
  createdAt: string;
  created_at?: string;
  readBy?: string[];
  read_by?: string[];
  isAi?: boolean;
  // ---- message enhancements (reply / reaction / edit / pin) ----
  reactions?: MessageReaction[] | null;
  replyToId?: string | null;
  reply_to_id?: string | null;
  replyTo?: MessageReplyRef | null;
  reply_to?: MessageReplyRef | null;
  isEdited?: boolean;
  is_edited?: boolean;
  isPinned?: boolean;
  is_pinned?: boolean;
}

export interface MessageReaction {
  emoji: string;
  count?: number;
  mine?: boolean;
  users?: string[];
}

export interface MessageReplyRef {
  id: string;
  senderId?: string;
  sender_id?: string;
  senderName?: string;
  sender_name?: string;
  content?: string;
}

export type ConversationType = 'private' | 'group' | 'ai';

export interface ConversationMember {
  userId: string;
  user_id?: string;
  role?: 'member' | 'admin';
  joinedAt?: string;
  joined_at?: string;
  user?: User;
  // Some backends flatten the member's user fields onto the row itself.
  username?: string;
  displayName?: string | null;
  display_name?: string | null;
  avatarUrl?: string | null;
  avatar_url?: string | null;
}

export interface Conversation {
  id: string;
  type: ConversationType;
  name?: string | null;
  createdBy?: string;
  created_by?: string;
  createdAt?: string;
  created_at?: string;
  members?: ConversationMember[];
  lastMessage?: Message | null;
  last_message?: Message | null;
  otherUser?: User | null; // populated for private conversations
  unreadCount?: number;
  unread_count?: number;
}

export type FriendStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';

export interface Friend {
  id?: string;
  userId: string;
  user_id?: string;
  friendId: string;
  friend_id?: string;
  status: FriendStatus;
  createdAt?: string;
  created_at?: string;
  user?: User; // the other side of the friendship
  friend?: User;
  fromUser?: User; // for incoming requests
}

export interface FriendRequest {
  id: string;
  userId: string;
  friendId: string;
  status: FriendStatus;
  createdAt: string;
  user: User; // requester
}

export interface GroupFile {
  id: string;
  conversationId?: string;
  conversation_id?: string;
  uploaderId?: string;
  uploader_id?: string;
  uploader?: User;
  fileName: string;
  file_name?: string;
  fileUrl: string;
  file_url?: string;
  fileSize?: number | null;
  file_size?: number | null;
  fileType?: string | null;
  file_type?: string | null;
  createdAt: string;
  created_at?: string;
}

export interface TempMessage {
  id: string;
  tempId?: string;
  temp_id?: string;
  senderId: string;
  sender_id?: string;
  sender?: User;
  content: string;
  createdAt: string;
  created_at?: string;
  expiresAt: string;
  expires_at?: string;
}

export interface TempConversation {
  tempId: string;
  temp_id?: string;
  participants: User[];
  createdAt?: string;
  created_at?: string;
  expiresAt?: string;
  expires_at?: string;
  messages?: TempMessage[];
  authorized?: boolean;
}

export interface SetupStatus {
  initialized: boolean;
  dbConfigured?: boolean;
}

export interface DbConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

export interface AdminStats {
  userCount: number;
  messageCount: number;
  onlineCount: number;
  storageBytes: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: string;
  code?: string;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// WebSocket payloads
export type WsServerMessage =
  | { type: 'connected'; userId: string }
  | { type: 'new_message'; message: Message; conversationId: string }
  | { type: 'user_typing'; conversationId: string; userId: string; isTyping: boolean }
  | { type: 'message_read'; conversationId: string; userId: string; messageId: string }
  | { type: 'friend_request'; fromUser: User }
  | { type: 'friend_accepted'; user: User }
  | { type: 'user_banned' }
  | { type: 'temp_message'; tempId: string; message: TempMessage; expiresAt: string }
  | { type: 'temp_expired'; tempId: string }
  | { type: 'ai_stream'; conversationId: string; messageId: string; delta: string; done?: boolean }
  | { type: 'terminal_attached'; containerId: string }
  | { type: 'terminal_output'; containerId: string; data: string }
  | { type: 'terminal_closed'; containerId: string }
  | { type: 'terminal_error'; containerId: string; error: string }
  | { type: 'error'; message: string };

export type WsClientMessage =
  | { type: 'join_conversation'; conversationId: string }
  | { type: 'leave_conversation'; conversationId: string }
  | { type: 'typing'; conversationId: string; isTyping: boolean }
  | { type: 'read_receipt'; conversationId: string; messageId: string }
  | { type: 'temp_join'; tempId: string }
  | { type: 'temp_message'; tempId: string; content: string }
  | { type: 'terminal'; containerId: string }
  | { type: 'terminal_input'; containerId: string; data: string }
  | { type: 'terminal_resize'; containerId: string; cols: number; rows: number };

// ---------- Shared links ----------
export interface SharedLink {
  token: string;
  url: string;
  expiresAt: string;
  hasPassword: boolean;
  conversationId: string;
}

export interface ShareInfo {
  conversationId: string;
  type: 'private' | 'group' | 'ai';
  name?: string | null;
  requiresPassword: boolean;
  expiresAt: string;
}

// ---------- QR login ----------
export interface QrSession {
  token: string;
  expiresAt: string;
  status: 'pending' | 'scanned' | 'confirmed' | 'expired';
  user?: User;
}

// ---------- AI ----------
export interface AiConfig {
  id: string;
  provider: string;
  name: string;
  baseUrl: string;
  apiKey?: string; // masked from admin
  model: string;
  isActive: boolean;
  createdAt: string;
}

export interface AiProvider {
  id: string;
  provider: string;
  name: string;
  model: string;
}

// ---------- User settings & profile ----------
export type FontSize = 'small' | 'medium' | 'large';
export type ThemePreference = 'light' | 'dark' | 'system';

export interface UserSettings {
  theme?: ThemePreference;
  fontSize?: FontSize;
  notifications?: boolean;
  sound?: boolean;
  tempReminder?: boolean;
  enterToSend?: boolean;
  messagePreview?: boolean;
  autoDownload?: boolean;
  [key: string]: unknown;
}

export type UserStatusType = 'online' | 'away' | 'busy' | 'offline';

export interface UserStatus {
  userId: string;
  user_id?: string;
  status: UserStatusType;
  customMessage?: string;
  custom_message?: string;
  updatedAt?: string;
  updated_at?: string;
}

export interface MessageReaction {
  id: string;
  messageId: string;
  message_id?: string;
  userId: string;
  user_id?: string;
  emoji: string;
  createdAt?: string;
  created_at?: string;
  user?: User;
}

export interface ConversationSettings {
  conversationId: string;
  conversation_id?: string;
  muted?: boolean;
  pinned?: boolean;
  archived?: boolean;
  nicknames?: Record<string, string>;
  customNotifications?: boolean;
  custom_notifications?: boolean;
}

export interface GroupAnnouncement {
  conversationId?: string;
  conversation_id?: string;
  announcement?: string | null;
  announcementText?: string | null;
  content?: string | null;
  updatedAt?: string | null;
  updated_at?: string | null;
}

export interface GroupQrCode {
  conversationId?: string;
  conversation_id?: string;
  token: string;
  url?: string;
  expiresAt?: string | null;
  expires_at?: string | null;
}

export interface QuickReply {
  id: string;
  title: string;
  content: string;
  shortcut?: string | null;
  sortOrder?: number;
  sort_order?: number;
  createdAt?: string;
  created_at?: string;
}

export type AiProviderKind = 'qwen' | 'doubao' | 'deepseek' | 'zhipu' | 'custom';

export interface UserAiConfig {
  id: string;
  provider: AiProviderKind | string;
  name: string;
  baseUrl: string;
  base_url?: string;
  apiKey?: string;
  model: string;
  isActive?: boolean;
  createdAt?: string;
  created_at?: string;
}
