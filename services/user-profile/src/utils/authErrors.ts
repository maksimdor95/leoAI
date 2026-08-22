/**
 * Stable auth error codes for register / login / password reset.
 * Frontend maps these to localized copy; do not change codes casually.
 */

import { Response } from 'express';
import { ValidationError } from 'express-validator';

export const AUTH_ERROR_CODES = {
  EMAIL_INVALID: 'AUTH_EMAIL_INVALID',
  PASSWORD_REQUIRED: 'AUTH_PASSWORD_REQUIRED',
  PASSWORD_TOO_SHORT: 'AUTH_PASSWORD_TOO_SHORT',
  PASSWORD_NEEDS_LETTER: 'AUTH_PASSWORD_NEEDS_LETTER',
  PASSWORD_NEEDS_DIGIT: 'AUTH_PASSWORD_NEEDS_DIGIT',
  EMAIL_TAKEN: 'AUTH_EMAIL_TAKEN',
  INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  RATE_LIMITED: 'AUTH_RATE_LIMITED',
  RESET_TOKEN_INVALID: 'AUTH_RESET_TOKEN_INVALID',
  RESET_TOKEN_REQUIRED: 'AUTH_RESET_TOKEN_REQUIRED',
  INTERNAL: 'AUTH_INTERNAL',
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export type AuthErrorFields = Partial<Record<'email' | 'password' | 'token', AuthErrorCode[]>>;

export type AuthErrorBody = {
  code: AuthErrorCode;
  message: string;
  /** Legacy string for older clients */
  error: string;
  fields?: AuthErrorFields;
  /** Legacy express-validator array (compatible) */
  errors?: Array<{ msg: string; path?: string; type?: string }>;
};

const CODE_MESSAGES: Record<AuthErrorCode, string> = {
  AUTH_EMAIL_INVALID: 'Valid email is required',
  AUTH_PASSWORD_REQUIRED: 'Password is required',
  AUTH_PASSWORD_TOO_SHORT: 'Password must be at least 8 characters',
  AUTH_PASSWORD_NEEDS_LETTER: 'Password must contain at least one letter',
  AUTH_PASSWORD_NEEDS_DIGIT: 'Password must contain at least one digit',
  AUTH_EMAIL_TAKEN: 'User with this email already exists',
  AUTH_INVALID_CREDENTIALS: 'Invalid email or password',
  AUTH_RATE_LIMITED: 'Too many requests, please retry later',
  AUTH_RESET_TOKEN_INVALID: 'Reset link is invalid or expired',
  AUTH_RESET_TOKEN_REQUIRED: 'Reset token is required',
  AUTH_INTERNAL: 'Internal server error',
};

/** Map express-validator `msg` (set via withMessage) to stable codes. */
const MSG_TO_CODE: Record<string, AuthErrorCode> = {
  'Valid email is required': AUTH_ERROR_CODES.EMAIL_INVALID,
  'Password is required': AUTH_ERROR_CODES.PASSWORD_REQUIRED,
  'Password must be at least 8 characters': AUTH_ERROR_CODES.PASSWORD_TOO_SHORT,
  'Password must contain at least one letter': AUTH_ERROR_CODES.PASSWORD_NEEDS_LETTER,
  'Password must contain at least one digit': AUTH_ERROR_CODES.PASSWORD_NEEDS_DIGIT,
  'Reset token is required': AUTH_ERROR_CODES.RESET_TOKEN_REQUIRED,
};

function fieldFromPath(path: string | undefined): keyof AuthErrorFields | undefined {
  if (path === 'email' || path === 'password' || path === 'token') return path;
  return undefined;
}

export function buildAuthErrorBody(
  code: AuthErrorCode,
  options?: {
    message?: string;
    fields?: AuthErrorFields;
    errors?: AuthErrorBody['errors'];
  }
): AuthErrorBody {
  const message = options?.message ?? CODE_MESSAGES[code];
  const body: AuthErrorBody = {
    code,
    message,
    error: message,
  };
  if (options?.fields && Object.keys(options.fields).length > 0) {
    body.fields = options.fields;
  }
  if (options?.errors && options.errors.length > 0) {
    body.errors = options.errors;
  }
  return body;
}

export function sendAuthError(
  res: Response,
  status: number,
  code: AuthErrorCode,
  options?: {
    message?: string;
    fields?: AuthErrorFields;
    errors?: AuthErrorBody['errors'];
  }
): Response {
  return res.status(status).json(buildAuthErrorBody(code, options));
}

/**
 * Convert express-validator result into auth error body (primary code + fields).
 */
export function fromValidationErrors(validationErrors: ValidationError[]): AuthErrorBody {
  const fields: AuthErrorFields = {};
  const legacyErrors: AuthErrorBody['errors'] = [];
  const codes: AuthErrorCode[] = [];

  for (const err of validationErrors) {
    const msg =
      'msg' in err && typeof err.msg === 'string' ? err.msg : CODE_MESSAGES.AUTH_INTERNAL;
    const path = 'path' in err && typeof err.path === 'string' ? err.path : undefined;
    const code = MSG_TO_CODE[msg] ?? AUTH_ERROR_CODES.INTERNAL;
    codes.push(code);
    legacyErrors.push({ msg, path, type: 'field' });

    const field = fieldFromPath(path);
    if (field) {
      const list = fields[field] ?? [];
      if (!list.includes(code)) list.push(code);
      fields[field] = list;
    }
  }

  const primary = codes[0] ?? AUTH_ERROR_CODES.INTERNAL;
  return buildAuthErrorBody(primary, {
    fields: Object.keys(fields).length > 0 ? fields : undefined,
    errors: legacyErrors,
  });
}

export function sendValidationAuthError(res: Response, validationErrors: ValidationError[]): Response {
  return res.status(400).json(fromValidationErrors(validationErrors));
}
