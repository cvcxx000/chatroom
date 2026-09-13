import bcrypt from 'bcryptjs';
import { AiConfig, User } from '../models/types';
import { query } from '../config/db';
import { listActiveAiConfigs, getAiConfigById } from '../models/aiConfigModel';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiProviderMeta {
  provider: string;
  name: string;
  baseUrl: string;
  model: string;
}

/** Built-in provider catalogue (for front-end display only). */
export const AI_PROVIDERS: AiProviderMeta[] = [
  { provider: 'qwen', name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo' },
  { provider: 'doubao', name: '豆包', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-1-5-pro-32k' },
  { provider: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { provider: 'zhipu', name: '智谱 GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { provider: 'custom', name: '自定义', baseUrl: '', model: '' },
];

export const AI_ASSISTANT_USERNAME = 'ai_assistant';

/**
 * Ensure the built-in AI assistant user exists and return its row.
 * Used as the sender for all AI-generated messages.
 */
export async function ensureAiAssistantUser(): Promise<User> {
  const existing = await query<User>(
    'SELECT * FROM users WHERE username = $1 LIMIT 1',
    [AI_ASSISTANT_USERNAME],
  );
  if (existing.rows[0]) return existing.rows[0];

  const hash = bcrypt.hashSync(Math.random().toString(36).slice(2) + Date.now().toString(36), 10);
  const res = await query<User>(
    `INSERT INTO users (username, email, password_hash, display_name, is_admin, is_verified)
     VALUES ($1, $2, $3, $4, false, true)
     ON CONFLICT (username) DO NOTHING
     RETURNING *`,
    [AI_ASSISTANT_USERNAME, null, hash, 'AI 助手'],
  );
  if (res.rows[0]) return res.rows[0];
  const again = await query<User>(
    'SELECT * FROM users WHERE username = $1 LIMIT 1',
    [AI_ASSISTANT_USERNAME],
  );
  return again.rows[0];
}

/** Return the first active AI config, or null when none configured. */
export async function getActiveAiConfig(): Promise<AiConfig | null> {
  const active = await listActiveAiConfigs();
  if (active.length === 0) return null;
  const first = active[0];
  return getAiConfigById(first.id);
}

/**
 * Call an OpenAI-compatible chat completions endpoint with streaming enabled.
 * Parses the SSE stream and invokes onDelta for each content chunk.
 */
export async function callAiStream(
  config: AiConfig,
  messages: ChatMessage[],
  onDelta: (delta: string) => void,
  onDone: (fullText: string) => void,
): Promise<void> {
  const res = await fetch(`${config.base_url}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: true,
    }),
  });

  if (!res.ok) {
    // [SECURITY] Do not forward upstream error body verbatim – it may echo
    // auth headers or internal provider details. Only surface the status.
    await res.text().catch(() => '');
    throw new Error(`AI request failed (${res.status})`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onDone('');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() || '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') {
        onDone(full);
        return;
      }
      try {
        const json = JSON.parse(data);
        const delta: string | undefined = json?.choices?.[0]?.delta?.content;
        if (delta) {
          full += delta;
          onDelta(delta);
        }
      } catch {
        /* ignore non-JSON keep-alive lines */
      }
    }
  }

  onDone(full);
}

/** Non-streaming call: returns the complete assistant content. */
export async function callAiNonStream(
  config: AiConfig,
  messages: ChatMessage[],
): Promise<string> {
  const res = await fetch(`${config.base_url}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.api_key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages,
      stream: false,
    }),
  });
  if (!res.ok) {
    // [SECURITY] Do not forward upstream error body verbatim – it may echo
    // auth headers or internal provider details. Only surface the status.
    await res.text().catch(() => '');
    throw new Error(`AI request failed (${res.status})`);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content ?? '';
}
