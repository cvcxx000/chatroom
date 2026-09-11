import api, { getToken } from './client';
import type { GroupFile } from '../types';

export const filesApi = {
  list: async (conversationId: string): Promise<GroupFile[]> => {
    return (await api.get(`/conversations/${conversationId}/files`)) as unknown as GroupFile[];
  },
  upload: async (conversationId: string, file: File): Promise<GroupFile> => {
    const form = new FormData();
    form.append('file', file);
    return (await api.post(`/conversations/${conversationId}/files`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000,
    })) as unknown as GroupFile;
  },
  remove: async (fileId: string): Promise<{ ok: boolean }> => {
    return (await api.delete(`/files/${fileId}`)) as unknown as { ok: boolean };
  },
  /** Build a download URL for a file served under /uploads or /api/files. */
  downloadUrl: (file: GroupFile): string => {
    if (file.fileUrl) return file.fileUrl;
    return `/api/files/${file.id}/download`;
  },
  /** Authenticated blob download (for files behind auth). */
  downloadBlob: async (fileId: string): Promise<Blob> => {
    const resp = await api.get(`/files/${fileId}/download`, { responseType: 'blob' });
    // The interceptor passes through blob responses untouched.
    return (resp as unknown as { data: Blob }).data;
  },
  /** Open an authenticated download in a new tab via fetch+blob. */
  openAuthenticated: async (file: GroupFile, fileName?: string) => {
    const url = file.fileUrl || `/api/files/${file.id}/download`;
    try {
      const resp = await fetch(url, {
        headers: { Authorization: `Bearer ${getToken() || ''}` },
      });
      if (!resp.ok) throw new Error('download failed');
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName || file.fileName || 'download';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    } catch {
      // Fallback: plain link
      window.open(url, '_blank');
    }
  },
};
