import 'dotenv/config';

// 已知的开发用弱默认密钥；生产环境禁止使用。
const DEFAULT_DEV_JWT_SECRET = 'dev-secret-change-me';
const DEFAULT_DEV_CLIENT_ORIGIN = 'http://localhost:5173';

const NODE_ENV = process.env.NODE_ENV || 'development';

// [安全] JWT_SECRET 强校验：生产环境若未显式设置或仍为弱默认值，直接拒绝启动。
// 避免使用硬编码弱密钥导致 JWT 可被伪造（alg:none / 爆破）。
const rawJwtSecret = process.env.JWT_SECRET;
if (NODE_ENV === 'production') {
  if (!rawJwtSecret || rawJwtSecret === DEFAULT_DEV_JWT_SECRET) {
    // eslint-disable-next-line no-console
    console.error(
      '[security] FATAL: JWT_SECRET is not set (or still using the insecure default) in production. ' +
        'Please set a strong, random JWT_SECRET via environment variable before starting the server.',
    );
    process.exit(1);
  }
}

// [安全] CLIENT_ORIGIN 生产环境校验：未显式配置时给出明确警告，避免误把开发来源带到生产。
const rawClientOrigin = process.env.CLIENT_ORIGIN;
if (NODE_ENV === 'production' && (!rawClientOrigin || rawClientOrigin === DEFAULT_DEV_CLIENT_ORIGIN)) {
  // eslint-disable-next-line no-console
  console.warn(
    '[security] WARN: CLIENT_ORIGIN is not set in production (using the localhost development default). ' +
      'Set CLIENT_ORIGIN to your real frontend origin(s), comma-separated if multiple.',
  );
}

export const env = {
  PORT: parseInt(process.env.PORT || '4000', 10),
  NODE_ENV,
  CLIENT_ORIGIN: rawClientOrigin || DEFAULT_DEV_CLIENT_ORIGIN,

  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_NAME: process.env.DB_NAME || 'chatroom',
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '',

  // 开发环境允许弱默认值以便本地启动；生产环境已在上方强校验。
  JWT_SECRET: rawJwtSecret || DEFAULT_DEV_JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '5h',

  UPLOAD_DIR: process.env.UPLOAD_DIR || 'uploads',
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || '50', 10),

  SMTP_HOST: process.env.SMTP_HOST || '',
  SMTP_PORT: parseInt(process.env.SMTP_PORT || '587', 10),
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  SMTP_FROM: process.env.SMTP_FROM || '',
  SMTP_SECURE: (process.env.SMTP_SECURE || 'false') === 'true',

  // Virtual terminal (Docker container) configuration
  DOCKER_SOCKET_PATH: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
  TERMINAL_IMAGE: process.env.TERMINAL_IMAGE || 'alpine:latest',
  TERMINAL_CPU_QUOTA: parseInt(process.env.TERMINAL_CPU_QUOTA || '50000', 10),
  TERMINAL_MEMORY: parseInt(process.env.TERMINAL_MEMORY || '536870912', 10),
  TERMINAL_TIMEOUT_MINUTES: parseInt(process.env.TERMINAL_TIMEOUT_MINUTES || '30', 10),
  TERMINAL_NETWORK_DISABLED: (process.env.TERMINAL_NETWORK_DISABLED || 'false') === 'true',
};

/** 解析逗号分隔的 CORS 来源列表，去除空白并过滤空值。 */
export function getCorsOrigins(): string[] {
  return env.CLIENT_ORIGIN.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isDbConfigured(): boolean {
  return Boolean(env.DB_HOST && env.DB_NAME && env.DB_USER);
}
