import api from './client';
import type { User, UserStatus } from '../types';

export const usersApi = {
  search: async (q: string): Promise<User[]> => {
    return (await api.get('/users/search', { params: { q } })) as unknown as User[];
  },
  profile: async (id: string): Promise<User> => {
    return (await api.get(`/users/${id}/profile`)) as unknown as User;
  },
  updateProfile: async (payload: { displayName?: string; email?: string; avatarUrl?: string }): Promise<User> => {
    return (await api.put('/users/profile', payload)) as unknown as User;
  },
  changePassword: async (payload: {
    oldPassword: string;
    newPassword: string;
  }): Promise<{ success: boolean }> => {
    return (await api.post('/users/password', payload)) as unknown as { success: boolean };
  },
  uploadAvatar: async (file: File): Promise<{ avatarUrl: string }> => {
    const form = new FormData();
    form.append('avatar', file);
    return (await api.post('/users/avatar', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })) as unknown as { avatarUrl: string };
  },
  updateStatus: async (status: string, customMessage?: string): Promise<UserStatus> => {
    return (await api.put('/users/status', { status, customMessage })) as unknown as UserStatus;
  },
  getStatus: async (userId: string): Promise<UserStatus> => {
    return (await api.get(`/users/${userId}/status`)) as unknown as UserStatus;
  },
  blockUser: async (userId: string): Promise<{ success: boolean }> => {
    return (await api.post(`/users/${userId}/block`)) as unknown as { success: boolean };
  },
  unblockUser: async (userId: string): Promise<{ success: boolean }> => {
    return (await api.delete(`/users/${userId}/block`)) as unknown as { success: boolean };
  },
  getBlockedList: async (): Promise<User[]> => {
    return (await api.get('/users/blocked')) as unknown as User[];
  },
};
