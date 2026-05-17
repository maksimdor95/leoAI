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

function isLocalLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

const corsExplicitOrigins = new Set(
  (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
);

function corsOriginChecker(
  origin: string | undefined,
  callback: (...args: [Error | null, boolean?]) => void
): void {
  if (!origin) {
    callback(null, true);
    return;
  }
  if (corsExplicitOrigins.has(origin)) {
    callback(null, true);
    return;
  }
  if (origin === 'http://localhost:3000' || origin === 'http://127.0.0.1:3000') {
    callback(null, true);
    return;
  }
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv !== 'production' && isLocalLoopbackOrigin(origin)) {
    callback(null, true);
    return;
  }
  callback(null, false);
}

// Middleware
app.use(helmet());
app.use(cors({
  origin: corsOriginChecker,
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 100 }));

// Health check
app.get('/health', healthCheck);

// API info
app.get('/', (_req, res) => {
  res.json({
    service: 'report-service',
    version: '0.1.0',
    endpoints: [
      'GET /api/report/preview/:sessionId',
      'POST /api/report/preview-compute',
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
