/**
 * HTTP(S)/SOCKS proxy for t.me scrapes (TG + Getmatch).
 * Parity with Kabi `TG_HTTP_PROXY` — RU VMs often cannot reach t.me:443 directly.
 */

import { HttpsProxyAgent } from 'https-proxy-agent';
import { SocksProxyAgent } from 'socks-proxy-agent';
import type { Agent } from 'http';
import { logger } from '../../utils/logger';

let logged = false;

export function redactProxyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    if (parsed.username) parsed.username = '***';
    return parsed.toString();
  } catch {
    return '[proxy]';
  }
}

/** Prefer TG_HTTP_PROXY (Kabi parity); fall back to TELEGRAM_PROXY_URL / HTTPS_PROXY. */
export function resolveTgHttpProxyUrl(): string | null {
  const raw =
    process.env.TG_HTTP_PROXY?.trim() ||
    process.env.TELEGRAM_PROXY_URL?.trim() ||
    process.env.HTTPS_PROXY?.trim() ||
    process.env.HTTP_PROXY?.trim() ||
    '';
  return raw || null;
}

function isSocksUrl(url: string): boolean {
  return /^socks[45]?h?:\/\//i.test(url);
}

/** socks5 resolves DNS locally (often blocked); socks5h resolves via proxy. */
export function socksUrlWithRemoteDns(proxyUrl: string): string {
  return proxyUrl.replace(/^socks5:\/\//i, 'socks5h://');
}

export type TgAxiosProxyConfig = {
  httpAgent: Agent;
  httpsAgent: Agent;
  /** Disable axios env-proxy so we only use the explicit agent. */
  proxy: false;
};

/**
 * Axios agent config for TG/Getmatch fetches, or undefined if no proxy configured.
 */
export function getTgAxiosProxyConfig(): TgAxiosProxyConfig | undefined {
  const proxyUrl = resolveTgHttpProxyUrl();
  if (!proxyUrl) return undefined;

  let agent: Agent;
  if (isSocksUrl(proxyUrl)) {
    const agentUrl = socksUrlWithRemoteDns(proxyUrl);
    agent = new SocksProxyAgent(agentUrl) as unknown as Agent;
    if (!logged) {
      logger.info(`TG scrape proxy (SOCKS): ${redactProxyUrl(agentUrl)}`);
      logged = true;
    }
  } else {
    agent = new HttpsProxyAgent(proxyUrl) as unknown as Agent;
    if (!logged) {
      logger.info(`TG scrape proxy (HTTP): ${redactProxyUrl(proxyUrl)}`);
      logged = true;
    }
  }

  return { httpAgent: agent, httpsAgent: agent, proxy: false };
}

/** Test helper — reset one-shot log flag. */
export function resetTgProxyLogFlagForTests(): void {
  logged = false;
}
