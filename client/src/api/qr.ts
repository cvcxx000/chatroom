import api from './client';
import type { QrSession, User } from '../types';

export const qrApi = {
  create: async (): Promise<QrSession> => {
    return (await api.post('/qr/create')) as unknown as QrSession;
  },
  getStatus: async (token: string): Promise<QrSession> => {
    return (await api.get(`/qr/${token}/status`)) as unknown as QrSession;
  },
  scan: async (token: string): Promise<QrSession> => {
    return (await api.post(`/qr/${token}/scan`)) as unknown as QrSession;
  },
  confirm: async (token: string): Promise<QrSession> => {
    return (await api.post(`/qr/${token}/confirm`)) as unknown as QrSession;
  },
  login: async (token: string): Promise<{ token: string; user: User }> => {
    return (await api.post(`/qr/${token}/login`)) as unknown as { token: string; user: User };
  },
};
