/**
 * Password reset — запрос ссылки и установка нового пароля.
 */

import { createHash, randomBytes } from 'crypto';
import axios from 'axios';
import { UserRepository } from '../models/userRepository';
import { PasswordResetRepository } from '../models/passwordResetRepository';
import { hashPassword } from '../utils/password';
import { logger } from '../utils/logger';

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL || 'http://localhost:3005';

function hashResetToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function resolveFrontendBaseUrl(): string {
  const raw =
    process.env.FRONTEND_URL ||
    process.env.BASE_URL ||
    process.env.CORS_ORIGIN?.split(',')[0]?.trim() ||
    'http://localhost:3000';
  return raw.replace(/\/+$/, '');
}

function buildResetUrl(token: string): string {
  return `${resolveFrontendBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}

async function sendResetEmail(params: {
  email: string;
  resetUrl: string;
  userName?: string;
}): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const internalKey = process.env.INTERNAL_API_KEY?.trim();
  if (internalKey) {
    headers['X-Internal-Key'] = internalKey;
  }

  await axios.post(
    `${EMAIL_SERVICE_URL}/api/email/send-password-reset`,
    {
      to: params.email,
      resetUrl: params.resetUrl,
      userName: params.userName,
    },
    { headers, timeout: 15_000 }
  );
}

export class PasswordResetService {
  /**
   * Всегда возвращает успех с одинаковым сообщением (не раскрываем наличие email).
   */
  static async requestReset(email: string): Promise<void> {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      logger.info(`Password reset requested for unknown email: ${email}`);
      return;
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = hashResetToken(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

    await PasswordResetRepository.create(user.id, tokenHash, expiresAt);

    const resetUrl = buildResetUrl(token);
    const userName = user.first_name?.trim() || undefined;

    try {
      await sendResetEmail({
        email: user.email,
        resetUrl,
        userName,
      });
      logger.info(`Password reset email queued for user ${user.id}`);
    } catch (error: unknown) {
      logger.error('Failed to send password reset email:', error);
      throw new Error('Failed to send reset email');
    }
  }

  static async validateToken(token: string): Promise<boolean> {
    if (!token.trim()) return false;
    const row = await PasswordResetRepository.findValidByTokenHash(hashResetToken(token));
    return Boolean(row);
  }

  static async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashResetToken(token);
    const row = await PasswordResetRepository.findValidByTokenHash(tokenHash);
    if (!row) {
      throw new Error('Invalid or expired reset token');
    }

    const passwordHash = await hashPassword(newPassword);
    await UserRepository.updatePassword(row.user_id, passwordHash);
    await PasswordResetRepository.markUsed(row.id);
    await PasswordResetRepository.invalidateForUser(row.user_id);
  }
}
