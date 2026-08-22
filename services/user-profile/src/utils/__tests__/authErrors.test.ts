import { AUTH_ERROR_CODES, buildAuthErrorBody, fromValidationErrors } from '../authErrors';

describe('authErrors', () => {
  it('buildAuthErrorBody includes code, message, and legacy error', () => {
    const body = buildAuthErrorBody(AUTH_ERROR_CODES.PASSWORD_TOO_SHORT);
    expect(body.code).toBe('AUTH_PASSWORD_TOO_SHORT');
    expect(body.message).toContain('8 characters');
    expect(body.error).toBe(body.message);
  });

  it('fromValidationErrors maps password rules to fields and primary code', () => {
    const body = fromValidationErrors([
      {
        type: 'field',
        path: 'password',
        msg: 'Password must be at least 8 characters',
        location: 'body',
        value: '123',
      },
      {
        type: 'field',
        path: 'password',
        msg: 'Password must contain at least one letter',
        location: 'body',
        value: '123',
      },
    ]);

    expect(body.code).toBe(AUTH_ERROR_CODES.PASSWORD_TOO_SHORT);
    expect(body.fields?.password).toEqual([
      AUTH_ERROR_CODES.PASSWORD_TOO_SHORT,
      AUTH_ERROR_CODES.PASSWORD_NEEDS_LETTER,
    ]);
    expect(body.errors).toHaveLength(2);
  });

  it('fromValidationErrors maps invalid email', () => {
    const body = fromValidationErrors([
      {
        type: 'field',
        path: 'email',
        msg: 'Valid email is required',
        location: 'body',
        value: 'bad',
      },
    ]);
    expect(body.code).toBe(AUTH_ERROR_CODES.EMAIL_INVALID);
    expect(body.fields?.email).toEqual([AUTH_ERROR_CODES.EMAIL_INVALID]);
  });
});
