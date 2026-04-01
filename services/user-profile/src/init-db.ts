/**
 * Initialize Database
 * Creates tables and sets up the database
 */

import { UserRepository } from './models/userRepository';
import { testConnection } from './config/database';
import { logger } from './utils/logger';

async function initDatabase() {
  logger.info('Initializing database...');

  try {
    // Test connection first
    const connected = await testConnection();
    if (!connected) {
      throw new Error('Database connection failed');
    }

    // Create users table
    await UserRepository.createTable();

    logger.info('Database initialized successfully!');
    logger.info('Ready to start the service.');
    process.exit(0);
  } catch (error: unknown) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  }
}

initDatabase();
