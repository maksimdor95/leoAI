/**
 * Health Check Utilities
 * Checks the health of service dependencies
 */

import axios from 'axios';
import { logger } from './logger';

export interface HealthStatus {
  service: string;
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  dependencies: {
    sendgrid: {
      configured: boolean;
    };
    userProfileService: {
      status: 'available' | 'unavailable';
      responseTime?: number;
    };
    jobMatchingService: {
      status: 'available' | 'unavailable';
      responseTime?: number;
    };
  };
}

/**
 * Check external service availability
 */
async function checkServiceHealth(
  url: string,
  serviceName: string
): Promise<{
  status: 'available' | 'unavailable';
  responseTime?: number;
}> {
  const startTime = Date.now();
  try {
    const response = await axios.get(`${url}/health`, {
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
    logger.error(`${serviceName} health check failed:`, error);
    return {
      status: 'unavailable',
    };
  }
}

/**
 * Get overall health status
 */
export async function getHealthStatus(): Promise<HealthStatus> {
  const userProfileUrl = process.env.USER_PROFILE_SERVICE_URL || 'http://localhost:3001';
  const jobMatchingUrl = process.env.JOB_MATCHING_SERVICE_URL || 'http://localhost:3004';

  const [userProfileHealth, jobMatchingHealth] = await Promise.all([
    checkServiceHealth(userProfileUrl, 'User Profile Service'),
    checkServiceHealth(jobMatchingUrl, 'Job Matching Service'),
  ]);

  const sendGridConfigured = !!(
    process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'your_sendgrid_api_key_here'
  );

  const allHealthy =
    userProfileHealth.status === 'available' && jobMatchingHealth.status === 'available';

  const status: 'ok' | 'degraded' | 'down' = allHealthy ? 'ok' : 'degraded';

  return {
    service: 'email-notification-service',
    status,
    timestamp: new Date().toISOString(),
    dependencies: {
      sendgrid: {
        configured: sendGridConfigured,
      },
      userProfileService: userProfileHealth,
      jobMatchingService: jobMatchingHealth,
    },
  };
}
