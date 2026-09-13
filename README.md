<div align="center">

# 🚀 ChatRoom - 开源即时通讯平台

### 企业级全栈即时通讯解决方案

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js->=18-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue.svg)](https://www.postgresql.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-orange.svg)]()

**实时同步 · 端到端体验 · 私有化部署 · 完全开源**

[功能特性](#-核心特性) • [快速开始](#-快速开始) • [部署指南](#-部署指南) • [AI 配置](#-ai-配置指南) • [API 文档](./API_SPEC.md)

</div>

---

## 📖 项目简介

**ChatRoom** 是一款面向新时代的开源即时通讯平台。我们坚信，通讯软件不应该被巨头垄断，每个人都应该拥有属于自己的、可控的、安全的聊天空间。

本项目从零开始构建，采用业界最前沿的技术栈，前后端分离架构，支持私有化部署。无论是团队内部协作、社区交流、还是个人私域运营，ChatRoom 都能为你提供媲美商业级产品的通讯体验，而所有数据完全掌握在你自己手中。

我们不仅仅是在做一个聊天工具，更是在构建一个开放的通讯生态。项目代码完全开源，无任何隐藏依赖，无遥测追踪，无后门。你可以自由地使用、修改、分发，甚至基于此打造属于自己的商业产品。

---

## ✨ 核心特性

### 1. 💬 实时消息同步

基于 **WebSocket** 长连接技术，实现毫秒级消息推送。无论你是在私聊还是群聊，消息都能瞬间送达。支持离线消息同步——当用户重新上线时，所有未读消息会自动拉取，绝不遗漏任何一条重要信息。

- 实时在线状态显示
- 消息已读/未读状态
- 输入中指示器（Typing Indicator）
- 断线自动重连机制
- 离线消息批量同步

### 2. 👥 私聊与群聊

完整支持一对一私聊和多人群聊两种模式。群聊功能丰富，支持创建群、邀请成员、退出群、解散群、群主转让等完整生命周期管理。

- 无限群成员数量
- 群公告与群设置
- 群成员管理
- 群主权限体系
- 会话列表智能排序

### 3. 📁 群文件共享

每个群都拥有独立的文件空间，成员可以上传、下载、管理共享文件。支持图片、文档、压缩包等任意格式，文件永久保存在你的服务器上。

- 拖拽上传
- 文件预览
- 下载计数
- 上传者信息记录
- 按时间排序

### 4. 🔥 临时对话模式（阅后即焚）

这是 ChatRoom 的杀手级功能。用户可以发起**临时对话**，所有消息仅存储在服务器内存中，**2 分钟后自动彻底删除**，不写入任何持久化存储。

- 消息不落盘，仅存内存
- 120 秒倒计时自动销毁
- 双方均无法查看历史记录
- 管理员需特殊授权才可查看
- 独立的视觉标识，明确区分普通对话
- 定时清理任务，确保数据安全

### 5. 🔐 管理员后台

内置强大的管理员系统，独立登录入口，全面掌控平台运营。

- **用户管理**：查看所有注册用户，支持封禁/解封操作
- **封禁系统**：被封禁用户无法登录、无法发送消息
- **系统监控**：实时查看在线人数、消息量、系统状态
- **邮箱配置**：可视化配置 SMTP 邮件服务
- **AI 配置**：管理多个 AI 提供商的 API Key，支持千问、豆包、DeepSeek、智谱及自定义模型
- **临时对话监控**：管理员授权后可查看活跃临时对话
- **操作日志**：记录管理员所有操作

### 6. 📧 邮件通知系统

集成 Nodemailer，支持标准 SMTP 协议。可在管理员后台可视化配置邮箱服务，用于发送验证邮件、通知邮件、系统公告等。

- 支持 QQ 邮箱、163 邮箱、Gmail、企业邮箱等
- 可视化配置界面
- 邮件模板系统
- 发送状态追踪

### 7. ⚙️ 初始化向导

首次部署无需手动编辑配置文件，浏览器打开即可进入**初始化向导**，三步完成系统配置：

1. **数据库配置**：填写数据库主机、端口、用户名、密码、数据库名
2. **管理员设置**：创建管理员账号和密码
3. **完成初始化**：系统自动创建数据表、写入配置、准备就绪

整个过程不到 2 分钟，即使是非技术用户也能轻松完成部署。

### 8. 🔗 共享链接邀请

用户可以为群聊生成**共享邀请链接**，其他人通过链接即可一键加入群聊，无需手动搜索添加。

- 支持设置有效期（24 小时 / 72 小时 / 7 天）
- 可选设置访问密码
- 独立的公开加入页面，无需登录即可预览
- 链接可随时撤销失效

### 9. 📱 二维码扫码登录

支持 PC 端显示二维码，手机端已登录用户扫码后确认即可完成 PC 端登录，无需输入账号密码。

- 登录页双 Tab 切换：账号登录 / 扫码登录
- 二维码实时生成，5 分钟有效期
- PC 端轮询等待确认，扫码成功自动跳转
- 用户端「扫一扫」入口，确认后即时登录

### 10. 📱 移动端适配

全面响应式设计，手机、平板、桌面端完美适配。

- 768px 以下侧边栏全屏展示，点击会话进入聊天页
- 聊天页带返回按钮，操作手势符合移动端习惯
- 输入框、按钮、字体大小自适应
- 管理员后台同步适配

### 11. 🔔 好友请求实时通知

好友请求通过 WebSocket 实时推送，不再需要手动刷新。

- 收到好友请求时页面内弹出 Toast 通知
- 好友标签页显示未读请求数量角标
- 支持手动刷新按钮
- 接受/拒绝后状态实时同步

### 12. 🤖 AI 智能对话

内置 AI 对话能力，管理员配置 API Key 后，用户可直接与 AI 私聊，也可在群聊中 @AI 获得回复。

- **多提供商支持**：千问（通义千问）、豆包（字节）、DeepSeek、智谱（GLM）
- **自定义模型**：支持填入任意 OpenAI 兼容接口的 base_url、模型名、API Key
- **AI 私聊**：一键创建与 AI 的独立对话
- **群聊 @AI**：在群聊中 @AI 机器人，AI 会针对上下文回复
- **流式输出**：AI 回复逐字推送，体验流畅
- **AI 消息标识**：机器人头像 + "AI" 标签，明确区分
- **密钥安全**：API Key 仅存储于服务端，前端不可见

### 13. 🛡️ 安全与隐私

- JWT 身份认证，Token 过期自动刷新
- bcrypt 密码加密存储
- API 速率限制，防止暴力破解
- CORS 跨域保护
- 输入验证与 SQL 注入防护
- 临时对话内存存储，不留痕迹
- 所有数据存储在你自己的服务器

### 14. 💻 虚拟终端（Docker 容器）

在聊天界面中直接打开一个**隔离的 Linux 终端**，基于 Docker 容器实现，每个用户拥有独立的沙箱环境，互不干扰。

- **资源硬限制**：每容器 0.5 核 CPU、512MB 内存，不分配 GPU，防止资源滥用
- **完全隔离**：每个用户一个独立容器，容器之间文件系统、进程、网络完全隔离
- **安全加固**：非 root 用户运行、只读根文件系统、tmpfs 挂载可写目录
- **实时交互**：基于 xterm.js 的 Web 终端，支持 Ctrl+C / Ctrl+D 等特殊键、窗口自适应 resize
- **自动清理**：30 分钟无活动自动销毁容器，用户退出时停止并删除，防止资源泄漏
- **优雅降级**：服务器未安装 Docker 时功能自动禁用，前端显示友好提示，不影响其他功能
- **管理员管控**：后台可查看所有运行中容器、强制停止、配置默认资源限制

> **前置要求**：服务器需安装 Docker 并运行 Docker daemon。未安装时虚拟终端功能不可用，其余功能正常。

---

## 🏗️ 技术架构

### 后端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| Node.js | >= 18 | 运行时环境 |
| Express | 4.x | Web 框架 |
| TypeScript | 5.5 | 类型安全 |
| ws | 8.x | WebSocket 实时通信 |
| PostgreSQL | 16+ | 关系型数据库 |
| JWT | 9.x | 身份认证 |
| bcryptjs | 2.4 | 密码加密 |
| Nodemailer | 6.x | 邮件发送 |
| Multer | 1.4 | 文件上传 |
| qrcode | 1.x | 二维码生成 |
| OpenAI 兼容 API | - | AI 对话服务 |
| dockerode | 3.x | Docker 容器管理（虚拟终端） |

### 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3 | UI 框架 |
| TypeScript | 5.5 | 类型安全 |
| Vite | 5.x | 构建工具 |
| React Router | 6.x | 路由管理 |
| Axios | 1.7 | HTTP 客户端 |
| WebSocket API | 原生 | 实时通信 |
| xterm.js | 5.x | Web 终端渲染（虚拟终端） |

### 架构设计

```
┌─────────────────────────────────────────────────┐
│                   浏览器客户端                     │
│  React + TypeScript + Vite + WebSocket Client    │
└────────────────────┬────────────────────────────┘
                     │ HTTP / WebSocket
┌────────────────────▼────────────────────────────┐
│                  Express 服务器                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│  │ REST API │ │WebSocket│ │  定时任务/临时存储  │ │
│  └────┬─────┘ └────┬─────┘ └──────────────────┘ │
│       │             │                            │
│  ┌────▼─────────────▼─────┐                      │
│  │    业务逻辑层 (Services) │                     │
│  └────┬───────────────────┘                      │
└───────┼──────────────────────────────────────────┘
        │
┌───────▼──────────┐    ┌──────────────┐
│   PostgreSQL     │    │   内存存储     │
│  (持久化数据)     │    │ (临时对话)     │
└──────────────────┘    └──────────────┘
```

---

## 🚀 快速开始

### 环境要求

- Node.js >= 18.0.0
- PostgreSQL >= 13
- npm >= 9.0.0
- Docker（可选，用于虚拟终端功能；未安装时该功能自动禁用，不影响其他功能）

### 一键启动

```bash
# 1. 克隆项目
git clone https://github.com/your-username/chatroom.git
cd chatroom

# 2. 安装所有依赖
npm run install:all

# 3. 配置环境变量
cp server/.env.example server/.env
# 编辑 server/.env，填入你的数据库配置

# 4. 初始化数据库
psql -U postgres -f sql/init.sql

# 5. 启动开发服务器
npm run dev
```

启动后访问：
- 应用界面：http://localhost:4000（前端构建后由后端统一托管）
- 后端 API：http://localhost:4000
- 开发模式前端：http://localhost:5173（需单独启动 `cd client && npm run dev`）
- 首次访问会自动进入初始化向导

### 生产构建

```bash
# 构建前后端
npm run build

# 启动生产服务器
npm start
```

---

## 📦 部署指南

### 方式一：VPS 部署（推荐）

1. 购买一台 VPS（推荐 2核4G 以上配置）
2. 安装 Node.js 和 PostgreSQL
3. 按照快速开始步骤部署
4. 使用 Nginx 反向代理，配置 HTTPS
5. 使用 PM2 守护进程

### 方式二：Docker 部署

项目支持 Docker 容器化部署（需自行编写 Dockerfile），适合 Kubernetes 等容器编排环境。

### 配置说明

所有配置通过 `server/.env` 文件管理，主要配置项：

```env
# 服务器配置
PORT=3000
NODE_ENV=production

# 数据库配置
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=chatroom

# JWT 密钥（生产环境务必修改）
JWT_SECRET=your_secret_key

# 管理员初始密码
ADMIN_PASSWORD=admin123

# 邮箱配置（可选）
EMAIL_HOST=smtp.example.com
EMAIL_PORT=587
EMAIL_USER=your@email.com
EMAIL_PASS=your_password
```

---

## 🤖 AI 配置指南

管理员登录后台后，进入「AI 配置」页面，可添加多个 AI 提供商。系统采用 OpenAI 兼容接口，支持主流大模型平台。

### 支持的提供商

| 提供商 | 默认 base_url | 推荐模型 |
|--------|--------------|----------|
| 千问（通义千问） | `https://dashscope.aliyuncs.com/compatible-mode/v1` | qwen-plus / qwen-turbo |
| 豆包（字节） | `https://ark.cn-beijing.volces.com/api/v3` | doubao-pro / doubao-lite |
| DeepSeek | `https://api.deepseek.com/v1` | deepseek-chat |
| 智谱（GLM） | `https://open.bigmodel.cn/api/paas/v4` | glm-4 / glm-3-turbo |
| 自定义 | 用户自行填写 | 任意 OpenAI 兼容模型 |

### 配置步骤

1. 以管理员身份登录，进入后台「AI 配置」
2. 点击「新增配置」，选择提供商或选择「自定义」
3. 填入 API Key、模型名称（自定义模式还需填写 base_url）
4. 保存后启用该配置
5. 用户端点击「+ AI 对话」即可选择已启用的 AI 开始对话

### 注意事项

- API Key 仅存储在服务端数据库，前端无法获取
- 未配置任何 AI 时，用户发起 AI 对话会收到友好提示
- 群聊中 @AI 时，AI 会读取最近的上下文消息进行回复
- AI 回复采用流式输出，逐字推送到前端

---

## 📁 项目结构

```
chatroom/
├── client/                    # 前端 React 应用
│   ├── src/
│   │   ├── api/              # API 接口层
│   │   ├── components/       # 通用组件
│   │   ├── context/          # React Context
│   │   ├── pages/            # 页面组件
│   │   │   ├── SetupWizard.tsx    # 初始化向导
│   │   │   ├── Login.tsx          # 用户登录（含扫码登录）
│   │   │   ├── Register.tsx       # 用户注册
│   │   │   ├── MainChat.tsx       # 主聊天界面
│   │   │   ├── ShareJoin.tsx      # 共享链接加入页
│   │   │   ├── AdminLogin.tsx     # 管理员登录
│   │   │   └── AdminPanel.tsx     # 管理员后台（含 AI 配置）
│   │   ├── styles/           # 样式文件
│   │   ├── types/            # TypeScript 类型
│   │   └── utils/            # 工具函数
│   ├── index.html
│   └── vite.config.ts
├── server/                    # 后端 Express 应用
│   ├── src/
│   │   ├── config/           # 配置模块
│   │   ├── middleware/       # 中间件（认证、限流等）
│   │   ├── models/           # 数据模型
│   │   ├── routes/           # 路由定义
│   │   │   ├── auth.ts           # 认证路由
│   │   │   ├── users.ts          # 用户路由
│   │   │   ├── friends.ts        # 好友路由
│   │   │   ├── conversations.ts  # 会话路由
│   │   │   ├── files.ts          # 文件路由
│   │   │   ├── temp.ts           # 临时对话路由
│   │   │   ├── admin.ts          # 管理员路由
│   │   │   ├── share.ts          # 共享链接路由
│   │   │   ├── qrcode.ts         # 扫码登录路由
│   │   │   ├── ai.ts             # AI 对话路由
│   │   │   ├── terminal.ts       # 虚拟终端路由
│   │   │   └── setup.ts          # 初始化路由
│   │   ├── services/         # 业务服务（邮件、AI、Docker 等）
│   │   │   ├── email.ts          # 邮件服务
│   │   │   ├── ai.ts             # AI 对话服务（OpenAI 兼容）
│   │   │   └── docker.ts         # Docker 容器管理（虚拟终端）
│   │   ├── temp/             # 临时对话内存存储
│   │   ├── utils/            # 工具函数
│   │   ├── websocket/        # WebSocket 服务
│   │   └── index.ts          # 入口文件
│   └── tsconfig.json
├── sql/
│   └── init.sql             # 数据库初始化脚本
├── .env.example             # 环境变量示例
├── API_SPEC.md              # API 接口文档
├── package.json
└── README.md
```

---

## 🔌 API 概览

完整 API 文档请参考 [API_SPEC.md](./API_SPEC.md)。

### 主要接口

| 模块 | 接口 | 说明 |
|------|------|------|
| 认证 | `POST /api/auth/register` | 用户注册 |
| 认证 | `POST /api/auth/login` | 用户登录 |
| 认证 | `POST /api/auth/admin-login` | 管理员登录 |
| 用户 | `GET /api/users/me` | 获取当前用户 |
| 用户 | `GET /api/users/search` | 搜索用户 |
| 好友 | `GET /api/friends` | 获取好友列表 |
| 好友 | `GET /api/friends/requests` | 好友请求列表 |
| 好友 | `POST /api/friends/request` | 发送好友请求 |
| 好友 | `POST /api/friends/accept` | 接受好友请求 |
| 好友 | `POST /api/friends/reject` | 拒绝好友请求 |
| 会话 | `GET /api/conversations` | 获取会话列表 |
| 会话 | `POST /api/conversations/private` | 创建私聊 |
| 会话 | `POST /api/conversations/group` | 创建群聊 |
| 消息 | `GET /api/conversations/:id/messages` | 获取历史消息 |
| 消息 | `POST /api/conversations/:id/messages` | 发送消息 |
| 群文件 | `GET /api/conversations/:id/files` | 获取群文件 |
| 群文件 | `POST /api/conversations/:id/files` | 上传群文件 |
| 临时对话 | `POST /api/temp/start` | 创建临时对话 |
| 临时对话 | `POST /api/temp/:tempId/send` | 发送临时消息 |
| 共享链接 | `POST /api/share/create` | 生成共享链接 |
| 共享链接 | `GET /api/share/:token` | 获取共享链接信息 |
| 共享链接 | `POST /api/share/:token/join` | 通过链接加入群聊 |
| 扫码登录 | `POST /api/qrcode/create` | 生成扫码登录 Token |
| 扫码登录 | `POST /api/qrcode/:token/confirm` | 手机端确认登录 |
| 扫码登录 | `GET /api/qrcode/:token/status` | PC 端轮询登录状态 |
| AI 对话 | `POST /api/ai/conversation` | 创建 AI 对话 |
| AI 对话 | `POST /api/ai/:id/chat` | 发送 AI 消息（流式） |
| AI 配置 | `GET /api/admin/ai-configs` | 获取 AI 配置列表 |
| AI 配置 | `POST /api/admin/ai-configs` | 新增 AI 配置 |
| AI 配置 | `PUT /api/admin/ai-configs/:id` | 更新 AI 配置 |
| AI 配置 | `DELETE /api/admin/ai-configs/:id` | 删除 AI 配置 |
| 虚拟终端 | `POST /api/terminal/start` | 启动终端容器 |
| 虚拟终端 | `POST /api/terminal/:id/stop` | 停止并删除容器 |
| 虚拟终端 | `GET /api/terminal/:id/status` | 查询容器状态 |
| 虚拟终端 | `WS /ws` (type:terminal) | WebSocket 终端输入输出流 |
| 管理员 | `GET /api/admin/users` | 用户列表 |
| 管理员 | `PUT /api/admin/users/:id/ban` | 封禁用户 |
| 管理员 | `PUT /api/admin/users/:id/unban` | 解封用户 |
| 管理员 | `GET /api/admin/stats` | 系统统计 |
| 管理员 | `GET /api/admin/smtp` | 获取 SMTP 配置 |
| 管理员 | `PUT /api/admin/smtp` | 更新 SMTP 配置 |
| 管理员 | `GET /api/admin/temp-conversations` | 活跃临时对话 |
| 管理员 | `GET /api/admin/terminals` | 运行中终端容器列表 |
| 管理员 | `POST /api/admin/terminals/:id/stop` | 强制停止终端容器 |
| 初始化 | `POST /api/setup/init` | 系统初始化 |
| 初始化 | `GET /api/setup/status` | 初始化状态 |

---

## 🔒 安全审计报告

本项目经过全面安全审计，共修复 **46 个安全漏洞**，覆盖以下 10 大类：

### 严重 / 高危漏洞（13 个）

| 漏洞类型 | 修复内容 |
|----------|----------|
| 初始化重置 | 修复 setup 接口可重复调用导致管理员被重置的问题，初始化后锁定接口 |
| 环境变量注入 | 修复 .env 写入时换行符注入，禁止值中包含换行 |
| Docker 越权 | 虚拟终端容器限制网络、只读根文件系统、非 root 用户运行 |
| 路径穿越 | 修复文件上传/下载时 `../../` 路径穿越漏洞 |
| 私聊泄露 | 修复私聊分享链接可被非参与者访问的问题 |
| 文件上传 | 群文件上传增加 MIME 类型白名单 + 扩展名双重校验 |
| 头像 XSS | 头像上传校验图片类型，防止 SVG 脚本注入 |
| 群权限 | 修复任意成员可拉人、踢人、清群记录的越权问题 |
| JWT 弱密钥 | 移除硬编码默认密钥，强制从环境变量读取，启动时校验强度 |
| 暴力破解 | 登录接口增加 IP 速率限制（5次/分钟）+ 账号锁定 |
| 日志泄露 | 修复日志中打印 JWT token、密码明文的问题 |
| Markdown XSS | Markdown 渲染启用 sanitize，过滤 `javascript:` 协议和 script 标签 |
| WebSocket 伪造 | WebSocket 连接强制校验 token，禁止匿名连接 |

### 中危漏洞（16 个）

- JWT 算法固定为 HS256，防止 `alg: none` 绕过
- 增加安全响应头：CSP、X-Frame-Options、X-Content-Type-Options、HSTS
- 错误信息统一处理，不泄露堆栈跟踪和数据库结构
- 修复多处 IDOR 越权：删除他人消息、修改他人资料、访问非成员群聊
- 开放重定向漏洞修复
- 临时对话参与者身份校验
- 群文件下载校验群成员身份
- 用户资料修改校验本人身份
- 好友操作校验身份
- API 响应剥离 password_hash、api_key 等敏感字段
- 注册接口速率限制
- 临时对话创建频率限制
- 消息内容长度限制（5000字）
- 用户名/密码/邮箱格式与长度校验
- CORS 生产环境收紧（不再默认 *）
- 依赖包 npm audit 修复

### 低危漏洞（17 个）

- 所有输入参数增加长度上限
- UUID 格式校验
- 前端表单 maxLength 限制
- 数字类型参数范围校验
- 空值/ null 处理
- 分页参数边界检查
- 排序参数白名单
- 搜索关键词长度限制
- 文件大小限制（50MB）
- 文件名长度限制
- 群名称长度限制
- 公告长度限制
- 个性签名长度限制
- API 响应统一包装
- 健康检查接口不泄露敏感信息
- 静态文件缓存控制
- 容器内非 root 用户运行

### 已确认安全项

- ✅ 所有 SQL 查询使用参数化占位符（`$1`, `$2`），**零 SQL 注入**
- ✅ 密码全部使用 bcrypt（10 轮）加密存储，无明文
- ✅ 敏感字段（password_hash、api_key）在 API 响应中已剥离
- ✅ WebSocket 消息仅广播给会话成员，不泄露给非成员
- ✅ .env、.pgdata、uploads 已在 .gitignore 中排除，不会提交到仓库
- ✅ Docker 容器以非 root 用户运行，只读根文件系统

---

## 🤝 贡献指南

我们欢迎所有形式的贡献！无论是提交 Bug、提出新功能、还是直接提交代码，都非常感谢。

### 贡献流程

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

### 代码规范

- 后端使用 TypeScript 严格模式
- 前端遵循 React 最佳实践
- 提交信息使用 Conventional Commits 规范
- 所有新功能必须包含类型定义

---

## 📄 许可证

本项目基于 [MIT 许可证](https://opensource.org/licenses/MIT) 开源。你可以自由地使用、修改、分发，包括商业用途。

---

## 🙏 致谢

感谢所有为开源社区做出贡献的开发者们，是你们让这个项目变得更好。

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐ Star**

**Made with ❤️ for the open-source community**

</div>

---

## 🐳 Docker 部署

本项目提供开箱即用的 Docker 容器化配置，采用多阶段构建，单容器同时运行前端静态资源与后端 API，内置 PGlite（WASM PostgreSQL），**无需额外数据库容器**。

### 一键启动

```bash
docker compose up -d --build
```

启动完成后访问 <http://localhost:4000>，默认管理员账号 `admin` / `admin123`（首次登录后请立即修改密码）。

### 常用操作

```bash
docker compose logs -f       # 查看日志
docker compose restart       # 重启
docker compose down          # 停止（保留数据）
```

生产部署前请务必修改 `JWT_SECRET`（可通过 `.env` 文件或环境变量覆盖）。

> 完整的环境变量说明、数据持久化、升级流程、虚拟终端（Docker-in-Docker）、备份恢复与故障排查，请参阅 [**DEPLOY.md**](./DEPLOY.md)。

---

## Android 客户端

ChatRoom 提供原生 Android 客户端（Kotlin + Jetpack Compose），不使用 WebView 套壳。

### 功能特性
- 欢迎页引导连接服务器
- 自定义服务器地址和端口
- 账号密码登录 / 管理员令牌登录
- 会话列表（私聊 + 群聊）
- 实时消息收发（WebSocket）
- 消息历史记录

### 下载
从 GitHub Release 下载最新 APK：
- [v1.1.0 APK 下载](https://github.com/cvcxx000/chatroom/releases/tag/v1.1.0)

### 使用说明
1. 安装并打开 App
2. 在欢迎页点击「连接服务器」
3. 输入服务器 IP 地址和端口号（默认 4000），点击「连接」
4. 选择登录方式：
   - **账号密码登录**：输入用户名和密码
   - **令牌登录**（管理员）：粘贴 JWT 令牌直接登录
5. 登录成功后进入会话列表，点击会话开始聊天

### 从源码构建
```bash
cd android
./gradlew assembleDebug
# APK 输出路径：app/build/outputs/apk/debug/app-debug.apk
```

#### 环境要求
- JDK 17
- Android SDK (compileSdk 34, minSdk 24)
- Gradle 8.5（项目自带 Wrapper）

### 技术栈
- Kotlin + Jetpack Compose (Material 3)
- OkHttp + Retrofit (REST API)
- OkHttp WebSocket (实时通信)
- Gson (JSON 解析)
- SharedPreferences (本地存储)
- Navigation Compose (页面导航)

