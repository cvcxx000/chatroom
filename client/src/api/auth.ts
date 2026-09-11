import api from './client';
import type { User } from '../types';

export const authApi = {
  register: async (payload: {
    username: string;
    email: string;
    password: string;
    displayName?: string;
  }): Promise<{ token: string; user: User }> => {
    return (await api.post('/auth/register', payload)) as unknown as { token: string; user: User };
  },
  login: async (payload: { username: string; password: string }): Promise<{ token: string; user: User }> => {
    return (await api.post('/auth/login', payload)) as unknown as { token: string; user: User };
  },
  adminLogin: async (payload: { username: string; password: string }): Promise<{ token: string; user: User }> => {
    return (await api.post('/auth/admin-login', payload)) as unknown as { token: string; user: User };
  },
  me: async (): Promise<User> => {
    return (await api.get('/auth/me')) as unknown as User;
  },
  verifyEmail: async (token: string): Promise<{ ok: boolean }> => {
    return (await api.post('/auth/verify-email', { token })) as unknown as { ok: boolean };
  },
  resendVerification: async (email: string): Promise<{ ok: boolean }> => {
    return (await api.post('/auth/resend-verification', { email })) as unknown as { ok: boolean };
  },
};
