import { WebSocket } from 'ws';
import { getMemberIds } from '../models/conversationModel';

export interface ClientEntry {
  ws: WebSocket;
  userId: string;
  conversations: Set<string>; // joined conversation rooms
}

// userId -> set of connections (a user may have multiple tabs)
const clients = new Map<string, Set<ClientEntry>>();

export function addClient(userId: string, ws: WebSocket): ClientEntry {
  const entry: ClientEntry = { ws, userId, conversations: new Set() };
  let set = clients.get(userId);
  if (!set) {
    set = new Set();
    clients.set(userId, set);
  }
  set.add(entry);
  return entry;
}

export function removeClient(entry: ClientEntry): void {
  const set = clients.get(entry.userId);
  if (set) {
    set.delete(entry);
    if (set.size === 0) clients.delete(entry.userId);
  }
}

export function getOnlineUserIds(): string[] {
  return Array.from(clients.keys());
}

export function getOnlineCount(): number {
  return clients.size;
}

export function isUserOnline(userId: string): boolean {
  return clients.has(userId);
}

function sendToEntry(entry: ClientEntry, payload: unknown): void {
  if (entry.ws.readyState === WebSocket.OPEN) {
    entry.ws.send(JSON.stringify(payload));
  }
}

export function sendToUser(userId: string, payload: unknown): void {
  const set = clients.get(userId);
  if (!set) return;
  for (const entry of set) sendToEntry(entry, payload);
}

export async function broadcastToConversation(
  conversationId: string,
  payload: unknown,
): Promise<void> {
  try {
    const memberIds = await getMemberIds(conversationId);
    for (const uid of memberIds) sendToUser(uid, payload);
  } catch {
    /* conversation may be gone */
  }
}

export function joinRoom(entry: ClientEntry, conversationId: string): void {
  entry.conversations.add(conversationId);
}

export function leaveRoom(entry: ClientEntry, conversationId: string): void {
  entry.conversations.delete(conversationId);
}

/** Force-disconnect / notify a banned user. */
export function kickUser(userId: string, payload: unknown): void {
  const set = clients.get(userId);
  if (!set) return;
  for (const entry of set) {
    try {
      sendToEntry(entry, payload);
    } catch {
      /* ignore */
    }
    try {
      entry.ws.close();
    } catch {
      /* ignore */
    }
  }
  clients.delete(userId);
}
