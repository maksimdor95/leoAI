import pool from '../config/database';
import { logger } from '../utils/logger';

export type OAuthTokenProvider = 'hh';

export interface UserOAuthTokenRecord {
  id: string;
  user_id: string;
  provider: OAuthTokenProvider;
  access_token: string;
  refresh_token: string | null;
  expires_at: Date | null;
  provider_user_id: string | null;
  scopes: string[] | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpsertOAuthTokenInput {
  userId: string;
  provider: OAuthTokenProvider;
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
  providerUserId?: string | null;
  scopes?: string[] | null;
}

export class UserOAuthTokenRepository {
  static async createTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS jack.user_oauth_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES jack.users(id) ON DELETE CASCADE,
        provider VARCHAR(32) NOT NULL DEFAULT 'hh',
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TIMESTAMPTZ,
        provider_user_id VARCHAR(64),
        scopes TEXT[],
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, provider)
      );
      CREATE INDEX IF NOT EXISTS idx_user_oauth_tokens_user_provider
        ON jack.user_oauth_tokens(user_id, provider);
    `;

    try {
      await pool.query(query);
      logger.info('✅ user_oauth_tokens table checked/created');
    } catch (error: unknown) {
      logger.error('❌ Error creating user_oauth_tokens table:', error);
    }
  }

  static async findByUserAndProvider(
    userId: string,
    provider: OAuthTokenProvider
  ): Promise<UserOAuthTokenRecord | null> {
    const result = await pool.query<UserOAuthTokenRecord>(
      `SELECT id, user_id, provider, access_token, refresh_token, expires_at,
              provider_user_id, scopes, created_at, updated_at
       FROM jack.user_oauth_tokens
       WHERE user_id = $1 AND provider = $2`,
      [userId, provider]
    );
    return result.rows[0] ?? null;
  }

  static async upsert(input: UpsertOAuthTokenInput): Promise<UserOAuthTokenRecord> {
    const result = await pool.query<UserOAuthTokenRecord>(
      `INSERT INTO jack.user_oauth_tokens (
         user_id, provider, access_token, refresh_token, expires_at, provider_user_id, scopes, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (user_id, provider) DO UPDATE SET
         access_token = EXCLUDED.access_token,
         refresh_token = COALESCE(EXCLUDED.refresh_token, jack.user_oauth_tokens.refresh_token),
         expires_at = EXCLUDED.expires_at,
         provider_user_id = COALESCE(EXCLUDED.provider_user_id, jack.user_oauth_tokens.provider_user_id),
         scopes = COALESCE(EXCLUDED.scopes, jack.user_oauth_tokens.scopes),
         updated_at = NOW()
       RETURNING id, user_id, provider, access_token, refresh_token, expires_at,
                 provider_user_id, scopes, created_at, updated_at`,
      [
        input.userId,
        input.provider,
        input.accessToken,
        input.refreshToken ?? null,
        input.expiresAt ?? null,
        input.providerUserId ?? null,
        input.scopes ?? null,
      ]
    );
    return result.rows[0];
  }

  static async deleteByUserAndProvider(userId: string, provider: OAuthTokenProvider): Promise<boolean> {
    const result = await pool.query(
      `DELETE FROM jack.user_oauth_tokens WHERE user_id = $1 AND provider = $2`,
      [userId, provider]
    );
    return (result.rowCount ?? 0) > 0;
  }
}
