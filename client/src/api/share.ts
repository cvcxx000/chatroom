import api from './client';
import type { SharedLink, ShareInfo } from '../types';

export const shareApi = {
  generate: async (
    conversationId: string,
    expiresInHours?: number,
    password?: string,
  ): Promise<SharedLink> => {
    return (await api.post('/share/generate', {
      conversationId,
      expiresInHours,
      password,
    })) as unknown as SharedLink;
  },
  getInfo: async (token: string): Promise<ShareInfo> => {
    return (await api.get(`/share/${token}`)) as unknown as ShareInfo;
  },
  join: async (token: string, password?: string): Promise<{ conversationId: string }> => {
    return (await api.post(`/share/${token}/join`, { password })) as unknown as {
      conversationId: string;
    };
  },
  list: async (conversationId: string): Promise<SharedLink[]> => {
    return (await api.get(`/share/list/${conversationId}`)) as unknown as SharedLink[];
  },
  remove: async (token: string): Promise<{ ok: boolean }> => {
    return (await api.delete(`/share/${token}`)) as unknown as { ok: boolean };
  },
};
