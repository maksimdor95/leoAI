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
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_users_email ON jack.users(email);
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
      RETURNING id, email, password_hash, first_name, last_name, created_at, updated_at
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
      SELECT id, email, password_hash, first_name, last_name, created_at, updated_at
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
      SELECT id, email, password_hash, first_name, last_name, created_at, updated_at
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
      RETURNING id, email, password_hash, first_name, last_name, created_at, updated_at
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
}
