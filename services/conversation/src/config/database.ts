/**
 * Redis configuration for session storage
 */

import { createClient } from 'redis';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;
const CONNECTION_RETRY_DELAY = 5000; // 5 seconds

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tls: process.env.REDIS_SSL === 'true' ? ({ rejectUnauthorized: false } as any) : undefined,
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        logger.error('Redis: Max reconnection attempts reached. Please check if Redis is running.');
        return new Error('Redis connection failed after max retries');
      }
      const delay = Math.min(retries * 1000, 5000);
      logger.warn(`Redis: Reconnecting in ${delay}ms (attempt ${retries})...`);
      return delay;
    },
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

let lastErrorTime = 0;
const ERROR_LOG_THROTTLE = 10000; // Log errors at most once per 10 seconds

redisClient.on('error', (err) => {
  const now = Date.now();
  // Throttle error logging to avoid spam
  if (now - lastErrorTime > ERROR_LOG_THROTTLE) {
    logger.error('Redis Client Error:', err.message || err);
    logger.warn('Redis: Make sure Redis is running. Start it with: docker-compose up -d redis');
    lastErrorTime = now;
  }
});

redisClient.on('connect', () => {
  logger.info('Redis Client Connected');
  connectionAttempts = 0;
  lastErrorTime = 0;
});

redisClient.on('ready', () => {
  logger.info('Redis Client Ready');
});

redisClient.on('reconnecting', () => {
  logger.warn('Redis Client Reconnecting...');
});

// Connect to Redis with retry logic
export async function connectRedis() {
  try {
    if (!redisClient.isOpen) {
      connectionAttempts += 1;

      if (connectionAttempts > MAX_CONNECTION_ATTEMPTS) {
        logger.error(
          `Redis: Failed to connect after ${MAX_CONNECTION_ATTEMPTS} attempts. ` +
            `Please start Redis with: docker-compose up -d redis`
        );
        throw new Error('Redis connection failed after max attempts');
      }

      logger.info(
        `Redis: Connecting to Redis (attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS})...`
      );

      try {
        await redisClient.connect();
        logger.info('Redis: Connected successfully');
      } catch (connectError: unknown) {
        const errorMessage =
          connectError instanceof Error ? connectError.message : String(connectError);

        if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
          logger.warn(
            `Redis: Connection failed (${errorMessage}). ` +
              `Retrying in ${CONNECTION_RETRY_DELAY / 1000} seconds...`
          );

          await new Promise((resolve) => setTimeout(resolve, CONNECTION_RETRY_DELAY));

          // Retry connection
          return connectRedis();
        } else {
          throw connectError;
        }
      }
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Redis: Failed to connect to Redis:', errorMessage);
    logger.error(
      'Redis: Please start Redis with: docker-compose up -d redis\n' +
        'Or ensure Docker Desktop is running and Redis container is started.'
    );
    throw error;
  }
}

export default redisClient;
