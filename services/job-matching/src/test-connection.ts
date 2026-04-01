/**
 * Test Database Connection
 * Simple script to test PostgreSQL connection
 */

import { testConnection } from './config/database';
import { logger } from './utils/logger';

async function test() {
  logger.info('Testing database connection...');
  const connected = await testConnection();
  if (connected) {
    logger.info('✅ Database connection successful!');
    process.exit(0);
  } else {
    logger.error('❌ Database connection failed!');
    process.exit(1);
  }
}

test();
