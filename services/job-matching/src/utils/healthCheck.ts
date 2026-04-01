/**
 * Health Check Utilities
 * Checks the health of service dependencies
 */

import { testConnection } from '../config/database';
import redis from '../config/redis';
import { logger } from './logger';

export interface HealthStatus {
  service: string;
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  dependencies: {
    database: {
      status: 'connected' | 'disconnected';
      responseTime?: number;
    };
    redis: {
      status: 'connected' | 'disconnected';
      responseTime?: number;
    };
    scraping: {
      mockJobsEnabled: boolean;
      hhApiConfigured: boolean;
    };
  };
}

/**
 * Check database connection health
 */
export async function checkDatabaseHealth(): Promise<{
  status: 'connected' | 'disconnected';
  responseTime?: number;
}> {
  const startTime = Date.now();
  try {
    const connected = await testConnection();
    const responseTime = Date.now() - startTime;
    return {
      status: connected ? 'connected' : 'disconnected',
      responseTime: connected ? responseTime : undefined,
    };
  } catch (error: unknown) {
    logger.error('Database health check failed:', error);
    return {
      status: 'disconnected',
    };
  }
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
    await redis.ping();
    const responseTime = Date.now() - startTime;
    return {
      status: 'connected',
      responseTime,
    };
  } catch (error: unknown) {
    logger.error('Redis health check failed:', error);
    return {
      status: 'disconnected',
    };
  }
}

/**
 * Get overall health status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const [databaseHealth, redisHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkRedisHealth(),
  ]);

  const allHealthy = databaseHealth.status === 'connected' && redisHealth.status === 'connected';
  const allDown = databaseHealth.status === 'disconnected' && redisHealth.status === 'disconnected';

  let status: 'ok' | 'degraded' | 'down';
  if (allHealthy) {
    status = 'ok';
  } else if (allDown) {
    status = 'down';
  } else {
    status = 'degraded';
  }

  const mockJobsEnabled = process.env.USE_MOCK_JOBS === 'true';
  const hhApiConfigured = !!process.env.HH_API_KEY;

  return {
    service: 'job-matching-service',
    status,
    timestamp: new Date().toISOString(),
    dependencies: {
      database: databaseHealth,
      redis: redisHealth,
      scraping: {
        mockJobsEnabled,
        hhApiConfigured,
      },
    },
  };
}
