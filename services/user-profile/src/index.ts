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

const corsAllowedOrigins = new Set<string>([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
]);
if (process.env.CORS_ORIGIN) {
  for (const part of process.env.CORS_ORIGIN.split(',').map((s) => s.trim())) {
    if (part) corsAllowedOrigins.add(part);
  }
}

function isLocalLoopbackOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

// CORS before helmet so OPTIONS gets headers. In dev, allow any loopback port (e.g. Next on 3002 if 3000 is busy).
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || corsAllowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      const nodeEnv = process.env.NODE_ENV || 'development';
      if (nodeEnv !== 'production' && isLocalLoopbackOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(null, false);
    },
    credentials: true,
  })
);

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
    message: 'User Profile Service API',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      register: 'POST /api/users/register',
      registerAlt: 'POST /api/users (onboarding registration)',
      login: 'POST /api/users/login',
      profile: 'GET /api/users/profile',
      updateProfile: 'PUT /api/users/profile',
      careerTracks: 'GET /api/career/tracks',
      careerTrackCreate: 'POST /api/career/tracks',
      careerTrackUpdate: 'PATCH /api/career/tracks/:trackId',
      careerTrackSetDefault: 'POST /api/career/tracks/:trackId/set-default',
      careerProfile: 'POST /api/career/profile',
      careerProfileGet: 'GET /api/career-profile/:userId',
      resume: 'POST /api/resume',
      resumesUpload: 'POST /api/career/resumes/upload (multipart file)',
      resumesList: 'GET /api/career/resumes',
      resumeById: 'GET /api/career/resumes/:resumeId',
      resumeDelete: 'DELETE /api/career/resumes/:resumeId',
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

// Test HTML after API routes so GET / stays JSON
app.use(express.static(path.join(__dirname, '../public')));

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
