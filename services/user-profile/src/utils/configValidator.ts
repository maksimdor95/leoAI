/**
 * Configuration Validator for User Profile Service
 * Validates required environment variables at startup
 */

import { logger } from './logger';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate required configuration for User Profile Service
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
    logger.info(`DB_USER: ${process.env.DB_USER}`);
    logger.info(`DB_SSL: ${process.env.DB_SSL}`);
    logger.info(`JWT_SECRET is set: ${!!process.env.JWT_SECRET}`);
    logger.info(`DB_PASSWORD is set: ${!!process.env.DB_PASSWORD}`);
  }

  logger.info('');
}
