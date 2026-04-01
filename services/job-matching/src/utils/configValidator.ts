/**
 * Configuration Validator for Job Matching Service
 * Validates required environment variables at startup
 */

import { logger } from './logger';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate required configuration for Job Matching Service
 */
export function validateConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required variables
  const dbHost = process.env.DB_HOST;
  const dbPort = process.env.DB_PORT;
  const dbName = process.env.DB_NAME;
  const dbUser = process.env.DB_USER;
  const dbPassword = process.env.DB_PASSWORD;

  if (!dbHost) {
    errors.push('DB_HOST is required but not set');
  }

  if (!dbPort) {
    errors.push('DB_PORT is required but not set');
  }

  if (!dbName) {
    errors.push('DB_NAME is required but not set');
  }

  if (!dbUser) {
    errors.push('DB_USER is required but not set');
  }

  if (!dbPassword || dbPassword === 'your_password_here') {
    errors.push('DB_PASSWORD is required but not set or using default value');
  }

  // Redis configuration
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;

  if (!redisHost || !redisPort) {
    warnings.push('Redis configuration may be incomplete (REDIS_HOST or REDIS_PORT not set)');
  }

  // Job scraping configuration warnings
  const hhApiKey = process.env.HH_API_KEY;
  const useMockJobs = process.env.USE_MOCK_JOBS === 'true';

  if (!hhApiKey && !useMockJobs) {
    warnings.push(
      'HH_API_KEY is not set and USE_MOCK_JOBS is false - job scraping may use mock data'
    );
  }

  if (useMockJobs) {
    warnings.push('USE_MOCK_JOBS is enabled - using mock job data instead of real scraping');
  }

  // Check if using default JWT secret (security warning)
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret === 'your_jwt_secret_key_here_change_in_production' || !jwtSecret) {
    warnings.push(
      'JWT_SECRET is not set or using default value - this is insecure for production!'
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate and log configuration, exit if critical errors
 */
export function validateAndLogConfig(serviceName: string): void {
  const result = validateConfig();

  logger.info(`=== ${serviceName} Configuration Validation ===`);

  if (result.errors.length > 0) {
    logger.error('❌ Configuration errors found:');
    result.errors.forEach((error) => {
      logger.error(`   ❌ ${error}`);
    });
    logger.error('');
    logger.error('Please set the required environment variables and restart the service.');
    logger.error('See env.example for reference.');
    process.exit(1);
  }

  if (result.warnings.length > 0) {
    logger.warn('⚠️  Configuration warnings:');
    result.warnings.forEach((warning) => {
      logger.warn(`   ⚠️  ${warning}`);
    });
    logger.warn('');
  }

  if (result.valid) {
    logger.info('✅ Configuration is valid');
    logger.info(`Database: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`);
    logger.info(`Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);

    const useMockJobs = process.env.USE_MOCK_JOBS === 'true';
    const hhApiKey = process.env.HH_API_KEY;
    logger.info(
      `Job Scraping: ${hhApiKey ? 'HH.ru API configured' : 'No API key'}, Mock jobs: ${useMockJobs ? 'enabled' : 'disabled'}`
    );
  }

  logger.info('');
}
