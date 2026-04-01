/**
 * Configuration Validator for AI/NLP Service
 * Validates required environment variables at startup
 */

import { logger } from './logger';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate required configuration for AI/NLP Service
 */
export function validateConfig(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required variables
  const ycFolderId = process.env.YC_FOLDER_ID;
  const ycApiKey = process.env.YC_API_KEY;

  // In production, YandexGPT is required. In development, it's a warning
  const isProduction = process.env.NODE_ENV === 'production';

  if (!ycFolderId) {
    if (isProduction) {
      errors.push('YC_FOLDER_ID is required but not set');
    } else {
      warnings.push('YC_FOLDER_ID is not set - AI features will use fallbacks');
    }
  }

  if (!ycApiKey) {
    if (isProduction) {
      errors.push('YC_API_KEY is required but not set');
    } else {
      warnings.push('YC_API_KEY is not set - AI features will use fallbacks');
    }
  }

  // Optional but recommended
  const redisHost = process.env.REDIS_HOST;
  const redisPort = process.env.REDIS_PORT;

  if (!redisHost || !redisPort) {
    warnings.push('Redis configuration may be incomplete (REDIS_HOST or REDIS_PORT not set)');
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

    // Log configuration status
    const ycFolderId = process.env.YC_FOLDER_ID;
    const ycApiKey = process.env.YC_API_KEY;
    const ycModelId = process.env.YC_MODEL_ID || 'foundation-models/yandexgpt-lite';

    logger.info('YandexGPT Configuration:');
    logger.info(`   Model: ${ycModelId}`);
    if (ycFolderId) {
      logger.info(`   Folder ID: ${ycFolderId.substring(0, 8)}...`);
    }
    if (ycApiKey) {
      logger.info(`   API Key: ${ycApiKey.substring(0, 8)}...`);
    }

    logger.info('Redis Configuration:');
    logger.info(`   Host: ${process.env.REDIS_HOST}`);
    logger.info(`   Port: ${process.env.REDIS_PORT}`);
    logger.info(`   SSL: ${process.env.REDIS_SSL}`);
    logger.info(`   Password is set: ${!!process.env.REDIS_PASSWORD}`);
  }

  logger.info('');
}
