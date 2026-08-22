/**
 * Parse auth API errors into toast + field messages (localized via authUiCopy).
 */

import type { AppLocale } from '@/types/appSettings';
import { authUi } from '@/lib/authUiCopy';

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

type AuthField = 'email' | 'password' | 'token';

type AuthApiData = {
  code?: string;
  message?: string;
  error?: string;
  fields?: Partial<Record<AuthField, string[]>>;
  errors?: Array<{ msg?: string; path?: string }>;
};

type AxiosLikeError = {
  response?: {
    status?: number;
    data?: AuthApiData;
  };
};

export type ParsedAuthError = {
  code: AuthErrorCode | null;
  toastMessage: string;
  fieldErrors: Partial<Record<AuthField, string>>;
};

const LEGACY_MSG_TO_CODE: Record<string, AuthErrorCode> = {
  'Valid email is required': AUTH_ERROR_CODES.EMAIL_INVALID,
  'Password is required': AUTH_ERROR_CODES.PASSWORD_REQUIRED,
  'Password must be at least 8 characters': AUTH_ERROR_CODES.PASSWORD_TOO_SHORT,
  'Password must contain at least one letter': AUTH_ERROR_CODES.PASSWORD_NEEDS_LETTER,
  'Password must contain at least one digit': AUTH_ERROR_CODES.PASSWORD_NEEDS_DIGIT,
  'Reset token is required': AUTH_ERROR_CODES.RESET_TOKEN_REQUIRED,
  'User with this email already exists': AUTH_ERROR_CODES.EMAIL_TAKEN,
  'Invalid email or password': AUTH_ERROR_CODES.INVALID_CREDENTIALS,
  'Too many requests, please retry later': AUTH_ERROR_CODES.RATE_LIMITED,
  'Invalid or expired reset token': AUTH_ERROR_CODES.RESET_TOKEN_INVALID,
};

function isAuthErrorCode(value: string | undefined): value is AuthErrorCode {
  if (!value) return false;
  return Object.values(AUTH_ERROR_CODES).includes(value as AuthErrorCode);
}

function localizeCode(code: AuthErrorCode, locale: AppLocale): string {
  const t = authUi(locale);
  return t.authErrors[code] ?? t.registerError;
}

function messageForCodes(codes: AuthErrorCode[], locale: AppLocale): string {
  const unique = [...new Set(codes)];
  return unique.map((c) => localizeCode(c, locale)).join('. ');
}

function collectCodesFromData(data: AuthApiData | undefined, status?: number): AuthErrorCode[] {
  const codes: AuthErrorCode[] = [];
  if (!data) {
    if (status === 429) return [AUTH_ERROR_CODES.RATE_LIMITED];
    return codes;
  }

  if (isAuthErrorCode(data.code)) {
    codes.push(data.code);
  }

  if (data.fields) {
    for (const list of Object.values(data.fields)) {
      if (!list) continue;
      for (const item of list) {
        if (isAuthErrorCode(item) && !codes.includes(item)) codes.push(item);
      }
    }
  }

  if (data.errors) {
    for (const err of data.errors) {
      const msg = typeof err.msg === 'string' ? err.msg : '';
      const mapped = LEGACY_MSG_TO_CODE[msg];
      if (mapped && !codes.includes(mapped)) codes.push(mapped);
    }
  }

  if (codes.length === 0) {
    const legacy = data.error || data.message;
    if (typeof legacy === 'string') {
      const mapped = LEGACY_MSG_TO_CODE[legacy];
      if (mapped) codes.push(mapped);
      // Russian reset messages from older/newer API
      if (
        legacy.includes('недействительна') ||
        legacy.toLowerCase().includes('invalid or expired')
      ) {
        codes.push(AUTH_ERROR_CODES.RESET_TOKEN_INVALID);
      }
    }
  }

  if (codes.length === 0 && status === 429) {
    codes.push(AUTH_ERROR_CODES.RATE_LIMITED);
  }

  return codes;
}

function buildFieldErrors(
  data: AuthApiData | undefined,
  codes: AuthErrorCode[],
  locale: AppLocale
): Partial<Record<AuthField, string>> {
  const out: Partial<Record<AuthField, string>> = {};
  const t = authUi(locale);

  if (data?.fields) {
    for (const field of ['email', 'password', 'token'] as AuthField[]) {
      const list = data.fields[field];
      if (!list?.length) continue;
      const fieldCodes = list.filter(isAuthErrorCode);
      if (fieldCodes.length) {
        out[field] = messageForCodes(fieldCodes, locale);
      }
    }
  }

  if (!out.email && !out.password && !out.token && data?.errors) {
    for (const err of data.errors) {
      const path = err.path;
      const msg = typeof err.msg === 'string' ? err.msg : '';
      if (path !== 'email' && path !== 'password' && path !== 'token') continue;
      const code = LEGACY_MSG_TO_CODE[msg];
      const text = code ? localizeCode(code, locale) : msg;
      if (!out[path]) out[path] = text;
      else if (!out[path]!.includes(text)) out[path] = `${out[path]}. ${text}`;
    }
  }

  // Infer fields from primary codes when API omitted fields
  if (!out.password) {
    const passwordCodes = codes.filter(
      (c): c is AuthErrorCode =>
        c === AUTH_ERROR_CODES.PASSWORD_REQUIRED ||
        c === AUTH_ERROR_CODES.PASSWORD_TOO_SHORT ||
        c === AUTH_ERROR_CODES.PASSWORD_NEEDS_LETTER ||
        c === AUTH_ERROR_CODES.PASSWORD_NEEDS_DIGIT
    );
    if (passwordCodes.length) out.password = messageForCodes(passwordCodes, locale);
  }
  if (!out.email) {
    const emailCodes = codes.filter(
      (c): c is AuthErrorCode =>
        c === AUTH_ERROR_CODES.EMAIL_INVALID || c === AUTH_ERROR_CODES.EMAIL_TAKEN
    );
    if (emailCodes.length) out.email = messageForCodes(emailCodes, locale);
  }
  if (!out.token) {
    if (codes.includes(AUTH_ERROR_CODES.RESET_TOKEN_INVALID)) {
      out.token = t.authErrors.AUTH_RESET_TOKEN_INVALID;
    }
  }

  return out;
}

export function parseAuthError(error: unknown, locale: AppLocale, fallback: string): ParsedAuthError {
  const axiosError =
    typeof error === 'object' && error !== null && 'response' in error
      ? (error as AxiosLikeError)
      : null;
  const data = axiosError?.response?.data;
  const status = axiosError?.response?.status;
  const codes = collectCodesFromData(data, status);
  const primary = codes[0] ?? null;

  let toastMessage = fallback;
  if (codes.length > 0) {
    toastMessage = messageForCodes(codes, locale);
  } else if (typeof data?.message === 'string' && data.message.trim()) {
    toastMessage = data.message.trim();
  } else if (typeof data?.error === 'string' && data.error.trim()) {
    toastMessage = data.error.trim();
  }

  return {
    code: primary,
    toastMessage,
    fieldErrors: buildFieldErrors(data, codes, locale),
  };
}

/** Ant Design Form.setFields payload from parsed auth error. */
export function toAntFieldErrors(
  fieldErrors: Partial<Record<AuthField, string>>
): Array<{ name: AuthField; errors: string[] }> {
  return (Object.keys(fieldErrors) as AuthField[])
    .filter((name) => fieldErrors[name])
    .map((name) => ({ name, errors: [fieldErrors[name]!] }));
}

/** Client-side password rules aligned with user-profile registerValidation. */
export function passwordRegisterRules(locale: AppLocale) {
  const t = authUi(locale);
  return [
    { required: true, message: t.passwordRequired },
    { min: 8, message: t.passwordMin },
    {
      pattern: /[A-Za-z]/,
      message: t.passwordNeedsLetter,
    },
    {
      pattern: /\d/,
      message: t.passwordNeedsDigit,
    },
  ];
}
