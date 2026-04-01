import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { healthCheck } from './utils/healthCheck';
import { errorHandler } from './middleware/errorHandler';
import { reportRoutes } from './routes/reportRoutes';
import { getRedisClient, closeRedisConnection } from './config/redis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3007;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());

// Health check
app.get('/health', healthCheck);

// API info
app.get('/', (_req, res) => {
  res.json({
    service: 'report-service',
    version: '0.1.0',
    endpoints: [
      'POST /api/report/generate',
      'GET /api/report/:reportId/status',
      'GET /api/report/:reportId/download',
    ],
  });
});

// Routes
app.use('/api/report', reportRoutes);

// Error handler
app.use(errorHandler);

// Initialize Redis and start server
async function start() {
  try {
    // Connect to Redis
    const redis = getRedisClient();
    await redis.connect();
    
    app.listen(PORT, () => {
      logger.info(`Report Service started on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start Report Service', { error: (error as Error).message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down...');
  await closeRedisConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down...');
  await closeRedisConnection();
  process.exit(0);
});

start();
