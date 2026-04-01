/**
 * Health Check Utilities
 * Checks the health of service dependencies
 */

import redisClient from '../config/redis';
import { logger } from './logger';

export interface HealthStatus {
  service: string;
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  dependencies: {
    redis: {
      status: 'connected' | 'disconnected';
      responseTime?: number;
    };
    yandexgpt: {
      configured: boolean;
      folderId?: string;
    };
  };
}

/**
 * Check Redis connection health
 */
export async function checkRedisHealth(): Promise<{
  status: 'connected' | 'disconnected';
  responseTime?: number;
}> {
  const startTime = Date.now();
  try {
    if (redisClient.isOpen) {
      await redisClient.ping();
      const responseTime = Date.now() - startTime;
      return {
        status: 'connected',
        responseTime,
      };
    }
    return {
      status: 'disconnected',
    };
  } catch (error: unknown) {
    logger.error('Redis health check failed:', error);
    return {
      status: 'disconnected',
    };
  }
}

/**
 * Check YandexGPT configuration
 */
export function checkYandexGPTConfig(): {
  configured: boolean;
  folderId?: string;
} {
  const folderId = process.env.YC_FOLDER_ID;
  const apiKey = process.env.YC_API_KEY;

  return {
    configured: !!(folderId && apiKey),
    folderId: folderId ? `${folderId.substring(0, 8)}...` : undefined,
  };
}

/**
 * Get overall health status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const redisHealth = await checkRedisHealth();
  const yandexConfig = checkYandexGPTConfig();

  const status: 'ok' | 'degraded' | 'down' =
    redisHealth.status === 'connected' ? (yandexConfig.configured ? 'ok' : 'degraded') : 'down';

  return {
    service: 'ai-nlp-service',
    status,
    timestamp: new Date().toISOString(),
    dependencies: {
      redis: redisHealth,
      yandexgpt: yandexConfig,
    },
  };
}
