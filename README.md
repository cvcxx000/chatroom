<div align="center">

# 🚀 ChatRoom - 开源即时通讯平台

### 专为豆包 2.1 Pro 打造的全栈即时通讯解决方案

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js->=18-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18-blue.svg)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue.svg)](https://www.typescriptlang.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16+-blue.svg)](https://www.postgresql.org/)
[![WebSocket](https://img.shields.io/badge/WebSocket-Real--time-orange.svg)]()

**实时同步 · 端到端体验 · 私有化部署 · 完全开源**

[功能特性](#-核心特性) • [快速开始](#-快速开始) • [部署指南](#-部署指南) • [API 文档](./API_SPEC.md)

</div>

---

## 📖 项目简介

**ChatRoom** 是一款面向新时代的开源即时通讯平台，诞生于豆包 2.1 Pro 智能编程时代。我们坚信，通讯软件不应该被巨头垄断，每个人都应该拥有属于自己的、可控的、安全的聊天空间。

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

### 8. 🛡️ 安全与隐私

- JWT 身份认证，Token 过期自动刷新
- bcrypt 密码加密存储
- API 速率限制，防止暴力破解
- CORS 跨域保护
- 输入验证与 SQL 注入防护
- 临时对话内存存储，不留痕迹
- 所有数据存储在你自己的服务器

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

### 前端技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18.3 | UI 框架 |
| TypeScript | 5.5 | 类型安全 |
| Vite | 5.x | 构建工具 |
| React Router | 6.x | 路由管理 |
| Axios | 1.7 | HTTP 客户端 |
| WebSocket API | 原生 | 实时通信 |

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
- 前端界面：http://localhost:5173
- 后端 API：http://localhost:3000
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
│   │   │   ├── Login.tsx          # 用户登录
│   │   │   ├── Register.tsx       # 用户注册
│   │   │   ├── MainChat.tsx       # 主聊天界面
│   │   │   ├── AdminLogin.tsx     # 管理员登录
│   │   │   └── AdminPanel.tsx     # 管理员后台
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
│   │   │   └── setup.ts          # 初始化路由
│   │   ├── services/         # 业务服务（邮件等）
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
| 用户 | `GET /api/users/me` | 获取当前用户 |
| 用户 | `GET /api/users/search` | 搜索用户 |
| 好友 | `GET /api/friends` | 获取好友列表 |
| 好友 | `POST /api/friends` | 添加好友 |
| 会话 | `GET /api/conversations` | 获取会话列表 |
| 消息 | `GET /api/conversations/:id/messages` | 获取历史消息 |
| 群文件 | `GET /api/groups/:id/files` | 获取群文件 |
| 群文件 | `POST /api/groups/:id/files` | 上传群文件 |
| 临时对话 | `POST /api/temp/create` | 创建临时对话 |
| 临时对话 | `POST /api/temp/:id/message` | 发送临时消息 |
| 管理员 | `POST /api/admin/login` | 管理员登录 |
| 管理员 | `GET /api/admin/users` | 用户列表 |
| 管理员 | `POST /api/admin/users/:id/ban` | 封禁用户 |
| 初始化 | `POST /api/setup/init` | 系统初始化 |
| 初始化 | `GET /api/setup/status` | 初始化状态 |

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

感谢所有为开源社区做出贡献的开发者们。本项目的诞生离不开豆包 2.1 Pro 智能编程助手的大力支持，让全栈应用开发变得前所未有的高效。

---

<div align="center">

**如果这个项目对你有帮助，请给一个 ⭐ Star**

**Made with ❤️ for the open-source community**

</div>
