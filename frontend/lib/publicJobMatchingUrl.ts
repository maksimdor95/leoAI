/**
 * Base URL for job-matching HTTP calls from the browser.
 * On production, the public API host (gateway) serves /api/jobs/* — do not use localhost:3004 in the client.
 */
export function getPublicJobMatchingBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_JOB_MATCHING_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, '');
  }

  const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/$/, '');

  if (apiUrl.includes(':3001')) {
    return apiUrl.replace(':3001', ':3004');
  }

  if (apiUrl.startsWith('http://') || apiUrl.startsWith('https://')) {
    return apiUrl;
  }

  return 'http://127.0.0.1:3004';
}
