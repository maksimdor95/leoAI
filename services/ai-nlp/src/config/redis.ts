/**
 * Redis configuration for storing conversation context and extracted facts
 */

import { createClient } from 'redis';
import dotenv from 'dotenv';
import { logger } from '../utils/logger';

dotenv.config();

const allowInsecureRedisTls = process.env.REDIS_TLS_ALLOW_INSECURE === 'true';

const redisClient = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tls:
      process.env.REDIS_SSL === 'true'
        ? ({ rejectUnauthorized: !allowInsecureRedisTls } as any)
        : undefined,
    connectTimeout: 10000, // 10 seconds timeout
  },
  password: process.env.REDIS_PASSWORD || undefined,
});

redisClient.on('error', (err) => {
  logger.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  logger.info('Redis connected (AI/NLP service)');
});

export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect();
  }
}

export default redisClient;
