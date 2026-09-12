import { query } from '../config/db';

export type ReportReason = 'harassment' | 'advertising' | 'abuse' | 'other';
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected';

export interface UserReport {
  id: string;
  reporter_id: string;
  reported_user_id: string;
  reason: ReportReason;
  detail: string | null;
  status: ReportStatus;
  created_at: Date;
}

export const REPORT_REASONS: ReportReason[] = ['harassment', 'advertising', 'abuse', 'other'];
export const REPORT_STATUSES: ReportStatus[] = ['pending', 'reviewing', 'resolved', 'rejected'];

export async function createReport(
  reporterId: string,
  reportedUserId: string,
  reason: ReportReason,
  detail?: string | null,
): Promise<UserReport> {
  const res = await query<UserReport>(
    `INSERT INTO user_reports (reporter_id, reported_user_id, reason, detail)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [reporterId, reportedUserId, reason, detail ?? null],
  );
  return res.rows[0];
}

/** Reports submitted by the current user. */
export async function listReportsByUser(reporterId: string): Promise<UserReport[]> {
  const res = await query<UserReport>(
    'SELECT * FROM user_reports WHERE reporter_id = $1 ORDER BY created_at DESC',
    [reporterId],
  );
  return res.rows;
}

/** All reports (admin use). */
export async function listAllReports(): Promise<UserReport[]> {
  const res = await query<UserReport>(
    'SELECT * FROM user_reports ORDER BY created_at DESC',
  );
  return res.rows;
}

export async function updateReportStatus(
  id: string,
  status: ReportStatus,
): Promise<UserReport | null> {
  const res = await query<UserReport>(
    'UPDATE user_reports SET status = $1 WHERE id = $2 RETURNING *',
    [status, id],
  );
  return res.rows[0] || null;
}
