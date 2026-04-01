/**
 * User Profile Service
 * Main entry point for the service
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import userRoutes from './routes/userRoutes';
import careerRoutes from './routes/careerRoutes';
import { UserRepository } from './models/userRepository';
import { CareerService } from './services/careerService';
import { logger } from './utils/logger';
import { validateAndLogConfig } from './utils/configValidator';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { getHealthStatus } from './utils/healthCheck';

// Load environment variables
dotenv.config();

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
  if (req.body && Object.keys(req.body).length > 0) {
    logger.info('Request body:', JSON.stringify(req.body, null, 2));
  }
  // #region agent log
  if (req.path.includes('/api/users/register')) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fs = require('fs');
    const logPath = 'c:\\Users\\Marina\\Desktop\\AIheroes\\.cursor\\debug.log';
    const logEntry =
      JSON.stringify({
        location: 'index.ts:52',
        message: 'Backend: Incoming register request - middleware',
        data: {
          method: req.method,
          path: req.path,
          headers: {
            'content-type': req.headers['content-type'],
            'content-length': req.headers['content-length'],
            origin: req.headers.origin,
            'user-agent': req.headers['user-agent'],
          },
          bodyType: typeof req.body,
          bodyKeys: req.body ? Object.keys(req.body) : [],
          bodyStringified: req.body ? JSON.stringify(req.body) : null,
          rawBody: req.body,
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'B,C',
      }) + '\n';
    try {
      fs.appendFileSync(logPath, logEntry, 'utf8');
    } catch (e) {
      // Ignore file write errors in production
    }
  }
  // #endregion
  next();
});

// Serve static files (test page)
app.use(express.static(path.join(__dirname, '../public')));

// Root endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'User Profile Service API',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      register: 'POST /api/users/register',
      registerAlt: 'POST /api/users (onboarding registration)',
      login: 'POST /api/users/login',
      profile: 'GET /api/users/profile',
      updateProfile: 'PUT /api/users/profile',
      careerProfile: 'POST /api/career/profile',
      careerProfileGet: 'GET /api/career-profile/:userId',
      resume: 'POST /api/resume',
      aiReadiness: 'GET /api/career/ai-readiness',
      aiReadinessMock: 'POST /api/ai-readiness/mock',
    },
    testPage: '/index.html',
  });
});

// Health check endpoint
app.get('/health', async (_req, res) => {
  const health = await getHealthStatus();
  const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

app.use('/api/users', userRoutes);
app.use('/api/career', careerRoutes);
app.use('/api', careerRoutes);

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Start server
async function start() {
  // Validate configuration before starting
  validateAndLogConfig('User Profile Service');

  // Auto-initialize database tables
  try {
    logger.info('Initializing database schema and tables...');
    await UserRepository.createTable();
    await CareerService.createTables();
  } catch (err) {
    logger.error('Database initialization warning:', err);
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`User Profile Service running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    logger.info(`Test page: http://localhost:${PORT}/index.html`);
  });
}

start();

export default app;
