import api from './client';
import type { AiProvider, Conversation } from '../types';

export const aiApi = {
  listProviders: async (): Promise<AiProvider[]> => {
    return (await api.get('/ai/providers')) as unknown as AiProvider[];
  },
  createConversation: async (configId?: string, model?: string): Promise<Conversation> => {
    return (await api.post('/ai/conversation', { configId, model })) as unknown as Conversation;
  },
};
