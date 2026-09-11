# ChatRoom API Specification (Shared Contract)

## Project Structure
```
聊天文件室/
├── server/                    # Backend (Node.js + Express + TypeScript)
│   ├── src/
│   │   ├── index.ts           # Entry point
│   │   ├── config/            # Config (db, smtp, env)
│   │   ├── middleware/        # Auth, error handling
│   │   ├── models/            # Database models / queries
│   │   ├── routes/            # REST API routes
│   │   ├── services/          # Business logic
│   │   ├── websocket/         # WebSocket handlers
│   │   ├── temp/              # In-memory temp conversation store
│   │   └── utils/             # Helpers
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── client/                    # Frontend (React + TypeScript + Vite)
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── api/               # API client
│   │   ├── components/        # Reusable components
│   │   ├── pages/             # Page components
│   │   ├── context/           # React context (auth, socket)
│   │   ├── hooks/             # Custom hooks
│   │   ├── types/             # TypeScript types
│   │   └── utils/             # Helpers
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── index.html
├── sql/
│   └── init.sql               # Database initialization script
├── README.md
├── .env.example
└── package.json               # Root package.json with concurrently dev script
```

## Database Tables

### users
- id (UUID, PK, default gen_random_uuid())
- username (VARCHAR(50), UNIQUE, NOT NULL)
- email (VARCHAR(255), UNIQUE)
- password_hash (VARCHAR(255), NOT NULL)
- display_name (VARCHAR(100))
- avatar_url (TEXT)
- is_admin (BOOLEAN, default false)
- is_banned (BOOLEAN, default false)
- is_verified (BOOLEAN, default false)
- created_at (TIMESTAMPTZ, default now())
- last_login_at (TIMESTAMPTZ)

### friendships
- id (SERIAL, PK)
- user_id (UUID, FK -> users.id)
- friend_id (UUID, FK -> users.id)
- status (VARCHAR(20): 'pending' | 'accepted' | 'rejected' | 'blocked')
- created_at (TIMESTAMPTZ, default now())
- UNIQUE(user_id, friend_id)

### conversations
- id (UUID, PK, default gen_random_uuid())
- type (VARCHAR(20): 'private' | 'group', NOT NULL)
- name (VARCHAR(255))  -- group name, null for private
- created_by (UUID, FK -> users.id)
- created_at (TIMESTAMPTZ, default now())

### conversation_members
- conversation_id (UUID, FK -> conversations.id)
- user_id (UUID, FK -> users.id)
- joined_at (TIMESTAMPTZ, default now())
- role (VARCHAR(20): 'member' | 'admin', default 'member')
- PRIMARY KEY (conversation_id, user_id)

### messages
- id (UUID, PK, default gen_random_uuid())
- conversation_id (UUID, FK -> conversations.id)
- sender_id (UUID, FK -> users.id)
- content (TEXT)
- message_type (VARCHAR(20): 'text' | 'image' | 'file', default 'text')
- file_url (TEXT)
- file_name (VARCHAR(255))
- file_size (BIGINT)
- created_at (TIMESTAMPTZ, default now())
- INDEX (conversation_id, created_at)

### group_files
- id (UUID, PK, default gen_random_uuid())
- conversation_id (UUID, FK -> conversations.id)
- uploader_id (UUID, FK -> users.id)
- file_name (VARCHAR(255), NOT NULL)
- file_url (TEXT, NOT NULL)
- file_size (BIGINT)
- file_type (VARCHAR(100))
- created_at (TIMESTAMPTZ, default now())

### system_config
- key (VARCHAR(100), PK)
- value (TEXT)
- updated_at (TIMESTAMPTZ, default now())

## REST API Endpoints

### Setup (Initialization Wizard)
- POST /api/setup/test-db  — Test database connection {host, port, database, username, password}
- POST /api/setup/init     — Complete setup {dbConfig, admin: {username, password, email}, smtp?: {...}}
- GET  /api/setup/status   — Check if system is initialized

### Auth
- POST /api/auth/register      — {username, email, password, displayName} -> {token, user}
- POST /api/auth/login         — {username, password} -> {token, user}
- POST /api/auth/admin-login   — {username, password} -> {token, user} (admin only)
- GET  /api/auth/me            — Auth required -> current user
- POST /api/auth/verify-email  — {token} -> verify email
- POST /api/auth/resend-verification — {email}

### Users / Friends
- GET    /api/users/search?q=     — Search users by username/email
- GET    /api/users/:id/profile   — Get user profile
- PUT    /api/users/profile       — Update own profile {displayName, avatarUrl}
- GET    /api/friends             — List friends (accepted)
- GET    /api/friends/requests    — List pending friend requests
- POST   /api/friends/request     — {userId} -> send friend request
- POST   /api/friends/accept      — {requestId} -> accept
- POST   /api/friends/reject      — {requestId} -> reject
- DELETE /api/friends/:userId     — Remove friend

### Conversations
- GET    /api/conversations              — List my conversations (with last message)
- POST   /api/conversations/private      — {userId} -> create/get private chat
- POST   /api/conversations/group        — {name, memberIds: []} -> create group
- GET    /api/conversations/:id          — Get conversation detail + members
- POST   /api/conversations/:id/members  — {userIds: []} -> add members
- DELETE /api/conversations/:id/members/:userId — Remove member
- PUT    /api/conversations/:id          — {name} -> rename group
- GET    /api/conversations/:id/messages?before=&limit= — Get message history (paginated)
- POST   /api/conversations/:id/messages — {content, messageType, fileUrl?, fileName?, fileSize?} -> create message (also broadcasts via WS)

### Group Files
- GET    /api/conversations/:id/files    — List group files
- POST   /api/conversations/:id/files    — multipart/form-data upload
- GET    /api/files/:id/download         — Download file (redirect or stream)
- DELETE /api/files/:id                  — Delete file (uploader or group admin)

### Temp Conversations
- POST /api/temp/start        — {userId} -> start temp conversation, returns tempId
- GET  /api/temp/:tempId      — Get temp conversation messages (auth + participant check)
- POST /api/temp/:tempId/send — {content} -> send temp message (in-memory only)
- WebSocket: temp messages handled separately

### Admin
- GET    /api/admin/users              — List all users (paginated, search)
- PUT    /api/admin/users/:id/ban      — Ban user
- PUT    /api/admin/users/:id/unban    — Unban user
- GET    /api/admin/stats              — System stats (user count, message count, online count, storage)
- GET    /api/admin/smtp               — Get SMTP config
- PUT    /api/admin/smtp               — Update SMTP config {host, port, user, pass, from, secure}
- POST   /api/admin/smtp/test          — Send test email
- GET    /api/admin/temp-conversations — List active temp conversations (with authorization flag)
- GET    /api/admin/temp-conversations/:id — View temp conversation messages (authorized)

## WebSocket Events

### Connection
- Client connects with auth token in query: ?token=JWT
- Server sends: {type: 'connected', userId}

### Chat Events
- Client -> Server:
  - {type: 'join_conversation', conversationId}
  - {type: 'leave_conversation', conversationId}
  - {type: 'typing', conversationId, isTyping}
  - {type: 'read_receipt', conversationId, messageId}
- Server -> Client:
  - {type: 'new_message', message, conversationId}
  - {type: 'user_typing', conversationId, userId, isTyping}
  - {type: 'message_read', conversationId, userId, messageId}
  - {type: 'friend_request', fromUser}
  - {type: 'friend_accepted', user}
  - {type: 'user_banned'} — if current user gets banned mid-session

### Temp Conversation WS Events
- Client -> Server: {type: 'temp_join', tempId}
- Client -> Server: {type: 'temp_message', tempId, content}
- Server -> Client: {type: 'temp_message', tempId, message, expiresAt}
- Server -> Client: {type: 'temp_expired', tempId}
- Messages auto-delete after 2 minutes (server-side timer)

## Response Format
```json
{ "success": true, "data": {...} }
{ "success": false, "error": "message", "code": "ERROR_CODE" }
```

## Auth
- JWT in Authorization: Bearer <token> header
- Token payload: { userId, isAdmin }
- Banned users get 403 with code: USER_BANNED
