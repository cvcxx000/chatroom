import api from './client';
import type { AiProvider, Conversation, UserAiConfig } from '../types';

export const aiApi = {
  listProviders: async (): Promise<AiProvider[]> => {
    return (await api.get('/ai/providers')) as unknown as AiProvider[];
  },
  createConversation: async (configId?: string, model?: string): Promise<Conversation> => {
    return (await api.post('/ai/conversation', { configId, model })) as unknown as Conversation;
  },
  // ---------- User-owned AI provider configs ----------
  listUserProviders: async (): Promise<UserAiConfig[]> => {
    return (await api.get('/ai/providers/me')) as unknown as UserAiConfig[];
  },
  createUserProvider: async (payload: Partial<UserAiConfig>): Promise<UserAiConfig> => {
    return (await api.post('/ai/providers/me', payload)) as unknown as UserAiConfig;
  },
  updateUserProvider: async (id: string, payload: Partial<UserAiConfig>): Promise<UserAiConfig> => {
    return (await api.put(`/ai/providers/me/${id}`, payload)) as unknown as UserAiConfig;
  },
  deleteUserProvider: async (id: string): Promise<{ success: boolean }> => {
    return (await api.delete(`/ai/providers/me/${id}`)) as unknown as { success: boolean };
  },
};
