/**
 * Test Database Connection
 * Simple script to test PostgreSQL connection
 */

import { testConnection } from './config/database';
import { logger } from './utils/logger';

async function main() {
  logger.info('Testing database connection...');

  const connected = await testConnection();

  if (connected) {
    logger.info('Database connection successful!');
    logger.info('Ready to create tables and start development.');
    process.exit(0);
  } else {
    logger.error('Database connection failed!');
    logger.info('Please check:');
    logger.info('1. Is PostgreSQL running? (docker-compose ps)');
    logger.info('2. Are DB credentials correct in .env file?');
    logger.info('3. Is DB_HOST=localhost in .env?');
    process.exit(1);
  }
}

main();
