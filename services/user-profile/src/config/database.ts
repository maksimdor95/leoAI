/**
 * Database Configuration
 * Connection to PostgreSQL database
 */

import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

const dbConfig: PoolConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'jack_ai',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 60000, // Return an error after 60 seconds if connection could not be established
};

// Create connection pool
const pool = new Pool(dbConfig);

// Test connection
pool.on('connect', () => {
  logger.info('Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  logger.error('Database connection error:', err);
});

// Helper function to test connection
export const testConnection = async (): Promise<boolean> => {
  try {
    const result = await pool.query('SELECT NOW()');
    logger.info('Database connection test successful:', result.rows[0]);
    return true;
  } catch (error: unknown) {
    logger.error('Database connection test failed:', error);
    return false;
  }
};

export default pool;
