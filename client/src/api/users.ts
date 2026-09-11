import api from './client';
import type { User } from '../types';

export const usersApi = {
  search: async (q: string): Promise<User[]> => {
    return (await api.get('/users/search', { params: { q } })) as unknown as User[];
  },
  profile: async (id: string): Promise<User> => {
    return (await api.get(`/users/${id}/profile`)) as unknown as User;
  },
  updateProfile: async (payload: { displayName?: string; avatarUrl?: string }): Promise<User> => {
    return (await api.put('/users/profile', payload)) as unknown as User;
  },
};
