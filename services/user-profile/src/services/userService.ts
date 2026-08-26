/**
 * User Service
 * Business logic for user operations
 */

import fs from 'fs/promises';
import path from 'path';
import { UserRepository } from '../models/userRepository';
import { CreateUserData, UpdateUserData, toPublicUser } from '../models/User';
import { hashPassword, comparePassword } from '../utils/password';
import { generateToken } from '../utils/jwt';
import { assertImageMagicBytes } from '../utils/imageMagicBytes';
import { logger } from '../utils/logger';

export interface RegisterResult {
  user: ReturnType<typeof toPublicUser>;
  token: string;
}

export interface LoginResult {
  user: ReturnType<typeof toPublicUser>;
  token: string;
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

function avatarsDir(): string {
  return process.env.AVATAR_UPLOAD_DIR || path.join(process.cwd(), 'data', 'uploads', 'avatars');
}

export class UserService {
  /**
   * Register a new user
   */
  static async register(userData: CreateUserData): Promise<RegisterResult> {
    const existingUser = await UserRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    const password_hash = await hashPassword(userData.password);

    const user = await UserRepository.create({
      ...userData,
      password_hash,
    });

    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    return {
      user: toPublicUser(user),
      token,
    };
  }

  /**
   * Login user
   */
  static async login(email: string, password: string): Promise<LoginResult> {
    const user = await UserRepository.findByEmail(email);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
    });

    return {
      user: toPublicUser(user),
      token,
    };
  }

  /**
   * Get user by ID
   */
  static async getUserById(userId: string) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    return toPublicUser(user);
  }

  /**
   * Update user
   */
  static async updateUser(userId: string, userData: UpdateUserData) {
    const user = await UserRepository.update(userId, userData);
    return toPublicUser(user);
  }

  static async uploadAvatar(
    userId: string,
    file: { buffer: Buffer; originalname?: string }
  ): Promise<ReturnType<typeof toPublicUser>> {
    if (!file.buffer?.length) {
      throw new Error('Файл не передан');
    }
    if (file.buffer.length > MAX_AVATAR_BYTES) {
      throw new Error('Размер фото не должен превышать 2 МБ');
    }

    const ext = assertImageMagicBytes(file.buffer);
    const dir = avatarsDir();
    await fs.mkdir(dir, { recursive: true });

    const existing = await UserRepository.findById(userId);
    if (!existing) {
      throw new Error('User not found');
    }

    if (existing.avatar_path) {
      try {
        await fs.unlink(path.join(dir, existing.avatar_path));
      } catch {
        // old file may already be gone
      }
    }

    const filename = `${userId}.${ext}`;
    const fullPath = path.join(dir, filename);
    await fs.writeFile(fullPath, file.buffer);

    const user = await UserRepository.update(userId, { avatar_path: filename });
    return toPublicUser(user);
  }

  static async deleteAvatar(userId: string): Promise<ReturnType<typeof toPublicUser>> {
    const existing = await UserRepository.findById(userId);
    if (!existing) {
      throw new Error('User not found');
    }

    if (existing.avatar_path) {
      try {
        await fs.unlink(path.join(avatarsDir(), existing.avatar_path));
      } catch (err) {
        logger.warn('Failed to delete avatar file:', err);
      }
    }

    const user = await UserRepository.update(userId, { avatar_path: null });
    return toPublicUser(user);
  }

  static async resolveAvatarFile(
    userId: string
  ): Promise<{ absolutePath: string; contentType: string } | null> {
    const user = await UserRepository.findById(userId);
    if (!user?.avatar_path) return null;

    // Prevent path traversal — only allow `{uuid}.{ext}` under avatars dir
    const base = path.basename(user.avatar_path);
    if (base !== user.avatar_path || !base.startsWith(userId)) {
      return null;
    }

    const absolutePath = path.join(avatarsDir(), base);
    try {
      await fs.access(absolutePath);
    } catch {
      return null;
    }

    const ext = path.extname(base).toLowerCase();
    const contentType =
      ext === '.png'
        ? 'image/png'
        : ext === '.webp'
          ? 'image/webp'
          : ext === '.gif'
            ? 'image/gif'
            : 'image/jpeg';

    return { absolutePath, contentType };
  }
}
