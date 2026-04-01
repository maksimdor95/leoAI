/**
 * Configuration Validator for Conversation Service
 * Validates required environment variables at startup
 */

import { logger } from './logger';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate required configuration for Conversation Service
 */
export function validateConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Redis configuration
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;

  if (!redisHost || !redisPort) {
    errors.push('REDIS_HOST and REDIS_PORT are required but not set');
  }

  // Service URLs
  const aiServiceUrl = process.env.AI_SERVICE_URL || process.env.AI_NLP_SERVICE_URL;
  const userProfileServiceUrl = process.env.USER_PROFILE_SERVICE_URL;
  const jobMatchingServiceUrl = process.env.JOB_MATCHING_SERVICE_URL;
  const emailServiceUrl = process.env.EMAIL_SERVICE_URL;

  if (!aiServiceUrl) {
    warnings.push('AI_SERVICE_URL is not set - using default http://localhost:3003');
  }

  if (!userProfileServiceUrl) {
    warnings.push('USER_PROFILE_SERVICE_URL is not set - using default http://localhost:3001');
  }

  if (!jobMatchingServiceUrl) {
    warnings.push('JOB_MATCHING_SERVICE_URL is not set - using default http://localhost:3004');
  }

  if (!emailServiceUrl) {
    warnings.push('EMAIL_SERVICE_URL is not set - using default http://localhost:3005');
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
    logger.info(`Redis: ${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`);
    logger.info(`REDIS_SSL: ${process.env.REDIS_SSL}`);
    logger.info(`REDIS_PASSWORD is set: ${!!process.env.REDIS_PASSWORD}`);
    logger.info(
      `AI Service: ${process.env.AI_SERVICE_URL || process.env.AI_NLP_SERVICE_URL || 'http://localhost:3003'}`
    );
  }

  logger.info('');
}
