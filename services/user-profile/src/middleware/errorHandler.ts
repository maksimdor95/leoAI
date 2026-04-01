/**
 * Centralized Error Handler Middleware
 * Provides consistent error response format across all services
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  code?: string;
}

/**
 * Create application error with status code
 */
export class ApplicationError extends Error implements AppError {
  statusCode: number;
  isOperational: boolean;
  code?: string;

  constructor(message: string, statusCode: number = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Get error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

/**
 * Get status code from error
 */
export function getErrorStatusCode(error: unknown): number {
  if (error instanceof ApplicationError) {
    return error.statusCode;
  }
  if (error && typeof error === 'object' && 'statusCode' in error) {
    return (error as { statusCode: number }).statusCode;
  }
  return 500;
}

/**
 * Determine if error should be logged
 */
export function shouldLogError(error: unknown): boolean {
  if (error instanceof ApplicationError && error.isOperational) {
    return false; // Operational errors are expected and don't need logging
  }
  return true; // Unexpected errors should be logged
}

/**
 * Error handler middleware
 * Should be added after all routes
 */
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  // If headers already sent, delegate to default Express error handler
  if (res.headersSent) {
    next(err);
    return;
  }

  const statusCode = getErrorStatusCode(err);
  const message = getErrorMessage(err);
  const errorCode =
    err && typeof err === 'object' && 'code' in err ? (err as { code: string }).code : undefined;

  // Log error if needed
  if (shouldLogError(err)) {
    logger.error('Request error:', {
      method: req.method,
      path: req.path,
      statusCode,
      error: message,
      stack: err instanceof Error ? err.stack : undefined,
      body: req.body,
      query: req.query,
    });
    // #region agent log
    if (req.path.includes('/api/users/register')) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require('fs');
      const logPath = 'c:\\Users\\Marina\\Desktop\\AIheroes\\.cursor\\debug.log';
      const logEntry =
        JSON.stringify({
          location: 'errorHandler.ts:86',
          message: 'Backend: Error handler - register request failed',
          data: {
            method: req.method,
            path: req.path,
            statusCode,
            error: message,
            errorStack: err instanceof Error ? err.stack : undefined,
            body: req.body,
            bodyType: typeof req.body,
            contentType: req.headers['content-type'],
            contentLength: req.headers['content-length'],
          },
          timestamp: Date.now(),
          sessionId: 'debug-session',
          runId: 'run1',
          hypothesisId: 'C',
        }) + '\n';
      try {
        fs.appendFileSync(logPath, logEntry, 'utf8');
      } catch (e) {
        // Ignore file write errors in production
      }
    }
    // #endregion
  } else {
    logger.info('Operational error:', {
      method: req.method,
      path: req.path,
      statusCode,
      error: message,
    });
  }

  // Send error response
  const response: {
    status: string;
    error: string;
    code?: string;
    details?: unknown;
  } = {
    status: 'error',
    error: message,
  };

  if (errorCode) {
    response.code = errorCode;
  }

  // Include error details in development
  if (process.env.NODE_ENV === 'development' && err instanceof Error && err.stack) {
    response.details = {
      stack: err.stack,
    };
  }

  res.status(statusCode).json(response);
}

/**
 * Async handler wrapper to catch errors in async routes
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    status: 'error',
    error: `Route ${req.method} ${req.path} not found`,
    code: 'NOT_FOUND',
  });
}
