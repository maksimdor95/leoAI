/**
 * Retry utility with exponential backoff
 */

import { logger } from './logger';

export interface RetryOptions {
  maxRetries?: number;
  initialDelay?: number; // in milliseconds
  maxDelay?: number; // in milliseconds
  factor?: number; // exponential backoff factor
  onRetry?: (error: unknown, attempt: number) => void;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 10000,
  factor: 2,
  onRetry: () => {},
};

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      if (attempt < opts.maxRetries) {
        const delay = Math.min(opts.initialDelay * Math.pow(opts.factor, attempt), opts.maxDelay);

        logger.warn(
          `Retry attempt ${attempt + 1}/${opts.maxRetries} after ${delay}ms`,
          error instanceof Error ? error.message : String(error)
        );

        if (opts.onRetry) {
          opts.onRetry(error, attempt + 1);
        }

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * Check if error is retryable (network errors, timeouts, 5xx errors)
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  // Check for axios errors
  if (error && typeof error === 'object' && 'isAxiosError' in error) {
    const axiosError = error as {
      isAxiosError: boolean;
      code?: string;
      response?: { status?: number };
    };

    // Network errors or timeouts
    if (
      axiosError.code === 'ECONNREFUSED' ||
      axiosError.code === 'ETIMEDOUT' ||
      axiosError.code === 'ENOTFOUND' ||
      axiosError.code === 'ECONNRESET'
    ) {
      return true;
    }

    // 5xx server errors
    if (axiosError.response?.status && axiosError.response.status >= 500) {
      return true;
    }

    // 429 Too Many Requests
    if (axiosError.response?.status === 429) {
      return true;
    }
  }

  // Check for generic timeout errors
  if (error instanceof Error) {
    if (
      error.message.includes('timeout') ||
      error.message.includes('TIMEOUT') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ETIMEDOUT')
    ) {
      return true;
    }
  }

  return false;
}
