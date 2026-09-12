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
}

export type ConversationType = 'private' | 'group' | 'ai';

export interface ConversationMember {
  userId: string;
  user_id?: string;
  role?: 'member' | 'admin';
  joinedAt?: string;
  joined_at?: string;
  user?: User;
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
  | { type: 'error'; message: string };

export type WsClientMessage =
  | { type: 'join_conversation'; conversationId: string }
  | { type: 'leave_conversation'; conversationId: string }
  | { type: 'typing'; conversationId: string; isTyping: boolean }
  | { type: 'read_receipt'; conversationId: string; messageId: string }
  | { type: 'temp_join'; tempId: string }
  | { type: 'temp_message'; tempId: string; content: string };

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
