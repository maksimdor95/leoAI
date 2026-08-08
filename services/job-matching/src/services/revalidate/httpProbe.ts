/**
 * Shared HTTP classification for GET-based vacancy probes.
 * Fail-open: archive only on explicit 404/410.
 * Redirects that leave the vacancy path → error (not gone).
 */

import type { Agent as HttpAgent } from 'http';
import type { Agent as HttpsAgent } from 'https';
import axios, { isAxiosError } from 'axios';
import type { VacancyProbeResult } from './types';

export type ProbeHttpOptions = {
  timeoutMs?: number;
  headers?: Record<string, string>;
  /** Final host must be one of these (lowercase, no port). */
  allowedHosts?: string[];
  /** Final pathname must match; otherwise error (redirected to listing/login). */
  requirePathMatch?: RegExp;
  httpsAgent?: HttpsAgent | HttpAgent;
};

function hostnameOf(raw: string): string | null {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function pathnameOf(raw: string): string {
  try {
    return new URL(raw).pathname;
  } catch {
    return '';
  }
}

function finalResponseUrl(
  requested: string,
  response: { request?: { res?: { responseUrl?: string }; responseURL?: string }; config?: { url?: string } }
): string {
  const fromNode = response.request?.res?.responseUrl;
  const fromBrowser = response.request?.responseURL;
  const fromConfig = response.config?.url;
  return fromNode || fromBrowser || fromConfig || requested;
}

export async function probeHttpUrl(
  url: string,
  options?: ProbeHttpOptions
): Promise<VacancyProbeResult> {
  const requestedHost = hostnameOf(url);
  if (!requestedHost) {
    return { status: 'skip', message: 'invalid url' };
  }
  if (options?.allowedHosts?.length) {
    const allowed = new Set(options.allowedHosts.map((h) => h.toLowerCase()));
    if (!allowed.has(requestedHost)) {
      return { status: 'skip', message: `host not allowed: ${requestedHost}` };
    }
  }

  try {
    const response = await axios.get(url, {
      timeout: options?.timeoutMs ?? 10000,
      headers: options?.headers,
      httpsAgent: options?.httpsAgent,
      validateStatus: (s) => s < 500,
      maxRedirects: 5,
      responseType: 'text',
    });

    const finalUrl = finalResponseUrl(url, response);
    const finalHost = hostnameOf(finalUrl) || requestedHost;

    if (options?.allowedHosts?.length) {
      const allowed = new Set(options.allowedHosts.map((h) => h.toLowerCase()));
      if (!allowed.has(finalHost)) {
        return {
          status: 'error',
          message: `redirected off-host to ${finalHost}`,
        };
      }
    }

    if (options?.requirePathMatch) {
      const path = pathnameOf(finalUrl);
      if (!options.requirePathMatch.test(path)) {
        // Listing/login redirect while still 2xx — never treat as gone.
        return {
          status: 'error',
          message: `redirected away from vacancy path (${path || '/'})`,
        };
      }
    }

    if (response.status === 404 || response.status === 410) {
      return { status: 'gone', reason: 'not_found' };
    }
    if (response.status >= 200 && response.status < 400) {
      return { status: 'live' };
    }
    // 401/403/429 and other 4xx (except 404/410) → fail-open error
    return { status: 'error', message: `HTTP ${response.status}` };
  } catch (error: unknown) {
    if (isAxiosError(error)) {
      const code = error.response?.status;
      if (code === 404 || code === 410) {
        return { status: 'gone', reason: 'not_found' };
      }
      return {
        status: 'error',
        message: error.message || `axios ${code ?? 'network'}`,
      };
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
