/**
 * Redis Configuration
 * Connection to Redis for queues and caching
 */

import Redis from 'ioredis';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { ioredisTlsOptions } from '../utils/redisTls';

dotenv.config();

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  // Only add username if it's explicitly provided and not 'default'
  ...(process.env.REDIS_USER && process.env.REDIS_USER !== 'default'
    ? { username: process.env.REDIS_USER }
    : {}),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tls: ioredisTlsOptions() as any,
  retryStrategy: (times: number) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
};

// Create Redis connection
const redis = new Redis(redisConfig);

redis.on('connect', () => {
  logger.info('Connected to Redis');
});

redis.on('error', (err) => {
  logger.error('Redis connection error:', err);
});

export default redis;
