import axios from 'axios';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { UserRepository } from '../models/userRepository';
import { hashPassword } from '../utils/password';
import { generateToken } from '../utils/jwt';

export type OAuthProvider = 'google' | 'yandex';

type OAuthStatePayload = {
  provider: OAuthProvider;
};

type OAuthProfile = {
  providerUserId: string;
  email: string;
  firstName?: string;
  lastName?: string;
};

const OAUTH_STATE_EXPIRATION = '10m';
const JWT_ALGORITHM: jwt.Algorithm = 'HS256';

function getJwtSecret(): string {
  return process.env.JWT_SECRET || 'your_jwt_secret_key_here_change_in_production';
}

function buildStateToken(provider: OAuthProvider): string {
  return jwt.sign({ provider }, getJwtSecret(), {
    algorithm: JWT_ALGORITHM,
    expiresIn: OAUTH_STATE_EXPIRATION,
  });
}

function validateStateToken(state: string, provider: OAuthProvider): void {
  const decoded = jwt.verify(state, getJwtSecret(), {
    algorithms: [JWT_ALGORITHM],
  }) as OAuthStatePayload;
  if (decoded.provider !== provider) {
    throw new Error('OAuth state provider mismatch');
  }
}

function getFrontendCallbackUrl(kind: 'success' | 'error'): string {
  if (kind === 'success') {
    return process.env.FRONTEND_OAUTH_SUCCESS_URL || 'http://localhost:3000/oauth/callback';
  }
  return process.env.FRONTEND_OAUTH_ERROR_URL || 'http://localhost:3000/oauth/callback';
}

export class OAuthService {
  static getAuthorizationUrl(provider: OAuthProvider): string {
    const callbackBaseUrl = process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3001';
    const callbackUrl = `${callbackBaseUrl}/api/users/oauth/${provider}/callback`;
    const state = buildStateToken(provider);

    if (provider === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        throw new Error('GOOGLE_CLIENT_ID is not set');
      }
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        access_type: 'online',
        prompt: 'select_account',
      });
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    const clientId = process.env.YANDEX_CLIENT_ID;
    if (!clientId) {
      throw new Error('YANDEX_CLIENT_ID is not set');
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      state,
      force_confirm: 'true',
    });
    return `https://oauth.yandex.ru/authorize?${params.toString()}`;
  }

  static getFailureRedirect(provider: OAuthProvider, reason: string): string {
    const url = new URL(getFrontendCallbackUrl('error'));
    url.searchParams.set('provider', provider);
    url.searchParams.set('error', reason);
    return url.toString();
  }

  static async exchangeCodeAndLogin(provider: OAuthProvider, code: string, state: string): Promise<string> {
    validateStateToken(state, provider);
    const profile = await this.fetchProfile(provider, code);
    const user = await this.findOrCreateUser(provider, profile);

    return generateToken({
      userId: user.id,
      email: user.email,
    });
  }

  static getSuccessRedirect(provider: OAuthProvider, token: string): string {
    const url = new URL(getFrontendCallbackUrl('success'));
    url.searchParams.set('provider', provider);
    url.searchParams.set('success', '1');
    url.searchParams.set('token', token);
    return url.toString();
  }

  private static async fetchProfile(provider: OAuthProvider, code: string): Promise<OAuthProfile> {
    if (provider === 'google') {
      return this.fetchGoogleProfile(code);
    }
    return this.fetchYandexProfile(code);
  }

  private static async fetchGoogleProfile(code: string): Promise<OAuthProfile> {
    const callbackBaseUrl = process.env.OAUTH_CALLBACK_BASE_URL || 'http://localhost:3001';
    const callbackUrl = `${callbackBaseUrl}/api/users/oauth/google/callback`;
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials are not configured');
    }

    const tokenResponse = await axios.post(
      'https://oauth2.googleapis.com/token',
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: callbackUrl,
        grant_type: 'authorization_code',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenResponse.data.access_token as string | undefined;
    if (!accessToken) {
      throw new Error('Google access token not received');
    }

    const userInfoResponse = await axios.get('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const userInfo = userInfoResponse.data as {
      sub?: string;
      email?: string;
      given_name?: string;
      family_name?: string;
    };

    if (!userInfo.sub || !userInfo.email) {
      throw new Error('Google profile did not return required fields');
    }

    return {
      providerUserId: userInfo.sub,
      email: userInfo.email.toLowerCase(),
      firstName: userInfo.given_name,
      lastName: userInfo.family_name,
    };
  }

  private static async fetchYandexProfile(code: string): Promise<OAuthProfile> {
    const clientId = process.env.YANDEX_CLIENT_ID;
    const clientSecret = process.env.YANDEX_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('Yandex OAuth credentials are not configured');
    }

    const tokenResponse = await axios.post(
      'https://oauth.yandex.ru/token',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: clientId,
        client_secret: clientSecret,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const accessToken = tokenResponse.data.access_token as string | undefined;
    if (!accessToken) {
      throw new Error('Yandex access token not received');
    }

    const userInfoResponse = await axios.get('https://login.yandex.ru/info?format=json', {
      headers: { Authorization: `OAuth ${accessToken}` },
    });

    const userInfo = userInfoResponse.data as {
      id?: string;
      default_email?: string;
      first_name?: string;
      last_name?: string;
    };

    if (!userInfo.id || !userInfo.default_email) {
      throw new Error('Yandex profile did not return required fields');
    }

    return {
      providerUserId: userInfo.id,
      email: userInfo.default_email.toLowerCase(),
      firstName: userInfo.first_name,
      lastName: userInfo.last_name,
    };
  }

  private static async findOrCreateUser(provider: OAuthProvider, profile: OAuthProfile) {
    const providerUser =
      provider === 'google'
        ? await UserRepository.findByGoogleId(profile.providerUserId)
        : await UserRepository.findByYandexId(profile.providerUserId);
    if (providerUser) {
      return providerUser;
    }

    const existingByEmail = await UserRepository.findByEmail(profile.email);
    if (existingByEmail) {
      if (provider === 'google') {
        if (existingByEmail.google_id && existingByEmail.google_id !== profile.providerUserId) {
          throw new Error('Google account already linked to another profile');
        }
        await UserRepository.setGoogleId(existingByEmail.id, profile.providerUserId);
      } else {
        if (existingByEmail.yandex_id && existingByEmail.yandex_id !== profile.providerUserId) {
          throw new Error('Yandex account already linked to another profile');
        }
        await UserRepository.setYandexId(existingByEmail.id, profile.providerUserId);
      }
      return (await UserRepository.findById(existingByEmail.id)) || existingByEmail;
    }

    const randomPassword = randomUUID();
    const passwordHash = await hashPassword(randomPassword);

    return UserRepository.createOAuthUser({
      email: profile.email,
      password_hash: passwordHash,
      first_name: profile.firstName,
      last_name: profile.lastName,
      google_id: provider === 'google' ? profile.providerUserId : undefined,
      yandex_id: provider === 'yandex' ? profile.providerUserId : undefined,
    });
  }
}
