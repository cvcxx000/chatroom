# syntax=docker/dockerfile:1

# ============================================================
# Stage 1 — Build frontend (React + Vite + TypeScript)
# Produces static assets in /app/client/dist
# ============================================================
FROM node:20-alpine AS builder-client

WORKDIR /app/client

# Install deps first for better layer caching
COPY client/package.json client/package-lock.json ./
RUN npm ci

# Copy sources and build
COPY client/ ./
RUN npm run build


# ============================================================
# Stage 2 — Build backend (Node.js + TypeScript)
# Produces compiled JS in /app/server/dist
# ============================================================
FROM node:20-alpine AS builder-server

WORKDIR /app/server

# Install all (dev) deps first for layer caching
COPY server/package.json server/package-lock.json ./
RUN npm ci

# Copy sources (node_modules / dist / .pgdata / uploads / .env are
# excluded via .dockerignore) and compile TypeScript
COPY server/ ./
RUN npm run build


# ============================================================
# Stage 3 — Runtime image
# Small production image: only prod deps + built artifacts
# ============================================================
FROM node:20-alpine AS runtime

# curl  -> used by HEALTHCHECK
# libstdc++ -> required by native / wasm runtime pieces (pglite)
RUN apk add --no-cache curl libstdc++

# Default runtime environment (overridable via docker-compose / -e)
ENV NODE_ENV=production \
    PORT=4000 \
    PGLITE_DATA=/app/server/.pgdata \
    UPLOAD_DIR=/app/server/uploads

WORKDIR /app

# Install ONLY production dependencies.
# Copy package files first so this layer is cached unless deps change.
COPY --from=builder-server /app/server/package.json /app/server/package-lock.json ./server/
RUN cd /app/server && npm ci --omit=dev

# Copy compiled backend code
COPY --from=builder-server /app/server/dist ./server/dist

# Copy built frontend static files (served by Express from /app/client/dist,
# resolved at runtime via path.resolve(__dirname, '../../client/dist'))
COPY --from=builder-client /app/client/dist ./client/dist

# SQL schema used by the first-run setup wizard at runtime.
# The server resolves it as /app/sql/init.sql (relative to compiled dist).
COPY sql/ ./sql/

# Create writable data / upload directories and hand ownership to the
# non-root `node` user that ships with the official node:alpine image.
# Named volumes mounted on these paths will inherit this ownership on
# first initialization.
RUN mkdir -p /app/server/.pgdata /app/server/uploads \
    && chown -R node:node /app/server/.pgdata /app/server/uploads

EXPOSE 4000

# Liveness probe against the built-in health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Run as the unprivileged node user (never root)
USER node

WORKDIR /app
CMD ["node", "server/dist/index.js"]
