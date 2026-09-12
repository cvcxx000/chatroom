import api from './client';
import type { AdminStats, AiConfig, SmtpConfig, TempConversation, User } from '../types';

export interface AiConfigPayload {
  provider: string;
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  isActive: boolean;
}

export interface AdminUserList {
  users: User[];
  total: number;
  page: number;
  limit: number;
}

export const adminApi = {
  listUsers: async (params?: { page?: number; limit?: number; q?: string }): Promise<AdminUserList> => {
    return (await api.get('/admin/users', { params })) as unknown as AdminUserList;
  },
  banUser: async (id: string): Promise<{ ok: boolean }> => {
    return (await api.put(`/admin/users/${id}/ban`)) as unknown as { ok: boolean };
  },
  unbanUser: async (id: string): Promise<{ ok: boolean }> => {
    return (await api.put(`/admin/users/${id}/unban`)) as unknown as { ok: boolean };
  },
  stats: async (): Promise<AdminStats> => {
    return (await api.get('/admin/stats')) as unknown as AdminStats;
  },
  getSmtp: async (): Promise<SmtpConfig> => {
    return (await api.get('/admin/smtp')) as unknown as SmtpConfig;
  },
  updateSmtp: async (cfg: SmtpConfig): Promise<{ ok: boolean }> => {
    return (await api.put('/admin/smtp', cfg)) as unknown as { ok: boolean };
  },
  testSmtp: async (to?: string): Promise<{ ok: boolean; message?: string }> => {
    return (await api.post('/admin/smtp/test', { to })) as unknown as { ok: boolean; message?: string };
  },
  listTemp: async (): Promise<TempConversation[]> => {
    return (await api.get('/admin/temp-conversations')) as unknown as TempConversation[];
  },
  getTemp: async (id: string): Promise<TempConversation> => {
    return (await api.get(`/admin/temp-conversations/${id}`)) as unknown as TempConversation;
  },
  // ---------- AI config management ----------
  listAiConfigs: async (): Promise<AiConfig[]> => {
    return (await api.get('/admin/ai-configs')) as unknown as AiConfig[];
  },
  createAiConfig: async (data: AiConfigPayload): Promise<AiConfig> => {
    return (await api.post('/admin/ai-configs', data)) as unknown as AiConfig;
  },
  updateAiConfig: async (id: string, data: Partial<AiConfigPayload>): Promise<AiConfig> => {
    return (await api.put(`/admin/ai-configs/${id}`, data)) as unknown as AiConfig;
  },
  deleteAiConfig: async (id: string): Promise<{ ok: boolean }> => {
    return (await api.delete(`/admin/ai-configs/${id}`)) as unknown as { ok: boolean };
  },
};
