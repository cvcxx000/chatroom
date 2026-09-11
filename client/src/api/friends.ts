import api from './client';
import type { Friend, FriendRequest, User } from '../types';

export const friendsApi = {
  list: async (): Promise<Friend[]> => {
    return (await api.get('/friends')) as unknown as Friend[];
  },
  requests: async (): Promise<FriendRequest[]> => {
    return (await api.get('/friends/requests')) as unknown as FriendRequest[];
  },
  sendRequest: async (userId: string): Promise<{ ok: boolean }> => {
    return (await api.post('/friends/request', { userId })) as unknown as { ok: boolean };
  },
  accept: async (requestId: string): Promise<{ ok: boolean; user?: User }> => {
    return (await api.post('/friends/accept', { requestId })) as unknown as { ok: boolean; user?: User };
  },
  reject: async (requestId: string): Promise<{ ok: boolean }> => {
    return (await api.post('/friends/reject', { requestId })) as unknown as { ok: boolean };
  },
  remove: async (userId: string): Promise<{ ok: boolean }> => {
    return (await api.delete(`/friends/${userId}`)) as unknown as { ok: boolean };
  },
};
