import api from './client';
import type { QuickReply } from '../types';

export interface QuickReplyPayload {
  title: string;
  content: string;
  shortcut?: string | null;
  sortOrder?: number;
}

export const quickRepliesApi = {
  list: async (): Promise<QuickReply[]> => {
    return (await api.get('/quick-replies')) as unknown as QuickReply[];
  },
  create: async (payload: QuickReplyPayload): Promise<QuickReply> => {
    return (await api.post('/quick-replies', payload)) as unknown as QuickReply;
  },
  update: async (id: string, payload: Partial<QuickReplyPayload>): Promise<QuickReply> => {
    return (await api.put(`/quick-replies/${id}`, payload)) as unknown as QuickReply;
  },
  remove: async (id: string): Promise<{ success: boolean }> => {
    return (await api.delete(`/quick-replies/${id}`)) as unknown as { success: boolean };
  },
};
