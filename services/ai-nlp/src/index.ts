/**
 * AI/NLP Service entry point
 */

import dotenv from 'dotenv';
dotenv.config();

import { initSentry } from './utils/sentry';
initSentry('ai-nlp');

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectRedis } from './config/redis';
import { processMessage } from './controllers/aiController';
import { generateStepMessage, freeChat, generateProfileSummary, generateResume } from './controllers/generationController';
import { validateAnswer } from './controllers/validationController';
import { analyzeProfile } from './controllers/profileController';
import { extractProfileFromResume } from './controllers/resumeExtractController';
import { synthesizeTts } from './controllers/ttsController';
import { checkContext } from './controllers/contextController';
import { retrieveContext } from './controllers/retrieveContextController';
import {
  extractVacancyProfile,
  generateMockSummary,
  generatePrepPlan,
  gradeInterviewAnswer,
  respondToInterviewMode,
} from './controllers/interviewPrepController';
import { enrichJob } from './controllers/enrichJobController';
import { generateApplicationDraft } from './controllers/applicationDraftController';
import { generateEmbedding } from './controllers/embeddingController';
import { generateAiReadiness } from './controllers/aiReadinessController';
import { logger } from './utils/logger';
import { validateAndLogConfig } from './utils/configValidator';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { requireAuth } from './middleware/auth';
import { aiRateLimit } from './middleware/rateLimit';
import { getHealthStatus } from './utils/healthCheck';

const app = express();
const PORT = Number(process.env.PORT || 3003);

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

app.use(helmet());
app.use(
  cors({
    origin: corsOriginChecker,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 100 }));
app.use('/api/ai', requireAuth, aiRateLimit);

app.use((req, _res, next) => {
  logger.info(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

app.get('/health', async (_req, res) => {
  const health = await getHealthStatus();
  const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Internal service-to-service routes (conversation -> ai-nlp).
app.post('/api/ai/process-message', processMessage);
app.post('/api/ai/generate-step', generateStepMessage);
app.post('/api/ai/validate-answer', validateAnswer);
app.post('/api/ai/analyze-profile', analyzeProfile);
app.post('/api/ai/extract-profile-from-resume', extractProfileFromResume);
app.post('/api/ai/check-context', checkContext);
app.post('/api/ai/retrieve-context', retrieveContext);
app.post('/api/ai/free-chat', freeChat);
app.post('/api/ai/tts', synthesizeTts);
app.post('/api/ai/interview/extract-vacancy-profile', extractVacancyProfile);
app.post('/api/ai/interview/generate-prep-plan', generatePrepPlan);
app.post('/api/ai/interview/respond', respondToInterviewMode);
app.post('/api/ai/interview/grade-answer', gradeInterviewAnswer);
app.post('/api/ai/interview/generate-mock-summary', generateMockSummary);
// Новые эндпоинты для генерации профиля и резюме
app.post('/api/ai/generate-summary', generateProfileSummary);
app.post('/api/ai/generate-resume', generateResume);
app.post('/api/ai/enrich-job', enrichJob);
app.post('/api/ai/application-draft', generateApplicationDraft);
app.post('/api/ai/embedding', generateEmbedding);
app.post('/api/ai/readiness', generateAiReadiness);

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

async function start() {
  try {
    // Validate configuration before starting
    validateAndLogConfig('AI/NLP Service');

    // Connect to Redis in background or with timeout
    connectRedis().catch((err) => {
      logger.error('Initial Redis connection failed (will retry):', err.message);
    });

    app.listen(PORT, '0.0.0.0', () => {
      logger.info(`AI/NLP Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info('');
      logger.info('=== API Endpoints ===');
      logger.info('Endpoint: POST /api/ai/process-message');
      logger.info('Endpoint: POST /api/ai/generate-step');
      logger.info('Endpoint: POST /api/ai/validate-answer');
      logger.info('Endpoint: POST /api/ai/analyze-profile');
      logger.info('Endpoint: POST /api/ai/check-context');
      logger.info('Endpoint: POST /api/ai/free-chat');
      logger.info('Endpoint: POST /api/ai/tts');
      logger.info('Endpoint: POST /api/ai/interview/*');
      logger.info('Endpoint: POST /api/ai/generate-summary (NEW)');
      logger.info('Endpoint: POST /api/ai/generate-resume (NEW)');
    });
  } catch (error: unknown) {
    logger.error('Failed to start AI/NLP service:', error);
    process.exit(1);
  }
}

start();
