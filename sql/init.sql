-- ChatRoom Database Initialization
-- Run against PostgreSQL. Requires pgcrypto extension for gen_random_uuid().

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      VARCHAR(50) UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name  VARCHAR(100),
    avatar_url    TEXT,
    is_admin      BOOLEAN NOT NULL DEFAULT FALSE,
    is_banned     BOOLEAN NOT NULL DEFAULT FALSE,
    is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_login_at TIMESTAMPTZ
);

-- ============================================================
-- friendships
-- ============================================================
CREATE TABLE IF NOT EXISTS friendships (
    id         SERIAL PRIMARY KEY,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    friend_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status     VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, friend_id),
    CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked'))
);

CREATE INDEX IF NOT EXISTS idx_friendships_user_id   ON friendships(user_id);
CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id);
CREATE INDEX IF NOT EXISTS idx_friendships_status   ON friendships(status);

-- ============================================================
-- conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS conversations (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type       VARCHAR(20) NOT NULL,
    name       VARCHAR(255),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (type IN ('private', 'group'))
);

-- ============================================================
-- conversation_members
-- ============================================================
CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    role            VARCHAR(20) NOT NULL DEFAULT 'member',
    PRIMARY KEY (conversation_id, user_id),
    CHECK (role IN ('member', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_conv_members_user_id ON conversation_members(user_id);

-- ============================================================
-- messages
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content         TEXT,
    message_type    VARCHAR(20) NOT NULL DEFAULT 'text',
    file_url        TEXT,
    file_name       VARCHAR(255),
    file_size       BIGINT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (message_type IN ('text', 'image', 'file'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender       ON messages(sender_id);

-- ============================================================
-- group_files
-- ============================================================
CREATE TABLE IF NOT EXISTS group_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    uploader_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name       VARCHAR(255) NOT NULL,
    file_url        TEXT NOT NULL,
    file_size       BIGINT,
    file_type       VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_files_conv ON group_files(conversation_id, created_at DESC);

-- ============================================================
-- system_config
-- ============================================================
CREATE TABLE IF NOT EXISTS system_config (
    key       VARCHAR(100) PRIMARY KEY,
    value     TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- shared_links
-- ============================================================
CREATE TABLE IF NOT EXISTS shared_links (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    token         VARCHAR(64) UNIQUE NOT NULL,
    expires_at    TIMESTAMPTZ NOT NULL,
    password_hash VARCHAR(255),
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shared_links_token ON shared_links(token);
CREATE INDEX IF NOT EXISTS idx_shared_links_conv ON shared_links(conversation_id);

-- ============================================================
-- qr_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS qr_sessions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token      VARCHAR(64) UNIQUE NOT NULL,
    user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
    status     VARCHAR(20) NOT NULL DEFAULT 'pending',
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status IN ('pending','scanned','confirmed','expired'))
);
CREATE INDEX IF NOT EXISTS idx_qr_sessions_token ON qr_sessions(token);

-- ============================================================
-- ai_configs
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_configs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider   VARCHAR(50) NOT NULL,
    name       VARCHAR(100) NOT NULL,
    base_url   TEXT NOT NULL,
    api_key    TEXT NOT NULL,
    model      VARCHAR(100) NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allow 'ai' conversation type (existing table).
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_type_check;
ALTER TABLE conversations ADD CONSTRAINT conversations_type_check CHECK (type IN ('private','group','ai'));

-- ============================================================
-- message_reactions (消息表情反应)
-- ============================================================
CREATE TABLE IF NOT EXISTS message_reactions (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji      VARCHAR(32) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (message_id, user_id, emoji)
);
CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id);

-- ============================================================
-- pinned_messages (置顶消息)
-- ============================================================
CREATE TABLE IF NOT EXISTS pinned_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    message_id      UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    pinned_by       UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conversation_id, message_id)
);
CREATE INDEX IF NOT EXISTS idx_pinned_messages_conv ON pinned_messages(conversation_id);

-- ============================================================
-- user_status (用户在线状态)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_status (
    user_id      UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status       VARCHAR(20) NOT NULL DEFAULT 'offline',
    status_text  VARCHAR(255),
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (status IN ('online','away','busy','offline'))
);

-- ============================================================
-- user_settings (用户个人设置)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_settings (
    user_id             UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    theme               VARCHAR(20) NOT NULL DEFAULT 'system',
    font_size           INT NOT NULL DEFAULT 14,
    enter_to_send       BOOLEAN NOT NULL DEFAULT true,
    message_preview     BOOLEAN NOT NULL DEFAULT true,
    auto_download       BOOLEAN NOT NULL DEFAULT true,
    notifications_enabled BOOLEAN NOT NULL DEFAULT true,
    sound_enabled       BOOLEAN NOT NULL DEFAULT true,
    language            VARCHAR(20) NOT NULL DEFAULT 'zh-CN',
    CHECK (theme IN ('light','dark','system'))
);

-- ============================================================
-- conversation_settings (会话级个人设置)
-- ============================================================
CREATE TABLE IF NOT EXISTS conversation_settings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_pinned       BOOLEAN NOT NULL DEFAULT false,
    is_muted        BOOLEAN NOT NULL DEFAULT false,
    is_archived     BOOLEAN NOT NULL DEFAULT false,
    UNIQUE (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_settings_user ON conversation_settings(user_id);

-- ============================================================
-- group_announcements (群公告)
-- ============================================================
CREATE TABLE IF NOT EXISTS group_announcements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_group_announcements_conv ON group_announcements(conversation_id);

-- ============================================================
-- group_nicknames (群昵称)
-- ============================================================
CREATE TABLE IF NOT EXISTS group_nicknames (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname        VARCHAR(100) NOT NULL,
    UNIQUE (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_nicknames_conv ON group_nicknames(conversation_id);

-- ============================================================
-- blocked_users (拉黑)
-- ============================================================
CREATE TABLE IF NOT EXISTS blocked_users (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, blocked_user_id),
    CHECK (user_id <> blocked_user_id)
);
CREATE INDEX IF NOT EXISTS idx_blocked_users_user ON blocked_users(user_id);

-- ============================================================
-- quick_replies (快捷回复)
-- ============================================================
CREATE TABLE IF NOT EXISTS quick_replies (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(100) NOT NULL,
    content    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quick_replies_user ON quick_replies(user_id);

-- ============================================================
-- user_ai_configs (用户自定义 AI 配置)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_ai_configs (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider   VARCHAR(50) NOT NULL,
    name       VARCHAR(100) NOT NULL,
    base_url   TEXT NOT NULL,
    api_key    TEXT NOT NULL,
    model      VARCHAR(100) NOT NULL,
    is_active  BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_ai_configs_user ON user_ai_configs(user_id);
