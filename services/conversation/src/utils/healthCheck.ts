/**
 * Health Check Utilities
 * Checks the health of service dependencies
 */

import redisClient from '../config/database';
import axios from 'axios';
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
    aiService: {
      status: 'available' | 'unavailable';
      responseTime?: number;
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
 * Check AI Service availability
 */
export async function checkAIServiceHealth(): Promise<{
  status: 'available' | 'unavailable';
  responseTime?: number;
}> {
  const startTime = Date.now();
  try {
    const aiServiceUrl =
      process.env.AI_SERVICE_URL || process.env.AI_NLP_SERVICE_URL || 'http://localhost:3003';
    const response = await axios.get(`${aiServiceUrl}/health`, {
      timeout: 3000,
    });

    const responseTime = Date.now() - startTime;

    if (response.status === 200) {
      return {
        status: 'available',
        responseTime,
      };
    }

    return {
      status: 'unavailable',
    };
  } catch (error: unknown) {
    logger.error('AI Service health check failed:', error);
    return {
      status: 'unavailable',
    };
  }
}

/**
 * Get overall health status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const [redisHealth, aiServiceHealth] = await Promise.all([
    checkRedisHealth(),
    checkAIServiceHealth(),
  ]);

  const allHealthy = redisHealth.status === 'connected' && aiServiceHealth.status === 'available';
  const allDown = redisHealth.status === 'disconnected' && aiServiceHealth.status === 'unavailable';

  let status: 'ok' | 'degraded' | 'down';
  if (allHealthy) {
    status = 'ok';
  } else if (allDown) {
    status = 'down';
  } else {
    status = 'degraded';
  }

  return {
    service: 'conversation-service',
    status,
    timestamp: new Date().toISOString(),
    dependencies: {
      redis: redisHealth,
      aiService: aiServiceHealth,
    },
  };
}
