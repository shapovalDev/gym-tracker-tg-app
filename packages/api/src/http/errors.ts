import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { Prisma } from '../generated/prisma/client';

/** Consistent error body: { error: { code, message, details? } } */
export class AppError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what = 'Resource') => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);
export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export function errorBody(code: string, message: string, details?: unknown) {
  return { error: details === undefined ? { code, message } : { code, message, details } };
}

export function handleError(err: unknown, c: Context) {
  if (err instanceof AppError) {
    return c.json(errorBody(err.code, err.message, err.details), err.status);
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return c.json(errorBody('VALIDATION_ERROR', 'Invalid request', details), 400);
  }
  if (err instanceof HTTPException) {
    const status = err.status as ContentfulStatusCode;
    const code = status === 413 ? 'PAYLOAD_TOO_LARGE' : 'HTTP_ERROR';
    return c.json(errorBody(code, err.message || 'Request failed'), status);
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return c.json(errorBody('NOT_FOUND', 'Resource not found'), 404);
    if (err.code === 'P2002') return c.json(errorBody('CONFLICT', 'Conflicting record'), 409);
    if (err.code === 'P2003')
      return c.json(errorBody('CONFLICT', 'Record is still referenced'), 409);
  }
  // Log server-side without request headers or bodies (they contain initData).
  console.error(
    JSON.stringify({
      level: 'error',
      msg: 'Unhandled API error',
      method: c.req.method,
      path: c.req.path,
      error:
        err instanceof Error
          ? { name: err.name, message: err.message, stack: err.stack }
          : String(err),
    }),
  );
  return c.json(errorBody('INTERNAL', 'Internal server error'), 500);
}
