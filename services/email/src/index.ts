/**
 * Email Notification Service
 * Main entry point for the service
 */

import dotenv from 'dotenv';
dotenv.config();

import { initSentry } from './utils/sentry';
initSentry('email');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import emailRoutes from './routes/emailRoutes';
import { logger } from './utils/logger';
import { validateAndLogConfig } from './utils/configValidator';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { getHealthStatus } from './utils/healthCheck';

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
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 100 }));

// Request logging middleware
app.use((req, _res, next) => {
  logger.info(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'Email Notification Service API',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      sendJobs: 'POST /api/email/send-jobs',
      sendWelcome: 'POST /api/email/send-welcome',
      sendConsultation: 'POST /api/email/send-consultation',
    },
  });
});

// Health check endpoint
app.get('/health', async (_req, res) => {
  const health = await getHealthStatus();
  const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.use('/api/email', emailRoutes);

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function start() {
  // Validate configuration before starting
  validateAndLogConfig('Email Notification Service');

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Email Notification Service running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

start();

export default app;
