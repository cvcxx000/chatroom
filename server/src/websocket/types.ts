import { WebSocket } from 'ws';
import type { ClientEntry } from './hub';

export interface AuthedClient {
  ws: WebSocket;
  userId: string;
  entry: ClientEntry;
}
