# Docker 部署指南

本文档说明如何使用 Docker / Docker Compose 一键部署本项目。

## 项目简介

本项目是一个前后端一体的即时通讯应用（monorepo）：

- **后端**：Node.js + Express + TypeScript，内置嵌入式 WASM 数据库 [PGlite](https://github.com/electric-sql/pglite)（无需单独的 PostgreSQL 容器）。
- **前端**：React + Vite + TypeScript，构建后由后端 Express 直接托管静态文件。
- **运行形态**：单容器，监听 `4000` 端口，同时提供 API（`/api/*`）、静态资源与 WebSocket。

由于使用 PGlite，**不需要额外的数据库容器**；所有数据保存在容器内的持久化卷中。

---

## 前置要求

- Docker Engine **20.10+**
- Docker Compose **v2**（`docker compose` 插件，而非旧版 `docker-compose`）

检查安装：

```bash
docker --version
docker compose version
```

---

## 一键启动

在项目根目录（包含本 `DEPLOY.md`、`Dockerfile`、`docker-compose.yml` 的目录）执行：

```bash
docker compose up -d --build
```

首次启动会：

1. 拉取 `node:20-alpine` 基础镜像；
2. 多阶段构建前端、后端与生产运行镜像；
3. 创建 `pgdata`、`uploads` 两个命名数据卷；
4. 后台启动容器。

启动完成后访问：

```
http://localhost:4000
```

查看日志：

```bash
docker compose logs -f
```

停止 / 重启 / 销毁：

```bash
docker compose stop          # 停止
docker compose restart       # 重启
docker compose down          # 停止并删除容器（数据卷保留）
docker compose down -v       # ⚠️ 停止并删除容器 + 删除数据卷（清空数据）
```

---

## 环境变量说明

所有变量均可通过 `docker-compose.yml` 的 `environment:` 段覆盖，也可以在宿主机 shell 中导出，或通过 `.env` 文件注入（compose 会自动读取同目录 `.env`）。

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `NODE_ENV` | `production` | 运行环境，生产部署保持 `production`。 |
| `PORT` | `4000` | 容器内监听端口，一般无需修改；如需改宿主机端口，改 `ports:` 映射即可。 |
| `JWT_SECRET` | `change-this-to-a-random-secret-key` | **生产环境必须修改**。JWT 签名密钥，泄露后可伪造任意用户会话。 |
| `JWT_EXPIRES_IN` | `7d` | JWT 有效期，例如 `7d`、`12h`、`30m`。 |
| `CLIENT_ORIGIN` | `http://localhost:4000` | 允许的前端来源（CORS）。生产部署请改为实际访问地址，如 `https://chat.example.com`。多个来源用逗号分隔。 |
| `PGLITE_DATA` | `/app/server/.pgdata` | PGlite 数据目录（容器内绝对路径），已挂载到 `pgdata` 卷，**不要修改**。 |
| `UPLOAD_DIR` | `/app/server/uploads` | 文件上传目录（容器内绝对路径），已挂载到 `uploads` 卷，**不要修改**。 |
| `MAX_FILE_SIZE_MB` | `50` | 单次上传文件大小上限（MB）。 |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` / `SMTP_SECURE` | 空 / `587` / ... | 可选 SMTP 发信配置；也可在管理员后台运行时配置。 |
| `DOCKER_SOCKET_PATH` | `/var/run/docker.sock` | 虚拟终端功能的 Docker socket 路径，未挂载 socket 时功能自动禁用。 |
| `TERMINAL_IMAGE` | `alpine:latest` | 虚拟终端使用的容器镜像。 |
| `TERMINAL_CPU_QUOTA` | `50000` | 终端容器 CPU quota（微核，50000 ≈ 0.5 核）。 |
| `TERMINAL_MEMORY` | `536870912` | 终端容器内存限制（字节，默认 512 MB）。 |
| `TERMINAL_TIMEOUT_MINUTES` | `30` | 终端空闲自动回收时间（分钟）。 |
| `TERMINAL_NETWORK_DISABLED` | `false` | 是否禁用终端容器网络。 |

> 建议在项目根目录新建 `.env` 文件存放敏感配置（例如 `JWT_SECRET=...`），并确保 `.env` 不提交到 Git。`docker compose` 会自动读取它。

### 生成一个安全的 JWT_SECRET

```bash
openssl rand -hex 32
```

将输出填入 `.env`：

```env
JWT_SECRET=<上面生成的随机串>
```

---

## 数据持久化

应用使用两个 Docker **命名卷**保存持久数据，容器删除/重建都不会丢失：

| 卷名 | 容器内路径 | 内容 |
| --- | --- | --- |
| `pgdata` | `/app/server/.pgdata` | PGlite 数据库文件（用户、消息、好友、配置等所有业务数据）。 |
| `uploads` | `/app/server/uploads` | 用户上传的图片、文件等静态资源。 |

查看卷：

```bash
docker volume ls | grep -E 'pgdata|uploads'
```

查看卷实际宿主机路径：

```bash
docker volume inspect <项目名>_pgdata
docker volume inspect <项目名>_uploads
```

> 注意：仅当数据卷为空（首次创建）时，Docker 才会把镜像内对应目录的属主/权限复制进卷。本镜像已将这两个目录 chown 给非 root 的 `node` 用户，因此首次挂载即可正常读写。

---

## 端口说明

- 容器内部监听 **`4000`**（由 `PORT` 决定）。
- `docker-compose.yml` 默认映射 `4000:4000`，即宿主机 `http://localhost:4000`。
- 如需改宿主机端口（例如 8080），修改 `ports:` 为 `"8080:4000"`，并把 `CLIENT_ORIGIN` 改为 `http://localhost:8080`。

---

## 升级更新

### 方式 A：重新构建镜像（本地有源码）

```bash
git pull                # 拉取最新代码
docker compose up -d --build
```

数据卷会被自动复用，不会丢数据。

### 方式 B：拉取预构建镜像（若发布到镜像仓库）

```bash
docker compose pull
docker compose up -d
```

升级后清理旧镜像：

```bash
docker image prune -f
```

> 建议升级前先备份数据卷（见下文“备份与恢复”）。

---

## 虚拟终端（Docker-in-Docker）说明

浏览器内虚拟终端功能通过在后端调用宿主 Docker daemon 来启动隔离的 shell 容器。

- **默认禁用**：`docker-compose.yml` 中已注释掉 `/var/run/docker.sock` 的挂载，未挂载时该功能自动关闭，不影响其他功能。
- **启用方式**：取消 `docker-compose.yml` 中下面这行的注释：

  ```yaml
  - /var/run/docker.sock:/var/run/docker.sock
  ```

  然后 `docker compose up -d`。首次使用前确保宿主上已拉取终端镜像：

  ```bash
  docker pull alpine:latest
  ```

### ⚠️ 安全注意事项

挂载宿主机 `/var/run/docker.sock` 等价于**把宿主机的 root 权限交给应用容器**——任何能访问该应用的用户都可能借虚拟终端逃逸到宿主机。**仅在受信任的内网/单机环境启用**，不要暴露到公网。启用后务必：

1. 修改默认管理员密码；
2. 配置强 `JWT_SECRET`；
3. 尽量设置 `TERMINAL_NETWORK_DISABLED=true` 限制终端网络；
4. 合理设置 `TERMINAL_CPU_QUOTA` / `TERMINAL_MEMORY` 与超时。

---

## 首次访问与初始化

1. 容器启动后打开 `http://localhost:4000`。
2. 首次访问会进入初始化向导（`/api/setup/status` 会返回未完成状态），按提示创建管理员账号即可。
3. 若数据库已由镜像初始化，**默认管理员账号为 `admin` / 密码 `admin123`**。
4. **首次登录后请立即在“设置 / 账户”中修改默认密码**，并确认 `JWT_SECRET` 已改为随机值。

---

## 备份与恢复

### 备份

把两个数据卷打包到宿主机文件：

```bash
# 停止应用，保证数据一致（可选但推荐）
docker compose stop chatroom

# 备份数据库卷
docker run --rm -v <项目名>_pgdata:/data -v "$PWD":/backup alpine \
  tar czf /backup/pgdata-backup.tar.gz -C /data .

# 备份上传文件卷
docker run --rm -v <项目名>_uploads:/data -v "$PWD":/backup alpine \
  tar czf /backup/uploads-backup.tar.gz -C /data .

docker compose start chatroom
```

> `<项目名>` 默认为当前目录名（小写），可通过 `docker volume ls | grep _pgdata` 查看实际卷名。

### 恢复

```bash
docker compose stop chatroom

# 恢复数据库卷
docker run --rm -v <项目名>_pgdata:/data -v "$PWD":/backup alpine \
  tar xzf /backup/pgdata-backup.tar.gz -C /data

# 恢复上传文件卷
docker run --rm -v <项目名>_uploads:/data -v "$PWD":/backup alpine \
  tar xzf /backup/uploads-backup.tar.gz -C /data

docker compose up -d
```

---

## 故障排查

### 健康检查失败 / 容器一直 unhealthy

```bash
docker compose ps                 # 查看健康状态
docker compose logs chatroom      # 查看后端日志
docker exec -it chatroom curl -s http://localhost:4000/health
```

- 正常应返回 `{"success":true,"data":{"status":"ok",...}}`。
- 若日志提示 `.pgdata` 权限错误，说明数据卷属主不对：删除空卷后重建（仅当卷内无重要数据）：
  ```bash
  docker compose down
  docker volume rm <项目名>_pgdata <项目名>_uploads
  docker compose up -d --build
  ```
- `start_period` 已设为 15s，PGlite 首次初始化较慢；若机器性能差，可在 compose 中调大 `start_period`。

### 端口冲突：`bind: address already in use`

宿主机 `4000` 被占用。改 `docker-compose.yml` 的端口映射，例如 `"8080:4000"`，并同步修改 `CLIENT_ORIGIN=http://localhost:8080`。

### 数据丢失 / 换机器后数据没了

- 确认你没有执行 `docker compose down -v`（`-v` 会删除数据卷）。
- 确认使用的是命名卷（`docker volume ls` 应能看到 `<项目名>_pgdata`、`<项目名>_uploads`），而不是匿名卷。

### CORS / 跨域错误

把 `CLIENT_ORIGIN` 设置为浏览器实际访问的地址（含协议、端口，不含末尾斜杠）。例如通过 Nginx 反代到 `https://chat.example.com`，则：

```env
CLIENT_ORIGIN=https://chat.example.com
```

### 上传文件无法访问

确认 `uploads` 卷已挂载（`docker inspect chatroom | grep Mounts`），且 `MAX_FILE_SIZE_MB` 未被设为过小。上传文件通过 `http://<host>/uploads/<文件名>` 访问。

### 前端 404 / 刷新后页面丢失

确认 `client/dist` 已正确构建进镜像。重新构建：`docker compose up -d --build`。SPA 路由由后端 fallback 处理，不应出现刷新 404；若出现，请确认镜像内 `/app/client/dist/index.html` 存在。

### 虚拟终端无法使用

- 确认已取消 `docker.sock` 挂载注释并重启容器；
- 确认宿主已 `docker pull alpine:latest`；
- 查看日志中 `dockerode` / terminal 相关报错。

---

## 常用命令速查

```bash
docker compose up -d --build      # 构建并后台启动
docker compose logs -f            # 跟踪日志
docker compose restart            # 重启
docker compose down               # 停止（保留数据）
docker compose exec chatroom sh  # 进入容器
docker compose build --no-cache   # 完全重建
```
