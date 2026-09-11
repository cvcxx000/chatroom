import { Response } from 'express';

export function ok(res: Response, data: unknown = null): Response {
  return res.json({ success: true, data });
}

export function fail(
  res: Response,
  status: number,
  error: string,
  code?: string,
): Response {
  return res.status(status).json({ success: false, error, code: code || 'ERROR' });
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, message: string, code = 'ERROR') {
    super(message);
    this.status = status;
    this.code = code;
  }
}
