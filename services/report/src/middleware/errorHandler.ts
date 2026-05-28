import { Request, Response, NextFunction } from 'express';
import { Sentry } from '../utils/sentry';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (!err.isOperational) {
    Sentry.captureException(err instanceof Error ? err : new Error(message), {
      extra: { method: req.method, path: req.path, statusCode },
    });
  }

  logger.error(`Error: ${message}`, {
    statusCode,
    stack: err.stack,
  });

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}
