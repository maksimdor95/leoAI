/**
 * Health Check Utilities
 * Checks the health of service dependencies
 */

import pool from '../config/database';
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
    await pool.query('SELECT 1');
    const responseTime = Date.now() - startTime;
    return {
      status: 'connected',
      responseTime,
    };
  } catch (error: unknown) {
    logger.error('Database health check failed:', error);
    return {
      status: 'disconnected',
    };
  }
}

/**
 * Get overall health status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const databaseHealth = await checkDatabaseHealth();

  const allHealthy = databaseHealth.status === 'connected';
  const allDown = databaseHealth.status === 'disconnected';

  let status: 'ok' | 'degraded' | 'down';
  if (allHealthy) {
    status = 'ok';
  } else if (allDown) {
    status = 'down';
  } else {
    status = 'degraded';
  }

  return {
    service: 'user-profile-service',
    status,
    timestamp: new Date().toISOString(),
    dependencies: {
      database: databaseHealth,
    },
  };
}
