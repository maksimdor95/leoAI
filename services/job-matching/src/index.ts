/**
 * Job Matching Service
 * Main entry point for the service
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import jobRoutes from './routes/jobRoutes';
import pool from './config/database';
import { logger } from './utils/logger';
import { testConnection } from './config/database';
import { scheduleRegularScraping, closeQueue } from './services/scrapingQueue';
import { validateAndLogConfig } from './utils/configValidator';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { getHealthStatus } from './utils/healthCheck';

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

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
  callback: (err: Error | null, allow?: boolean) => void
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
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'"],
        scriptSrcAttr: ["'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  })
);
app.use(
  cors({
    origin: corsOriginChecker,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, _res, next) => {
  logger.info(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'Job Matching Service API',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      catalog: 'GET /api/jobs/catalog?source=superjob.ru&limit=50&offset=0',
      match: 'GET /api/jobs/match/:userId',
      jobDetails: 'GET /api/jobs/:jobId',
      refresh: 'POST /api/jobs/refresh',
      hhSalary: 'GET /api/jobs/hh/salary-evaluation/:areaId',
    },
  });
});

// Health check endpoint
app.get('/health', async (_req, res) => {
  const health = await getHealthStatus();
  const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.use('/api/jobs', jobRoutes);

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function start() {
  try {
    // Validate configuration before starting
    validateAndLogConfig('Job Matching Service');

    // Test database connection
    await testConnection();

    // Initialize database tables
    try {
      logger.info('Initializing database tables...');
      const createTableQuery = `
        CREATE TABLE IF NOT EXISTS jobs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(500) NOT NULL,
          company VARCHAR(255) NOT NULL,
          location JSONB NOT NULL DEFAULT '[]'::jsonb,
          salary_min INTEGER,
          salary_max INTEGER,
          currency VARCHAR(10),
          description TEXT NOT NULL,
          requirements TEXT NOT NULL,
          skills JSONB NOT NULL DEFAULT '[]'::jsonb,
          experience_level VARCHAR(20),
          work_mode VARCHAR(20),
          source VARCHAR(50) NOT NULL,
          source_url TEXT NOT NULL UNIQUE,
          posted_at TIMESTAMP,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_jobs_source_url ON jobs(source_url);
        CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
      `;
      await pool.query(createTableQuery);
      logger.info('✅ Jobs table verified');
    } catch (err) {
      logger.error('Database init warning:', err);
    }

    // Schedule regular scraping
    await scheduleRegularScraping();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Job Matching Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('Scheduled hourly job scraping');
    });
  } catch (error: unknown) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await closeQueue();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await closeQueue();
  process.exit(0);
});

start();

export default app;
