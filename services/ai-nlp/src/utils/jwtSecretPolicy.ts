const INSECURE_JWT_SECRETS = new Set([
  'your_jwt_secret_key_here_change_in_production',
  'your-secret-key-change-in-production',
  'dev-secret-key',
]);

export function appendJwtSecretValidation(errors: string[], warnings: string[]): void {
  const jwtSecret = process.env.JWT_SECRET?.trim();
  const isProduction = process.env.NODE_ENV === 'production';

  if (!jwtSecret || INSECURE_JWT_SECRETS.has(jwtSecret)) {
    const msg = 'JWT_SECRET is not set or uses an insecure default value';
    if (isProduction) {
      errors.push(`${msg} (required in production)`);
    } else {
      warnings.push(msg);
    }
    return;
  }

  if (isProduction && jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters in production');
  }
}
