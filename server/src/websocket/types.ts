import { WebSocket } from 'ws';
import type { ClientEntry } from './hub';

export interface AuthedClient {
  ws: WebSocket;
  userId: string;
  entry: ClientEntry;
}

/**
 * Server -> client event payloads. The hub sends plain JSON, these are the
 * contracts for the new events added alongside shared links / QR / AI.
 */

/** streamed AI reply delta; done=true carries the finalized message. */
export interface AiStreamEvent {
  type: 'ai_stream';
  conversationId: string;
  messageId: string;
  delta?: string;
  done?: boolean;
  message?: unknown;
  sender?: unknown;
}

/** optional QR status push (polling remains the primary mechanism). */
export interface QrStatusEvent {
  type: 'qr_status';
  token: string;
  status: string;
}

