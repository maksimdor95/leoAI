import * as https from 'https';
import { ProxyAgent, type Dispatcher } from 'undici';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { config } from '../config';
import { logger } from '../utils/logger';

let httpDispatcher: Dispatcher | undefined;
let socksLogged = false;

function redactProxyUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    if (parsed.username) parsed.username = '***';
    return parsed.toString();
  } catch {
    return '[proxy]';
  }
}

function isSocksUrl(url: string): boolean {
  return /^socks[45]?h?:\/\//i.test(url);
}

function makeSocksAgent(proxyUrl: string): SocksProxyAgent {
  if (!socksLogged) {
    logger.info(`Telegram API proxy (SOCKS): ${redactProxyUrl(proxyUrl)}`);
    socksLogged = true;
  }
  return new SocksProxyAgent(proxyUrl);
}

export function getTelegramDispatcher(): Dispatcher | undefined {
  const proxyUrl = config.proxyUrl();
  if (!proxyUrl || isSocksUrl(proxyUrl)) return undefined;

  if (!httpDispatcher) {
    httpDispatcher = new ProxyAgent(proxyUrl);
    logger.info(`Telegram API proxy (HTTP): ${redactProxyUrl(proxyUrl)}`);
  }

  return httpDispatcher;
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

/** Node fetch() ignores http.Agent; for SOCKS we fall back to https.request. */
function socksFetchOnce(input: string, init?: RequestInit): Promise<Response> {
  const proxyUrl = config.proxyUrl();
  if (!proxyUrl) return fetch(input, init);
  const agent = makeSocksAgent(proxyUrl);

  return new Promise<Response>((resolve, reject) => {
    const url = new URL(input);
    const body = init?.body ? String(init.body) : undefined;
    const req = https.request(
      url,
      {
        method: init?.method || 'GET',
        headers: init?.headers as Record<string, string> | undefined,
        agent,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve(
            new Response(buffer, {
              status: res.statusCode ?? 500,
              statusText: res.statusMessage ?? '',
              headers: res.headers as Record<string, string>,
            })
          );
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function socksFetch(input: string, init?: RequestInit): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await socksFetchOnce(input, init);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_RETRIES) {
        logger.warn(`SOCKS request failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS}ms…`);
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
  }
  throw lastError;
}

export async function telegramFetch(
  input: string,
  init?: RequestInit & { dispatcher?: Dispatcher }
): Promise<Response> {
  const proxyUrl = config.proxyUrl();

  if (proxyUrl && isSocksUrl(proxyUrl)) {
    return socksFetch(input, init);
  }

  const proxyDispatcher = getTelegramDispatcher();
  if (!proxyDispatcher) {
    return fetch(input, init);
  }

  return fetch(input, {
    ...init,
    dispatcher: proxyDispatcher,
  });
}
