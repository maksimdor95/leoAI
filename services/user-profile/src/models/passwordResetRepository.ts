/**
 * Password reset tokens — одноразовые, с ограниченным сроком действия.
 */

import pool from '../config/database';
import { logger } from '../utils/logger';

export interface PasswordResetTokenRow {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  used_at: Date | null;
  created_at: Date;
}

export class PasswordResetRepository {
  static async createTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS jack.password_reset_tokens (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES jack.users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id
        ON jack.password_reset_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token_hash
        ON jack.password_reset_tokens(token_hash);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_expires_at
        ON jack.password_reset_tokens(expires_at);
    `;

    try {
      await pool.query(query);
      logger.info('✅ Password reset tokens table checked/created successfully');
    } catch (error: unknown) {
      logger.error('❌ Error creating password reset tokens table:', error);
    }
  }

  static async invalidateForUser(userId: string): Promise<void> {
    await pool.query(
      `UPDATE jack.password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    );
  }

  static async create(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.invalidateForUser(userId);
    await pool.query(
      `INSERT INTO jack.password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [userId, tokenHash, expiresAt]
    );
  }

  static async findValidByTokenHash(tokenHash: string): Promise<PasswordResetTokenRow | null> {
    const result = await pool.query<PasswordResetTokenRow>(
      `SELECT id, user_id, token_hash, expires_at, used_at, created_at
       FROM jack.password_reset_tokens
       WHERE token_hash = $1
         AND used_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [tokenHash]
    );
    return result.rows[0] ?? null;
  }

  static async markUsed(id: string): Promise<void> {
    await pool.query(
      `UPDATE jack.password_reset_tokens SET used_at = NOW() WHERE id = $1`,
      [id]
    );
  }
}
