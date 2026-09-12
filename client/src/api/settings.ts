import api from './client';
import type { UserSettings } from '../types';

export const settingsApi = {
  getSettings: async (): Promise<UserSettings> => {
    return (await api.get('/settings')) as unknown as UserSettings;
  },
  updateSettings: async (payload: Partial<UserSettings>): Promise<UserSettings> => {
    return (await api.put('/settings', payload)) as unknown as UserSettings;
  },
};
