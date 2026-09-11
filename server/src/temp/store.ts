/**
 * In-memory temporary conversation store.
 * Messages NEVER persist to PostgreSQL. Each message auto-deletes after TTL.
 */
import crypto from 'crypto';

export interface TempMessage {
  id: string;
  tempId: string;
  senderId: string;
  content: string;
  createdAt: number; // epoch ms
  expiresAt: number; // epoch ms
}

export interface TempConversation {
  tempId: string;
  userA: string;
  userB: string;
  createdAt: number;
  messages: TempMessage[];
  timer?: NodeJS.Timeout;
}

const TTL_MS = 120 * 1000; // 120 seconds

// tempId -> conversation
const conversations = new Map<string, TempConversation>();
// pair key "a|b" (sorted) -> tempId, so starting twice returns same temp chat
const pairIndex = new Map<string, string>();

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

export function listParticipants(tempId: string): string[] {
  const tc = conversations.get(tempId);
  if (!tc) return [];
  return [tc.userA, tc.userB];
}

export function isParticipant(tempId: string, userId: string): boolean {
  const tc = conversations.get(tempId);
  if (!tc) return false;
  return tc.userA === userId || tc.userB === userId;
}

export interface StartTempResult {
  tempId: string;
  createdAt: number;
}

/** Start (or return existing) temp conversation between two users. */
export function startTemp(userA: string, userB: string): StartTempResult {
  const key = pairKey(userA, userB);
  const existing = pairIndex.get(key);
  if (existing && conversations.has(existing)) {
    const tc = conversations.get(existing)!;
    return { tempId: tc.tempId, createdAt: tc.createdAt };
  }
  const tempId = crypto.randomUUID();
  const tc: TempConversation = {
    tempId,
    userA,
    userB,
    createdAt: Date.now(),
    messages: [],
  };
  conversations.set(tempId, tc);
  pairIndex.set(key, tempId);
  return { tempId, createdAt: tc.createdAt };
}

function clearTemp(tempId: string): void {
  const tc = conversations.get(tempId);
  if (!tc) return;
  if (tc.timer) clearTimeout(tc.timer);
  pairIndex.delete(pairKey(tc.userA, tc.userB));
  conversations.delete(tempId);
}

function scheduleExpiry(tc: TempConversation): void {
  if (tc.timer) clearTimeout(tc.timer);
  const now = Date.now();
  const oldest = tc.messages.length ? tc.messages[0].createdAt : now;
  const lifeLeft = oldest + TTL_MS - now;
  const delay = Math.max(1000, Math.min(TTL_MS, lifeLeft));
  tc.timer = setTimeout(() => {
    // Prune expired messages; if none remain, remove the conversation.
    const cutoff = Date.now() - TTL_MS;
    tc.messages = tc.messages.filter((m) => m.createdAt > cutoff);
    if (tc.messages.length === 0) {
      const parts = [tc.userA, tc.userB];
      clearTemp(tc.tempId);
      // Notify participants via callback hook
      onExpire?.(tc.tempId, parts);
    } else {
      scheduleExpiry(tc);
    }
  }, delay);
}

let onExpire: ((tempId: string, participants: string[]) => void) | null = null;
export function setOnExpire(fn: (tempId: string, participants: string[]) => void): void {
  onExpire = fn;
}

export interface NewTempMessage {
  message: TempMessage;
  expiresAt: number;
}

/** Append a message; returns null if temp chat not found. */
export function addTempMessage(
  tempId: string,
  senderId: string,
  content: string,
): NewTempMessage | null {
  const tc = conversations.get(tempId);
  if (!tc) return null;
  const now = Date.now();
  const msg: TempMessage = {
    id: crypto.randomUUID(),
    tempId,
    senderId,
    content,
    createdAt: now,
    expiresAt: now + TTL_MS,
  };
  tc.messages.push(msg);
  scheduleExpiry(tc);
  return { message: msg, expiresAt: msg.expiresAt };
}

export function getTempMessages(tempId: string): TempMessage[] {
  const tc = conversations.get(tempId);
  if (!tc) return [];
  const cutoff = Date.now() - TTL_MS;
  return tc.messages.filter((m) => m.createdAt > cutoff);
}

export interface AdminTempListEntry {
  tempId: string;
  userA: string;
  userB: string;
  createdAt: number;
  messageCount: number;
}

export function listActiveTemp(): AdminTempListEntry[] {
  const out: AdminTempListEntry[] = [];
  for (const tc of conversations.values()) {
    const cutoff = Date.now() - TTL_MS;
    const live = tc.messages.filter((m) => m.createdAt > cutoff);
    out.push({
      tempId: tc.tempId,
      userA: tc.userA,
      userB: tc.userB,
      createdAt: tc.createdAt,
      messageCount: live.length,
    });
  }
  return out;
}
