/**
 * User Repository
 * Handles all database operations for users
 */

import pool from '../config/database';
import { User, CreateUserData, UpdateUserData } from './User';
import { logger } from '../utils/logger';

type PostgresError = {
  code?: string;
};

const isPostgresError = (error: unknown): error is PostgresError =>
  typeof error === 'object' && error !== null && 'code' in error;

export class UserRepository {
  /**
   * Create users table if it doesn't exist
   */
  static async createTable(): Promise<void> {
    const query = `
      -- Create schema if it doesn't exist
      CREATE SCHEMA IF NOT EXISTS jack;

      -- Create users table in jack schema (use gen_random_uuid which is built-in)
      CREATE TABLE IF NOT EXISTS jack.users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        google_id VARCHAR(255) UNIQUE,
        yandex_id VARCHAR(255) UNIQUE,
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      ALTER TABLE jack.users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255);
      ALTER TABLE jack.users ADD COLUMN IF NOT EXISTS yandex_id VARCHAR(255);
      CREATE INDEX IF NOT EXISTS idx_users_email ON jack.users(email);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id_unique
        ON jack.users(google_id) WHERE google_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_yandex_id_unique
        ON jack.users(yandex_id) WHERE yandex_id IS NOT NULL;
      GRANT ALL ON SCHEMA jack TO CURRENT_USER;
    `;

    try {
      await pool.query(query);
      logger.info('✅ Users table and schema checked/created successfully');
    } catch (error: unknown) {
      logger.error('❌ Error creating users table:', error);
      // Don't throw if it's just a permission issue with extension but table exists
    }
  }

  /**
   * Create a new user
   */
  static async create(userData: CreateUserData & { password_hash: string }): Promise<User> {
    const query = `
      INSERT INTO jack.users (email, password_hash, first_name, last_name)
      VALUES ($1, $2, $3, $4)
      RETURNING id, email, password_hash, google_id, yandex_id, first_name, last_name, created_at, updated_at
    `;

    const values = [
      userData.email,
      userData.password_hash,
      userData.first_name || null,
      userData.last_name || null,
    ];

    try {
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error: unknown) {
      if (isPostgresError(error) && error.code === '23505') {
        // Unique violation
        throw new Error('User with this email already exists');
      }
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<User | null> {
    const query = `
      SELECT id, email, password_hash, google_id, yandex_id, first_name, last_name, created_at, updated_at
      FROM jack.users
      WHERE email = $1
    `;

    try {
      const result = await pool.query(query, [email]);
      return result.rows[0] || null;
    } catch (error: unknown) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  static async findById(id: string): Promise<User | null> {
    const query = `
      SELECT id, email, password_hash, google_id, yandex_id, first_name, last_name, created_at, updated_at
      FROM jack.users
      WHERE id = $1
    `;

    try {
      const result = await pool.query(query, [id]);
      return result.rows[0] || null;
    } catch (error: unknown) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  /**
   * Update user
   */
  static async update(id: string, userData: UpdateUserData): Promise<User> {
    const fields: string[] = [];
    const values: (string | null)[] = [];
    let paramCount = 1;

    if (userData.email !== undefined) {
      fields.push(`email = $${paramCount++}`);
      values.push(userData.email);
    }
    if (userData.first_name !== undefined) {
      fields.push(`first_name = $${paramCount++}`);
      values.push(userData.first_name);
    }
    if (userData.last_name !== undefined) {
      fields.push(`last_name = $${paramCount++}`);
      values.push(userData.last_name);
    }

    if (fields.length === 0) {
      throw new Error('No fields to update');
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE jack.users
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
      RETURNING id, email, password_hash, google_id, yandex_id, first_name, last_name, created_at, updated_at
    `;

    try {
      const result = await pool.query(query, values);
      if (result.rows.length === 0) {
        throw new Error('User not found');
      }
      return result.rows[0];
    } catch (error: unknown) {
      logger.error('Error updating user:', error);
      throw error;
    }
  }

  static async findByGoogleId(googleId: string): Promise<User | null> {
    const query = `
      SELECT id, email, password_hash, google_id, yandex_id, first_name, last_name, created_at, updated_at
      FROM jack.users
      WHERE google_id = $1
    `;

    const result = await pool.query(query, [googleId]);
    return result.rows[0] || null;
  }

  static async findByYandexId(yandexId: string): Promise<User | null> {
    const query = `
      SELECT id, email, password_hash, google_id, yandex_id, first_name, last_name, created_at, updated_at
      FROM jack.users
      WHERE yandex_id = $1
    `;

    const result = await pool.query(query, [yandexId]);
    return result.rows[0] || null;
  }

  static async createOAuthUser(userData: {
    email: string;
    password_hash: string;
    first_name?: string;
    last_name?: string;
    google_id?: string;
    yandex_id?: string;
  }): Promise<User> {
    const query = `
      INSERT INTO jack.users (email, password_hash, first_name, last_name, google_id, yandex_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, password_hash, google_id, yandex_id, first_name, last_name, created_at, updated_at
    `;
    const values = [
      userData.email,
      userData.password_hash,
      userData.first_name || null,
      userData.last_name || null,
      userData.google_id || null,
      userData.yandex_id || null,
    ];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  static async setGoogleId(userId: string, googleId: string): Promise<void> {
    await pool.query('UPDATE jack.users SET google_id = $1, updated_at = NOW() WHERE id = $2', [
      googleId,
      userId,
    ]);
  }

  static async setYandexId(userId: string, yandexId: string): Promise<void> {
    await pool.query('UPDATE jack.users SET yandex_id = $1, updated_at = NOW() WHERE id = $2', [
      yandexId,
      userId,
    ]);
  }
}
