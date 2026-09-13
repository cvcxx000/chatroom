import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { getConfig, setConfig } from '../models/systemConfigModel';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

/**
 * Resolve SMTP config: system_config table takes precedence, fall back to .env.
 */
export async function getSmtpConfig(): Promise<SmtpConfig> {
  let host = await getConfig('smtp_host');
  let port = await getConfig('smtp_port');
  let user = await getConfig('smtp_user');
  let pass = await getConfig('smtp_pass');
  let from = await getConfig('smtp_from');
  let secure = await getConfig('smtp_secure');

  return {
    host: host || env.SMTP_HOST,
    port: port ? parseInt(port, 10) : env.SMTP_PORT,
    user: user || env.SMTP_USER,
    pass: pass || env.SMTP_PASS,
    from: from || env.SMTP_FROM || (user ? `"ChatRoom" <${user}>` : 'ChatRoom <no-reply@localhost>'),
    secure: secure ? secure === 'true' : env.SMTP_SECURE,
  };
}

export async function saveSmtpConfig(cfg: SmtpConfig): Promise<void> {
  await setConfig('smtp_host', cfg.host);
  await setConfig('smtp_port', String(cfg.port));
  await setConfig('smtp_user', cfg.user);
  await setConfig('smtp_pass', cfg.pass);
  await setConfig('smtp_from', cfg.from);
  await setConfig('smtp_secure', String(cfg.secure));
}

let transporter: Transporter | null = null;
let transporterKey = '';

async function getTransporter(): Promise<Transporter> {
  const cfg = await getSmtpConfig();
  const key = `${cfg.host}:${cfg.port}:${cfg.user}:${cfg.secure}`;
  if (transporter && transporterKey === key) return transporter;

  transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
  });
  transporterKey = key;
  return transporter;
}

export async function isSmtpConfigured(): Promise<boolean> {
  const cfg = await getSmtpConfig();
  return Boolean(cfg.host && cfg.port);
}

export async function sendMail(to: string, subject: string, html: string): Promise<void> {
  const cfg = await getSmtpConfig();
  if (!cfg.host) {
    // eslint-disable-next-line no-console
    console.warn('[email] SMTP not configured; skipping email to', to);
    return;
  }
  // [SECURITY] Reject recipients / subjects containing CR/LF to prevent email
  // header injection.
  if (/[\r\n]/.test(to) || /[\r\n]/.test(subject)) {
    throw new Error('Invalid email header value');
  }
  const t = await getTransporter();
  await t.sendMail({ from: cfg.from, to, subject, html });
}

export async function sendVerificationEmail(email: string, token: string): Promise<void> {
  const link = `${env.CLIENT_ORIGIN}/verify-email?token=${encodeURIComponent(token)}`;
  await sendMail(
    email,
    'Verify your ChatRoom email',
    `<h2>Welcome to ChatRoom</h2>
     <p>Click the link below to verify your email address:</p>
     <p><a href="${link}">${link}</a></p>
     <p>This link expires in 24 hours.</p>`,
  );
}

export async function sendNotificationEmail(email: string, subject: string, text: string): Promise<void> {
  await sendMail(email, subject, `<p>${text}</p>`);
}
