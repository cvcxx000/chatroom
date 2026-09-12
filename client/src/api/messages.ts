import api from './client';
import type { Message } from '../types';

/**
 * 消息级操作 API：编辑 / 撤回 / 表情回应 / 搜索 / 置顶 / 转发。
 * 与 conversations.ts 分开，便于按消息维度维护。
 */
export const messagesApi = {
  /** 编辑自己的消息 -> PUT /api/messages/:id */
  edit: async (id: string, content: string): Promise<Message> => {
    return (await api.put(`/messages/${id}`, { content })) as unknown as Message;
  },

  /** 撤回消息 -> DELETE /api/messages/:id */
  remove: async (id: string, forEveryone = true): Promise<{ ok: boolean }> => {
    return (await api.delete(`/messages/${id}`, { data: { forEveryone } })) as unknown as {
      ok: boolean;
    };
  },

  /** 添加表情回应 -> POST /api/messages/:id/reactions */
  addReaction: async (id: string, emoji: string): Promise<Message> => {
    return (await api.post(`/messages/${id}/reactions`, { emoji })) as unknown as Message;
  },

  /** 移除表情回应 -> DELETE /api/messages/:id/reactions/:emoji */
  removeReaction: async (id: string, emoji: string): Promise<Message> => {
    return (await api.delete(
      `/messages/${id}/reactions/${encodeURIComponent(emoji)}`,
    )) as unknown as Message;
  },

  /** 搜索当前会话消息 -> GET /api/conversations/:id/search?q= */
  search: async (convId: string, q: string): Promise<Message[]> => {
    return (await api.get(`/conversations/${convId}/search`, {
      params: { q },
    })) as unknown as Message[];
  },

  /** 置顶消息 -> POST /api/conversations/:id/pin */
  pin: async (convId: string, messageId: string): Promise<{ ok: boolean }> => {
    return (await api.post(`/conversations/${convId}/pin`, { messageId })) as unknown as {
      ok: boolean;
    };
  },

  /** 取消置顶 -> DELETE /api/conversations/:id/pin/:messageId */
  unpin: async (convId: string, messageId: string): Promise<{ ok: boolean }> => {
    return (await api.delete(
      `/conversations/${convId}/pin/${messageId}`,
    )) as unknown as { ok: boolean };
  },

  /** 获取置顶消息列表 -> GET /api/conversations/:id/pinned */
  pinned: async (convId: string): Promise<Message[]> => {
    return (await api.get(`/conversations/${convId}/pinned`)) as unknown as Message[];
  },

  /** 转发消息 -> POST /api/messages/:id/forward */
  forward: async (id: string, targetConvId: string): Promise<Message> => {
    return (await api.post(`/messages/${id}/forward`, {
      targetConversationId: targetConvId,
    })) as unknown as Message;
  },
};

export default messagesApi;
