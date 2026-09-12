import api from './client';

export type ReportReason = 'harassment' | 'advertising' | 'abuse' | 'other';

export const reportsApi = {
  reportUser: async (
    userId: string,
    reason: ReportReason | string,
    detail?: string,
  ): Promise<{ success: boolean }> => {
    return (await api.post(`/users/${userId}/report`, { reason, detail })) as unknown as {
      success: boolean;
    };
  },
  listMine: async (): Promise<any[]> => {
    return (await api.get('/reports/mine')) as unknown as any[];
  },
};
