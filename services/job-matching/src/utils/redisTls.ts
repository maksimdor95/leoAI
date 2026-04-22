/**
 * When REDIS_SSL=true, verify TLS by default. Set REDIS_TLS_ALLOW_INSECURE=true
 * only for local dev (e.g. self-signed). Staging/prod: omit or set to false.
 */
export function ioredisTlsOptions():
  | { rejectUnauthorized: boolean }
  | undefined {
  if (process.env.REDIS_SSL !== 'true') return undefined;
  const allowInsecure = process.env.REDIS_TLS_ALLOW_INSECURE === 'true';
  return { rejectUnauthorized: !allowInsecure };
}
