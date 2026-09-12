export interface User {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  display_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
  is_banned: boolean;
  is_verified: boolean;
  created_at: Date;
  last_login_at: Date | null;
}

export interface SafeUser {
  id: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  isVerified: boolean;
  createdAt: Date;
}

export function toSafeUser(u: User): SafeUser {
  return {
    id: u.id,
    username: u.username,
    displayName: u.display_name,
    avatarUrl: u.avatar_url,
    isAdmin: u.is_admin,
    isVerified: u.is_verified,
    createdAt: u.created_at,
  };
}

export interface Friendship {
  id: number;
  user_id: string;
  friend_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  created_at: Date;
}

export interface Conversation {
  id: string;
  type: 'private' | 'group' | 'ai';
  name: string | null;
  created_by: string | null;
  created_at: Date;
}

export interface ConversationMember {
  conversation_id: string;
  user_id: string;
  joined_at: Date;
  role: 'member' | 'admin';
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: 'text' | 'image' | 'file';
  file_url: string | null;
  file_name: string | null;
  file_size: string | null;
  created_at: Date;
}

export interface GroupFile {
  id: string;
  conversation_id: string;
  uploader_id: string;
  file_name: string;
  file_url: string;
  file_size: string | null;
  file_type: string | null;
  created_at: Date;
}

export interface SharedLink {
  id: string;
  conversation_id: string;
  token: string;
  expires_at: Date;
  password_hash: string | null;
  created_by: string | null;
  created_at: Date;
}

export type QrStatus = 'pending' | 'scanned' | 'confirmed' | 'expired';

export interface QrSession {
  id: string;
  token: string;
  user_id: string | null;
  status: QrStatus;
  expires_at: Date;
  created_at: Date;
}

export interface AiConfig {
  id: string;
  provider: string;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  is_active: boolean;
  created_at: Date;
}
