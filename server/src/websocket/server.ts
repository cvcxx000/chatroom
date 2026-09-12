import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { URL } from 'url';
import { verifyToken } from '../utils/jwt';
import { findUserById } from '../models/userModel';
import {
  addClient,
  removeClient,
  joinRoom,
  leaveRoom,
  sendToUser,
  broadcastToConversation,
} from './hub';
import { isMember } from '../models/conversationModel';
import {
  addTempMessage,
  getTempMessages,
  isParticipant,
  setOnExpire,
} from '../temp/store';
import { AuthedClient } from './types';
import { dockerService, AttachHandle } from '../services/docker';

export function initWebsocket(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // When a temp conversation fully expires, notify its participants.
  setOnExpire((tempId, participants) => {
    for (const uid of participants) {
      sendToUser(uid, { type: 'temp_expired', tempId });
    }
  });

  wss.on('connection', (ws: WebSocket, req) => {
    let client: AuthedClient | null = null;
    // Per-connection terminal sessions, indexed by containerId.
    const terminalSessions = new Map<string, AttachHandle>();

    try {
      const url = new URL(req.url || '', 'http://localhost');
      const token = url.searchParams.get('token') || '';
      const payload = verifyToken(token);
      // Resolve user to check ban status at connection time.
      findUserById(payload.userId).then((user) => {
        if (!user || user.is_banned) {
          ws.send(JSON.stringify({ type: 'error', error: 'unauthorized' }));
          ws.close();
          return;
        }
        const entry = addClient(user.id, ws);
        client = { ws, userId: user.id, entry };
        ws.send(JSON.stringify({ type: 'connected', userId: user.id }));
      }).catch(() => {
        ws.send(JSON.stringify({ type: 'error', error: 'unauthorized' }));
        ws.close();
      });
    } catch {
      ws.send(JSON.stringify({ type: 'error', error: 'unauthorized' }));
      ws.close();
      return;
    }

    ws.on('message', async (data: Buffer) => {
      if (!client || !client.entry) return;
      let msg: any;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      const { type } = msg;
      const userId = client.userId;
      try {
        switch (type) {
          case 'join_conversation': {
            const cid = String(msg.conversationId || '');
            if (cid && (await isMember(cid, userId))) {
              joinRoom(client.entry, cid);
            }
            break;
          }
          case 'leave_conversation': {
            const cid = String(msg.conversationId || '');
            leaveRoom(client.entry, cid);
            break;
          }
          case 'typing': {
            const cid = String(msg.conversationId || '');
            if (cid && (await isMember(cid, userId))) {
              await broadcastToConversation(cid, {
                type: 'user_typing',
                conversationId: cid,
                userId,
                isTyping: Boolean(msg.isTyping),
              });
            }
            break;
          }
          case 'read_receipt': {
            const cid = String(msg.conversationId || '');
            if (cid && (await isMember(cid, userId))) {
              await broadcastToConversation(cid, {
                type: 'message_read',
                conversationId: cid,
                userId,
                messageId: msg.messageId || null,
              });
            }
            break;
          }
          case 'temp_join': {
            const tempId = String(msg.tempId || '');
            if (isParticipant(tempId, userId)) {
              // send current messages
              const messages = getTempMessages(tempId);
              ws.send(JSON.stringify({ type: 'temp_history', tempId, messages }));
            }
            break;
          }
          case 'temp_message': {
            const tempId = String(msg.tempId || '');
            const content = String(msg.content || '');
            if (!isParticipant(tempId, userId)) break;
            const result = addTempMessage(tempId, userId, content);
            if (!result) break;
            // deliver to both participants
            sendToUser(userId, {
              type: 'temp_message',
              tempId,
              message: result.message,
              expiresAt: result.expiresAt,
            });
            const other = tempOtherUser(tempId, userId);
            if (other) {
              sendToUser(other, {
                type: 'temp_message',
                tempId,
                message: result.message,
                expiresAt: result.expiresAt,
              });
            }
            break;
          }
          case 'terminal': {
            const containerId = String(msg.containerId || '');
            if (!containerId) break;
            if (!dockerService.available) {
              ws.send(JSON.stringify({ type: 'terminal_error', containerId, error: 'Docker unavailable' }));
              break;
            }
            // Verify the container belongs to this user.
            const owner = await dockerService.getContainerOwner(containerId);
            if (owner !== userId) {
              ws.send(JSON.stringify({ type: 'terminal_error', containerId, error: 'forbidden' }));
              break;
            }
            if (terminalSessions.has(containerId)) {
              ws.send(JSON.stringify({ type: 'terminal_attached', containerId }));
              break;
            }
            try {
              const handle = await dockerService.attachContainer(
                containerId,
                (data: string) => {
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'terminal_output', containerId, data }));
                  }
                },
                () => {
                  terminalSessions.delete(containerId);
                  if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ type: 'terminal_closed', containerId }));
                  }
                },
              );
              terminalSessions.set(containerId, handle);
              ws.send(JSON.stringify({ type: 'terminal_attached', containerId }));
            } catch (err: any) {
              // eslint-disable-next-line no-console
              console.error('[ws] terminal attach failed:', err);
              ws.send(JSON.stringify({ type: 'terminal_error', containerId, error: 'attach failed' }));
            }
            break;
          }
          case 'terminal_input': {
            const containerId = String(msg.containerId || '');
            const data = String(msg.data || '');
            const handle = terminalSessions.get(containerId);
            if (!handle) break;
            handle.write(data);
            break;
          }
          case 'terminal_resize': {
            const containerId = String(msg.containerId || '');
            const cols = parseInt(String(msg.cols || '80'), 10);
            const rows = parseInt(String(msg.rows || '24'), 10);
            const handle = terminalSessions.get(containerId);
            if (!handle) break;
            handle.resize(cols, rows);
            break;
          }
          default:
            break;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[ws] message handler error', err);
      }
    });

    ws.on('close', () => {
      // Detach all terminal sessions (do NOT destroy the containers themselves).
      for (const handle of terminalSessions.values()) {
        try {
          handle.destroy();
        } catch {
          /* ignore */
        }
      }
      terminalSessions.clear();
      if (client && client.entry) removeClient(client.entry);
    });
    ws.on('error', () => {
      for (const handle of terminalSessions.values()) {
        try {
          handle.destroy();
        } catch {
          /* ignore */
        }
      }
      terminalSessions.clear();
      if (client && client.entry) removeClient(client.entry);
    });
  });

  return wss;
}

// We need temp participants for broadcast; expose helper via store.
import { listParticipants } from '../temp/store';
function tempOtherUser(tempId: string, userId: string): string | null {
  const parts = listParticipants(tempId);
  return parts.find((p) => p !== userId) || null;
}
