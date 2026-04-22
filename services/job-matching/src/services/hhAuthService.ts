import axios from 'axios';

const HH_API_URL = process.env.HH_API_URL || 'https://api.hh.ru';
const HH_TOKEN_URL = process.env.HH_TOKEN_URL || `${HH_API_URL}/token`;
const HH_USER_AGENT =
  process.env.HH_USER_AGENT || 'leoAI-job-matching/1.0 (support@leoai.local)';

let cachedAccessToken: string | null = null;
let cachedAccessTokenExpiresAt = 0;
let cachedRefreshToken = process.env.HH_REFRESH_TOKEN || '';

interface HHAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}

function normalizeTokenResponse(data: unknown): HHAuthTokenResponse {
  if (!data || typeof data !== 'object') {
    throw new Error('HH token response is invalid');
  }

  const parsed = data as Record<string, unknown>;
  const accessToken = typeof parsed.access_token === 'string' ? parsed.access_token : '';
  if (!accessToken) {
    throw new Error('HH token response does not contain access_token');
  }

  return {
    access_token: accessToken,
    refresh_token: typeof parsed.refresh_token === 'string' ? parsed.refresh_token : undefined,
    expires_in: typeof parsed.expires_in === 'number' ? parsed.expires_in : undefined,
  };
}

async function requestOAuthToken(payload: URLSearchParams): Promise<HHAuthTokenResponse> {
  const response = await axios.post(HH_TOKEN_URL, payload.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': HH_USER_AGENT,
    },
    timeout: 12000,
  });

  return normalizeTokenResponse(response.data);
}

export function hasHHAuthConfig(): boolean {
  return Boolean(
    process.env.HH_ACCESS_TOKEN ||
      process.env.HH_API_KEY ||
      (process.env.HH_CLIENT_ID && process.env.HH_CLIENT_SECRET)
  );
}

export function getHHUserAgent(): string {
  return HH_USER_AGENT;
}

export async function getHHAccessToken(): Promise<string | null> {
  const directToken = process.env.HH_ACCESS_TOKEN?.trim();
  if (directToken) {
    return directToken;
  }

  const hhApiKey = process.env.HH_API_KEY?.trim();
  if (hhApiKey) {
    return hhApiKey;
  }

  const now = Date.now();
  if (cachedAccessToken && cachedAccessTokenExpiresAt > now + 60_000) {
    return cachedAccessToken;
  }

  const clientId = process.env.HH_CLIENT_ID?.trim() || '';
  const clientSecret = process.env.HH_CLIENT_SECRET?.trim() || '';
  if (!clientId || !clientSecret) {
    return null;
  }

  const requestPayload = new URLSearchParams();
  requestPayload.set('client_id', clientId);
  requestPayload.set('client_secret', clientSecret);

  if (cachedRefreshToken) {
    requestPayload.set('grant_type', 'refresh_token');
    requestPayload.set('refresh_token', cachedRefreshToken);
  } else {
    requestPayload.set('grant_type', 'client_credentials');
  }

  const tokenResponse = await requestOAuthToken(requestPayload);
  cachedAccessToken = tokenResponse.access_token;
  cachedRefreshToken = tokenResponse.refresh_token || cachedRefreshToken;
  cachedAccessTokenExpiresAt = Date.now() + (tokenResponse.expires_in || 3600) * 1000;

  return tokenResponse.access_token;
}
