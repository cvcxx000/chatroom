import api from './client';
import type { ConversationSettings } from '../types';

export const conversationSettingsApi = {
  getSettings: async (conversationId: string): Promise<ConversationSettings> => {
    return (await api.get(
      `/conversation-settings/${conversationId}`,
    )) as unknown as ConversationSettings;
  },
  updateSetting: async (
    conversationId: string,
    patch: Partial<Pick<ConversationSettings, 'pinned' | 'muted' | 'archived'>>,
  ): Promise<ConversationSettings> => {
    return (await api.put(`/conversation-settings/${conversationId}`, patch)) as unknown as ConversationSettings;
  },
};
