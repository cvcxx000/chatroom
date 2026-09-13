import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { ok, fail } from '../utils/response';
import { AuthedRequest } from '../middleware/auth';
import { findGroupFileById, deleteGroupFile } from '../models/groupFileModel';
import { isMember, getMemberRole } from '../models/conversationModel';
import { env } from '../config/env';

const router = Router();

/** Resolve a stored file_url to an absolute path inside UPLOAD_DIR,
 *  guarding against path traversal (../) attacks. */
function safeResolveFilePath(fileUrl: string): string | null {
  const rel = fileUrl.replace(/^\/uploads\//, '');
  const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);
  const filePath = path.resolve(uploadDir, rel);
  // [SECURITY] Ensure the resolved path stays within the upload directory.
  if (filePath !== uploadDir && !filePath.startsWith(uploadDir + path.sep)) {
    return null;
  }
  return filePath;
}

/** GET /api/files/:id/download */
router.get('/:id/download', async (req: AuthedRequest, res: Response) => {
  const gf = await findGroupFileById(req.params.id);
  if (!gf) return fail(res, 404, 'file not found', 'NOT_FOUND');
  if (!(await isMember(gf.conversation_id, req.user!.id))) {
    return fail(res, 403, 'not a member', 'FORBIDDEN');
  }
  const filePath = safeResolveFilePath(gf.file_url);
  if (!filePath) return fail(res, 400, 'invalid file path', 'BAD_REQUEST');
  if (!fs.existsSync(filePath)) return fail(res, 404, 'file missing on disk', 'FILE_MISSING');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(gf.file_name)}"`);
  if (gf.file_type) res.setHeader('Content-Type', gf.file_type);
  fs.createReadStream(filePath).pipe(res);
});

/** DELETE /api/files/:id */
router.delete('/:id', async (req: AuthedRequest, res: Response) => {
  const gf = await findGroupFileById(req.params.id);
  if (!gf) return fail(res, 404, 'file not found', 'NOT_FOUND');
  const isUploader = gf.uploader_id === req.user!.id;
  const role = await getMemberRole(gf.conversation_id, req.user!.id);
  const isGroupAdmin = role === 'admin';
  const isSystemAdmin = req.user!.is_admin;
  if (!isUploader && !isGroupAdmin && !isSystemAdmin) {
    return fail(res, 403, 'not authorized to delete this file', 'FORBIDDEN');
  }
  // Remove from disk (best effort)
  try {
    const filePath = safeResolveFilePath(gf.file_url);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    /* ignore */
  }
  await deleteGroupFile(gf.id);
  return ok(res, { ok: true });
});

export default router;
