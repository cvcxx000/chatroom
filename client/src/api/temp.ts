import api from './client';
import type { TempConversation, TempMessage } from '../types';

export const tempApi = {
  start: async (userId: string): Promise<{ tempId: string; conversation?: TempConversation }> => {
    return (await api.post('/temp/start', { userId })) as unknown as {
      tempId: string;
      conversation?: TempConversation;
    };
  },
  get: async (tempId: string): Promise<TempConversation> => {
    return (await api.get(`/temp/${tempId}`)) as unknown as TempConversation;
  },
  send: async (tempId: string, content: string): Promise<TempMessage> => {
    return (await api.post(`/temp/${tempId}/send`, { content })) as unknown as TempMessage;
  },
};
