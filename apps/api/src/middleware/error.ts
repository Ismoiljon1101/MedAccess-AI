import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  status: number;
  code?: string;
  publicMessage?: string;

  constructor(
    status: number,
    message: string,
    opts: { code?: string; publicMessage?: string } = {}
  ) {
    super(message);
    this.status = status;
    this.code = opts.code;
    this.publicMessage = opts.publicMessage || message;
  }
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: 'NotFound',
    message: `Route ${req.method} ${req.originalUrl} does not exist`,
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const e = err as Partial<HttpError> & { message?: string };
  const status = e.status || 500;
  const code = e.code || (status === 503 ? 'ProviderUnavailable' : 'InternalError');

  if (status >= 500) {
    console.error('[error]', err);
  }

  res.status(status).json({
    error: code,
    message: e.publicMessage || e.message || 'Unexpected server error',
  });
}
