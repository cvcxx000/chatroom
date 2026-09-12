import api from './client';
import type { Conversation, GroupAnnouncement, GroupQrCode, Message } from '../types';

export const conversationsApi = {
  list: async (): Promise<Conversation[]> => {
    return (await api.get('/conversations')) as unknown as Conversation[];
  },
  get: async (id: string): Promise<Conversation> => {
    return (await api.get(`/conversations/${id}`)) as unknown as Conversation;
  },
  createPrivate: async (userId: string): Promise<Conversation> => {
    return (await api.post('/conversations/private', { userId })) as unknown as Conversation;
  },
  createGroup: async (payload: { name: string; memberIds: string[] }): Promise<Conversation> => {
    return (await api.post('/conversations/group', payload)) as unknown as Conversation;
  },
  addMembers: async (id: string, userIds: string[]): Promise<{ ok: boolean }> => {
    return (await api.post(`/conversations/${id}/members`, { userIds })) as unknown as { ok: boolean };
  },
  removeMember: async (id: string, userId: string): Promise<{ ok: boolean }> => {
    return (await api.delete(`/conversations/${id}/members/${userId}`)) as unknown as { ok: boolean };
  },
  rename: async (id: string, name: string): Promise<Conversation> => {
    return (await api.put(`/conversations/${id}`, { name })) as unknown as Conversation;
  },
  messages: async (
    id: string,
    params?: { before?: string; limit?: number },
  ): Promise<Message[]> => {
    return (await api.get(`/conversations/${id}/messages`, { params })) as unknown as Message[];
  },
  sendMessage: async (
    id: string,
    payload: {
      content: string;
      messageType?: 'text' | 'image' | 'file';
      fileUrl?: string;
      fileName?: string;
      fileSize?: number;
    },
  ): Promise<Message> => {
    return (await api.post(`/conversations/${id}/messages`, payload)) as unknown as Message;
  },
  // ---------- group management ----------
  getAnnouncement: async (id: string): Promise<GroupAnnouncement> => {
    return (await api.get(`/conversations/${id}/announcement`)) as unknown as GroupAnnouncement;
  },
  setAnnouncement: async (id: string, announcement: string): Promise<GroupAnnouncement> => {
    return (await api.put(`/conversations/${id}/announcement`, {
      announcement,
    })) as unknown as GroupAnnouncement;
  },
  setNickname: async (id: string, nickname: string): Promise<{ ok: boolean }> => {
    return (await api.put(`/conversations/${id}/nickname`, { nickname })) as unknown as { ok: boolean };
  },
  transferOwner: async (id: string, userId: string): Promise<{ ok: boolean }> => {
    return (await api.post(`/conversations/${id}/transfer`, { userId })) as unknown as { ok: boolean };
  },
  leaveGroup: async (id: string): Promise<{ ok: boolean }> => {
    return (await api.post(`/conversations/${id}/leave`)) as unknown as { ok: boolean };
  },
  getQrCode: async (id: string): Promise<GroupQrCode> => {
    return (await api.get(`/conversations/${id}/qrcode`)) as unknown as GroupQrCode;
  },
  // ---------- conversation lifecycle ----------
  clearHistory: async (id: string): Promise<{ ok: boolean }> => {
    return (await api.post(`/conversations/${id}/clear`)) as unknown as { ok: boolean };
  },
  deleteConversation: async (id: string): Promise<{ ok: boolean }> => {
    return (await api.delete(`/conversations/${id}`)) as unknown as { ok: boolean };
  },
  markRead: async (id: string): Promise<{ ok: boolean }> => {
    return (await api.put(`/conversations/${id}/read`)) as unknown as { ok: boolean };
  },
  markUnread: async (id: string): Promise<{ ok: boolean }> => {
    return (await api.put(`/conversations/${id}/unread`)) as unknown as { ok: boolean };
  },
};
