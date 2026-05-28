import { logger } from '../utils/logger';

interface NgrokTunnel {
  public_url?: string;
  proto?: string;
  config?: { addr?: string };
}

interface NgrokTunnelsResponse {
  tunnels?: NgrokTunnel[];
}

/** Read public HTTPS URL from local ngrok agent API (default :4040). */
export async function resolveNgrokWebhookUrl(
  localPort: number,
  ngrokApiBase = process.env.TELEGRAM_NGROK_API_URL?.trim() || 'http://127.0.0.1:4040'
): Promise<string | undefined> {
  const apiUrl = `${ngrokApiBase.replace(/\/$/, '')}/api/tunnels`;

  let response: Response;
  try {
    response = await fetch(apiUrl, { signal: AbortSignal.timeout(5000) });
  } catch (error) {
    logger.warn(`ngrok API not reachable at ${apiUrl}`, error);
    return undefined;
  }

  if (!response.ok) {
    logger.warn(`ngrok API ${apiUrl} returned ${response.status}`);
    return undefined;
  }

  const data = (await response.json()) as NgrokTunnelsResponse;
  const tunnels = data.tunnels || [];
  const portSuffix = `:${localPort}`;

  const httpsTunnel = tunnels.find(
    (t) =>
      t.proto === 'https' &&
      (t.config?.addr?.includes(portSuffix) || t.config?.addr?.includes(String(localPort)))
  );

  const publicUrl = httpsTunnel?.public_url?.replace(/\/$/, '');
  if (!publicUrl) {
    logger.warn(
      `No ngrok HTTPS tunnel found for port ${localPort}. Run: ngrok http ${localPort}`
    );
    return undefined;
  }

  return `${publicUrl}/telegram/webhook`;
}
