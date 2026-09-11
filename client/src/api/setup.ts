import api from './client';
import type { DbConfig, SetupStatus, SmtpConfig, User } from '../types';

export const setupApi = {
  status: async (): Promise<SetupStatus> => {
    return (await api.get('/setup/status')) as unknown as SetupStatus;
  },
  testDb: async (cfg: Omit<DbConfig, 'port'> & { port: number | string }): Promise<{ ok: boolean; message?: string }> => {
    return (await api.post('/setup/test-db', cfg)) as unknown as { ok: boolean; message?: string };
  },
  init: async (payload: {
    dbConfig: DbConfig;
    admin: { username: string; email: string; password: string; displayName?: string };
    smtp?: SmtpConfig;
  }): Promise<{ token: string; user: User }> => {
    return (await api.post('/setup/init', payload)) as unknown as { token: string; user: User };
  },
};
