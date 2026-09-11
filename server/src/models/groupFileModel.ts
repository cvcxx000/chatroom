import { query } from '../config/db';
import { GroupFile } from './types';

export async function createGroupFile(data: {
  conversationId: string;
  uploaderId: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number | null;
  fileType?: string | null;
}): Promise<GroupFile> {
  const res = await query<GroupFile>(
    `INSERT INTO group_files (conversation_id, uploader_id, file_name, file_url, file_size, file_type)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.conversationId,
      data.uploaderId,
      data.fileName,
      data.fileUrl,
      data.fileSize != null ? String(data.fileSize) : null,
      data.fileType || null,
    ],
  );
  return res.rows[0];
}

export async function listGroupFiles(conversationId: string): Promise<GroupFile[]> {
  const res = await query<GroupFile>(
    `SELECT * FROM group_files WHERE conversation_id = $1 ORDER BY created_at DESC`,
    [conversationId],
  );
  return res.rows;
}

export async function findGroupFileById(id: string): Promise<GroupFile | null> {
  const res = await query<GroupFile>(
    'SELECT * FROM group_files WHERE id = $1 LIMIT 1',
    [id],
  );
  return res.rows[0] || null;
}

export async function deleteGroupFile(id: string): Promise<void> {
  await query('DELETE FROM group_files WHERE id = $1', [id]);
}

export async function countGroupFiles(): Promise<number> {
  const res = await query<{ count: string }>('SELECT COUNT(*)::int AS count FROM group_files');
  return parseInt(res.rows[0]?.count || '0', 10);
}
