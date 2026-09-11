import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getToken } from '../api/client';
import type { Message, TempMessage, User, WsClientMessage, WsServerMessage } from '../types';

type Handler = (payload: WsServerMessage) => void;

interface SocketState {
  connected: boolean;
  connecting: boolean;
  send: (msg: WsClientMessage) => boolean;
  joinConversation: (conversationId: string) => void;
  leaveConversation: (conversationId: string) => void;
  sendTyping: (conversationId: string, isTyping: boolean) => void;
  sendReadReceipt: (conversationId: string, messageId: string) => void;
  tempJoin: (tempId: string) => boolean;
  sendTempMessage: (tempId: string, content: string) => boolean;
  on: (type: WsServerMessage['type'], handler: Handler) => () => void;
  off: (type: WsServerMessage['type'], handler: Handler) => void;
}

const SocketContext = createContext<SocketState | null>(null);

function wsUrl(token: string): string {
  // In dev, Vite proxies /ws to http://localhost:3000. When the page itself is
  // served from 5173, use the ws proxy path so we don't hardcode the origin.
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const host = window.location.host;
  return `${proto}://${host}/ws?token=${encodeURIComponent(token)}`;
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<WsServerMessage['type'], Set<Handler>>>(new Map());
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const shouldReconnectRef = useRef(true);
  const mountedRef = useRef(true);

  const dispatch = useCallback((msg: WsServerMessage) => {
    const set = handlersRef.current.get(msg.type);
    if (!set) return;
    set.forEach((h) => {
      try {
        h(msg);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[ws] handler error', err);
      }
    });
  }, []);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token || !mountedRef.current) return;
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    setConnecting(true);
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl(token));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ws] construct failed', err);
      setConnecting(false);
      return;
    }
    socketRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      reconnectAttemptsRef.current = 0;
      setConnected(true);
      setConnecting(false);
    };

    ws.onmessage = (ev) => {
      try {
        const raw = JSON.parse(ev.data);
        dispatch(raw as WsServerMessage);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[ws] bad message', ev.data, err);
      }
    };

    ws.onerror = () => {
      // eslint-disable-next-line no-console
      console.warn('[ws] error');
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      setConnecting(false);
      socketRef.current = null;
      if (shouldReconnectRef.current && getToken()) {
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 15000);
        reconnectAttemptsRef.current += 1;
        reconnectTimerRef.current = window.setTimeout(() => {
          if (mountedRef.current && shouldReconnectRef.current) connect();
        }, delay);
      }
    };
  }, [dispatch]);

  useEffect(() => {
    mountedRef.current = true;
    shouldReconnectRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      shouldReconnectRef.current = false;
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (socketRef.current) {
        try {
          socketRef.current.close();
        } catch {
          /* noop */
        }
        socketRef.current = null;
      }
    };
  }, [connect]);

  const send = useCallback((msg: WsClientMessage): boolean => {
    const ws = socketRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return false;
    try {
      ws.send(JSON.stringify(msg));
      return true;
    } catch {
      return false;
    }
  }, []);

  const joinConversation = useCallback(
    (conversationId: string) => send({ type: 'join_conversation', conversationId }),
    [send],
  );
  const leaveConversation = useCallback(
    (conversationId: string) => send({ type: 'leave_conversation', conversationId }),
    [send],
  );
  const sendTyping = useCallback(
    (conversationId: string, isTyping: boolean) =>
      send({ type: 'typing', conversationId, isTyping }),
    [send],
  );
  const sendReadReceipt = useCallback(
    (conversationId: string, messageId: string) =>
      send({ type: 'read_receipt', conversationId, messageId }),
    [send],
  );
  const tempJoin = useCallback((tempId: string) => send({ type: 'temp_join', tempId }), [send]);
  const sendTempMessage = useCallback(
    (tempId: string, content: string) => send({ type: 'temp_message', tempId, content }),
    [send],
  );

  const on = useCallback((type: WsServerMessage['type'], handler: Handler) => {
    if (!handlersRef.current.has(type)) handlersRef.current.set(type, new Set());
    handlersRef.current.get(type)!.add(handler);
    return () => {
      handlersRef.current.get(type)?.delete(handler);
    };
  }, []);

  const off = useCallback((type: WsServerMessage['type'], handler: Handler) => {
    handlersRef.current.get(type)?.delete(handler);
  }, []);

  const value = useMemo<SocketState>(
    () => ({
      connected,
      connecting,
      send,
      joinConversation,
      leaveConversation,
      sendTyping,
      sendReadReceipt,
      tempJoin,
      sendTempMessage,
      on,
      off,
    }),
    [
      connected,
      connecting,
      send,
      joinConversation,
      leaveConversation,
      sendTyping,
      sendReadReceipt,
      tempJoin,
      sendTempMessage,
      on,
      off,
    ],
  );

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket(): SocketState {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}

// Re-export types for convenience.
export type { Message, TempMessage, User };
