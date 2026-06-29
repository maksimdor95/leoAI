import axios from 'axios';
import jwt from 'jsonwebtoken';
import {
  UserOAuthTokenRepository,
  type UserOAuthTokenRecord,
} from '../models/userOAuthTokenRepository';
import { logger } from '../utils/logger';

const HH_API_URL = process.env.HH_API_URL || 'https://api.hh.ru';
const HH_AUTHORIZE_URL = process.env.HH_OAUTH_AUTHORIZE_URL || 'https://hh.ru/oauth/authorize';
const HH_TOKEN_URL = process.env.HH_OAUTH_TOKEN_URL || `${HH_API_URL}/token`;
const HH_USER_AGENT =
  process.env.HH_USER_AGENT || 'leoAI-user-profile/1.0 (support@leoai.local)';
const HH_OAUTH_STATE_EXPIRATION = '15m';
const JWT_ALGORITHM: jwt.Algorithm = 'HS256';
const TOKEN_REFRESH_SKEW_MS = 60_000;

export interface HhIntegrationStatus {
  connected: boolean;
  hhUserId?: string;
  expiresAt?: string;
  scopes?: string[];
  resumesCount?: number;
  expired?: boolean;
}

type HhOAuthStatePayload = {
  kind: 'hh_integration';
  userId: string;
  returnTo?: string;
};

interface HhTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'your_jwt_secret_key_here_change_in_production';
}

function getHhOAuthClientId(): string {
  return (
    process.env.HH_OAUTH_CLIENT_ID?.trim() ||
    process.env.HH_CLIENT_ID?.trim() ||
    ''
  );
}

function getHhOAuthClientSecret(): string {
  return (
    process.env.HH_OAUTH_CLIENT_SECRET?.trim() ||
    process.env.HH_CLIENT_SECRET?.trim() ||
    ''
  );
}

function getHhOAuthRedirectUri(): string {
  return resolveHhOAuthRedirectUri();
}

/** Callback URL для HH OAuth (должен совпадать с redirect URI в dev.hh.ru). */
export function resolveHhOAuthRedirectUri(): string {
  const callbackBaseUrl = process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3001';
  const defaultUri = `${callbackBaseUrl.replace(/\/+$/, '')}/api/users/oauth/hh/callback`;
  const raw = process.env.HH_OAUTH_REDIRECT_URI?.trim() || defaultUri;
  return raw.replace(/\/+$/, '');
}

function getHhOAuthScopes(): string | undefined {
  const scopes = process.env.HH_OAUTH_SCOPES?.trim();
  return scopes || undefined;
}

function buildHhApiHeaders(accessToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${accessToken}`,
    'User-Agent': HH_USER_AGENT,
    'HH-User-Agent': HH_USER_AGENT,
  };
}

function getFrontendIntegrationCallbackUrl(kind: 'success' | 'error', params: Record<string, string>): string {
  const base =
    kind === 'success'
      ? process.env.FRONTEND_HH_INTEGRATION_SUCCESS_URL ||
        process.env.FRONTEND_OAUTH_SUCCESS_URL ||
        'http://localhost:3000/oauth/callback'
      : process.env.FRONTEND_HH_INTEGRATION_ERROR_URL ||
        process.env.FRONTEND_OAUTH_ERROR_URL ||
        'http://localhost:3000/oauth/callback';

  const url = new URL(base);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export function isHhIntegrationConfigured(): boolean {
  return Boolean(getHhOAuthClientId() && getHhOAuthClientSecret());
}

export class HhIntegrationService {
  static buildStateToken(userId: string, returnTo?: string): string {
    const payload: HhOAuthStatePayload = {
      kind: 'hh_integration',
      userId,
      returnTo,
    };
    return jwt.sign(payload, getJwtSecret(), {
      algorithm: JWT_ALGORITHM,
      expiresIn: HH_OAUTH_STATE_EXPIRATION,
    });
  }

  static parseStateToken(state: string): HhOAuthStatePayload {
    const decoded = jwt.verify(state, getJwtSecret(), {
      algorithms: [JWT_ALGORITHM],
    }) as HhOAuthStatePayload;
    if (decoded.kind !== 'hh_integration' || !decoded.userId) {
      throw new Error('Invalid HH OAuth state');
    }
    return decoded;
  }

  static isIntegrationCallbackState(state: unknown): boolean {
    if (typeof state !== 'string' || !state.trim()) {
      return false;
    }
    try {
      this.parseStateToken(state);
      return true;
    } catch {
      return false;
    }
  }

  static getAuthorizationUrl(userId: string, returnTo?: string): string {
    const clientId = getHhOAuthClientId();
    if (!clientId) {
      throw new Error('HH OAuth is not configured');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: getHhOAuthRedirectUri(),
      state: this.buildStateToken(userId, returnTo),
    });

    const scopes = getHhOAuthScopes();
    if (scopes) {
      params.set('scope', scopes);
    }

    return `${HH_AUTHORIZE_URL}?${params.toString()}`;
  }

  static getFailureRedirect(reason: string): string {
    return getFrontendIntegrationCallbackUrl('error', {
      provider: 'hh',
      kind: 'integration',
      error: reason,
    });
  }

  static getSuccessRedirect(returnTo?: string): string {
    const params: Record<string, string> = {
      provider: 'hh',
      kind: 'integration',
      success: '1',
    };
    if (returnTo) {
      params.returnTo = returnTo;
    }
    return getFrontendIntegrationCallbackUrl('success', params);
  }

  private static normalizeTokenResponse(data: unknown): HhTokenResponse {
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
      token_type: typeof parsed.token_type === 'string' ? parsed.token_type : undefined,
    };
  }

  private static async requestToken(payload: URLSearchParams): Promise<HhTokenResponse> {
    const response = await axios.post(HH_TOKEN_URL, payload.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': HH_USER_AGENT,
      },
      timeout: 12000,
    });
    return this.normalizeTokenResponse(response.data);
  }

  static async exchangeAuthorizationCode(code: string, userId: string): Promise<UserOAuthTokenRecord> {
    const clientId = getHhOAuthClientId();
    const clientSecret = getHhOAuthClientSecret();
    if (!clientId || !clientSecret) {
      throw new Error('HH OAuth is not configured');
    }

    const payload = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: getHhOAuthRedirectUri(),
    });

    const tokenResponse = await this.requestToken(payload);
    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : null;

    let providerUserId: string | null = null;
    try {
      const meResponse = await axios.get(`${HH_API_URL}/me`, {
        headers: buildHhApiHeaders(tokenResponse.access_token),
        timeout: 10000,
      });
      const me = meResponse.data as { id?: string };
      providerUserId = me.id ? String(me.id) : null;
    } catch (error: unknown) {
      logger.warn('Failed to fetch HH /me after OAuth:', error);
    }

    return UserOAuthTokenRepository.upsert({
      userId,
      provider: 'hh',
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? null,
      expiresAt,
      providerUserId,
      scopes: getHhOAuthScopes()?.split(/\s+/).filter(Boolean) ?? null,
    });
  }

  private static tokenNeedsRefresh(record: UserOAuthTokenRecord): boolean {
    if (!record.expires_at) {
      return false;
    }
    return record.expires_at.getTime() <= Date.now() + TOKEN_REFRESH_SKEW_MS;
  }

  static async refreshAccessToken(record: UserOAuthTokenRecord): Promise<UserOAuthTokenRecord> {
    const clientId = getHhOAuthClientId();
    const clientSecret = getHhOAuthClientSecret();
    if (!clientId || !clientSecret) {
      throw new Error('HH OAuth is not configured');
    }
    if (!record.refresh_token) {
      throw new Error('HH refresh token is missing');
    }

    const payload = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: record.refresh_token,
    });

    const tokenResponse = await this.requestToken(payload);
    const expiresAt = tokenResponse.expires_in
      ? new Date(Date.now() + tokenResponse.expires_in * 1000)
      : record.expires_at;

    return UserOAuthTokenRepository.upsert({
      userId: record.user_id,
      provider: 'hh',
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token ?? record.refresh_token,
      expiresAt,
      providerUserId: record.provider_user_id,
      scopes: record.scopes,
    });
  }

  static async getValidAccessToken(userId: string): Promise<string | null> {
    const record = await UserOAuthTokenRepository.findByUserAndProvider(userId, 'hh');
    if (!record) {
      return null;
    }

    if (!this.tokenNeedsRefresh(record)) {
      return record.access_token;
    }

    try {
      const refreshed = await this.refreshAccessToken(record);
      return refreshed.access_token;
    } catch (error: unknown) {
      logger.warn(`HH token refresh failed for user=${userId}:`, error);
      return null;
    }
  }

  private static async fetchResumesCount(accessToken: string): Promise<number | undefined> {
    try {
      const response = await axios.get(`${HH_API_URL}/resumes/mine`, {
        headers: buildHhApiHeaders(accessToken),
        timeout: 10000,
      });
      const items = (response.data as { items?: unknown[] })?.items;
      return Array.isArray(items) ? items.length : undefined;
    } catch (error: unknown) {
      logger.warn('Failed to fetch HH resumes count:', error);
      return undefined;
    }
  }

  static async getIntegrationStatus(
    userId: string,
    options: { lite?: boolean } = {}
  ): Promise<HhIntegrationStatus> {
    const record = await UserOAuthTokenRepository.findByUserAndProvider(userId, 'hh');
    if (!record) {
      return { connected: false };
    }

    const accessToken = await this.getValidAccessToken(userId);
    if (!accessToken) {
      return {
        connected: false,
        expired: true,
        hhUserId: record.provider_user_id ?? undefined,
        expiresAt: record.expires_at?.toISOString(),
        scopes: record.scopes ?? undefined,
      };
    }

    const refreshedRecord =
      (await UserOAuthTokenRepository.findByUserAndProvider(userId, 'hh')) ?? record;
    const resumesCount = options.lite
      ? undefined
      : await this.fetchResumesCount(accessToken);

    return {
      connected: true,
      hhUserId: refreshedRecord.provider_user_id ?? undefined,
      expiresAt: refreshedRecord.expires_at?.toISOString(),
      scopes: refreshedRecord.scopes ?? undefined,
      resumesCount,
      expired: false,
    };
  }

  static async revokeIntegration(userId: string): Promise<boolean> {
    return UserOAuthTokenRepository.deleteByUserAndProvider(userId, 'hh');
  }
}
