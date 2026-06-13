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
  const e = err as Partial<HttpError> & { message?: string; status?: number };
  // OpenAI/OpenRouter SDK errors carry `.status`; surface 429/5xx as the right
  // code so the clinic never shows a raw "500" for an upstream LLM hiccup.
  const status = e.status || 500;
  const code = e.code
    || (status === 429 ? 'RateLimited'
      : status === 503 ? 'ProviderUnavailable'
      : status === 502 ? 'UpstreamError'
      : 'InternalError');

  if (status >= 500) {
    console.error('[error]', err);
  }

  // Friendly, retry-able messages for the common AI-service failure modes.
  // For unexpected 500s, never leak the raw internal message to the client.
  const friendly =
    status === 429 ? 'The AI service is busy right now. Please wait a moment and try again.'
    : status === 503 ? (e.publicMessage || 'A required service is unavailable. Please try again shortly.')
    : status === 502 ? 'The AI service returned an unexpected response. Please try again.'
    : status >= 500  ? 'Something went wrong on our end. Please try again.'
    : (e.publicMessage || e.message || 'Request failed');

  res.status(status).json({ error: code, message: friendly });
}
