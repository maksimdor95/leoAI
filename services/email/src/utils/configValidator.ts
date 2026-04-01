/**
 * Configuration Validator for Email Notification Service
 * Validates required environment variables at startup
 */

import { logger } from './logger';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate required configuration for Email Notification Service
 */
export function validateConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Email service configuration (optional, but recommended)
  const sendGridApiKey = process.env.SENDGRID_API_KEY;

  if (!sendGridApiKey || sendGridApiKey === 'your_sendgrid_api_key_here') {
    warnings.push(
      'SENDGRID_API_KEY is not set - email sending will be disabled (emails will only be logged)'
    );
  }

  // Service URLs
  const userProfileServiceUrl = process.env.USER_PROFILE_SERVICE_URL;
  const jobMatchingServiceUrl = process.env.JOB_MATCHING_SERVICE_URL;

  if (!userProfileServiceUrl) {
    warnings.push('USER_PROFILE_SERVICE_URL is not set - using default http://localhost:3001');
  }

  if (!jobMatchingServiceUrl) {
    warnings.push('JOB_MATCHING_SERVICE_URL is not set - using default http://localhost:3004');
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

    const sendGridApiKey = process.env.SENDGRID_API_KEY;
    if (sendGridApiKey && sendGridApiKey !== 'your_sendgrid_api_key_here') {
      logger.info(`Email Service: SendGrid configured (${sendGridApiKey.substring(0, 8)}...)`);
    } else {
      logger.info('Email Service: SendGrid not configured - emails will be logged only');
    }
  }

  logger.info('');
}
