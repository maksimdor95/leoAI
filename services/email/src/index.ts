/**
 * Email Notification Service
 * Main entry point for the service
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import emailRoutes from './routes/emailRoutes';
import { logger } from './utils/logger';
import { validateAndLogConfig } from './utils/configValidator';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { getHealthStatus } from './utils/healthCheck';

// Load environment variables from local .env and allow overriding inherited shell vars.
dotenv.config({ override: true });

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

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
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
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
    message: 'Email Notification Service API',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      sendJobs: 'POST /api/email/send-jobs',
      sendWelcome: 'POST /api/email/send-welcome',
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
