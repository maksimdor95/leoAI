/**
 * Conversation Service
 * WebSocket server for real-time chat with AI
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import path from 'path';
import { connectRedis } from './config/database';
import { verifyToken } from './services/authService';
import {
  createSession,
  getSession,
  getUserSession,
  getUserSessions,
  addMessageToSession,
  updateSessionMetadata,
  updateSession,
  deleteSession,
} from './services/sessionService';
import { ConversationSession } from './types/session';
import { Message, MessageType, MessageRole } from './types/message';
import { SocketAuth } from './types/socket';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './utils/logger';
import {
  handleUserReply,
  prepareEntryStep,
  handleCommand,
  applyImportedCollectedData,
} from './services/dialogueEngine';
import {
  generateFreeChatResponse,
  generateResumeFromCollectedData,
  synthesizeAssistantAudio,
} from './services/aiClient';
import { generateResumeDocxBuffer, generateResumePdfBuffer } from './services/resumeExport';
import { handleConversationCompletion } from './services/integrationService';
import { validateAndLogConfig } from './utils/configValidator';
import { getHealthStatus } from './utils/healthCheck';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = parseInt(process.env.PORT || '8080', 10);

const publicDir = path.resolve(__dirname, '..', 'public');

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

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: corsOriginChecker,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
        connectSrc: [
          "'self'",
          ...(process.env.CORS_ORIGIN
            ? process.env.CORS_ORIGIN.split(',').map((s) => s.trim())
            : ['http://localhost:3000', 'http://127.0.0.1:3000']),
          'ws://localhost:3002',
          'http://localhost:3002',
          'ws://127.0.0.1:3002',
          'http://127.0.0.1:3002',
          // Allow Yandex Cloud domains
          'https://*.yandexcloud.net',
          'wss://*.yandexcloud.net',
        ],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'", 'https://cdnjs.cloudflare.com'],
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
app.use(express.static(publicDir));

// Request logging
app.use((req, _res, next) => {
  logger.info(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', async (req, res) => {
  const health = await getHealthStatus();
  const statusCode = health.status === 'ok' ? 200 : health.status === 'degraded' ? 200 : 503;
  res.status(statusCode).json(health);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Conversation Service API',
    version: '0.1.0',
    endpoints: {
      health: '/health',
      websocket: 'WS /socket.io',
      testPage: '/test-client.html',
    },
  });
});

// Middleware for authentication
async function authenticateRequest(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): Promise<void> {
  try {
    // Support both X-Auth-Token (for Yandex Serverless) and Authorization (for local dev)
    const authHeader = req.headers['x-auth-token'] || req.headers.authorization;
    if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: No token provided' });
      return;
    }

    const token = String(authHeader).substring(7);
    const user = await verifyToken(token);
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
      return;
    }

    (req as express.Request & { user: { userId: string; email: string } }).user = user;
    next();
  } catch (error: unknown) {
    logger.error('Request authentication failed:', error);
    res.status(401).json({ error: 'Unauthorized: Authentication failed' });
  }
}

function extractBearerToken(
  headerValue: string | string[] | undefined
): string | null {
  if (!headerValue) return null;
  const value = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  if (!value) return null;
  return value.startsWith('Bearer ') ? value.substring(7) : value;
}

function getSpeakableTextFromAssistantMessage(message: Message | null): string {
  if (!message || message.role !== MessageRole.ASSISTANT) return '';
  if (message.type === MessageType.TEXT && 'content' in message) return String(message.content || '');
  if (message.type === MessageType.QUESTION && 'question' in message) return String(message.question || '');
  if (message.type === MessageType.SYSTEM && 'content' in message) return String(message.content || '');
  if (message.type === MessageType.INFO_CARD && 'title' in message) {
    const description = 'description' in message && typeof message.description === 'string'
      ? message.description
      : '';
    return `${message.title}. ${description}`.trim();
  }
  return '';
}

// API Routes
// Get all conversations for authenticated user
app.get('/api/conversations', authenticateRequest, async (req, res) => {
  try {
    const user = (req as express.Request & { user: { userId: string; email: string } }).user;
    const sessions = await getUserSessions(user.userId);

    // Return simplified session data for list view
    const conversations = sessions.map((session) => {
      const lastMessage = session.messages[session.messages.length - 1];
      const preview = lastMessage
        ? lastMessage.type === 'question' && 'question' in lastMessage
          ? lastMessage.question.substring(0, 100)
          : lastMessage.type === 'info_card' && 'title' in lastMessage
            ? lastMessage.title
            : 'Новое сообщение'
        : 'Начало диалога';

      return {
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        preview,
        messageCount: session.messages.length,
        status: session.metadata.status,
        collectedData: session.metadata.collectedData,
        product: session.metadata.product || 'jack',
        scenarioId: session.metadata.scenarioId,
      };
    });

    res.json({ conversations });
  } catch (error: unknown) {
    logger.error('Error getting conversations:', error);
    res.status(500).json({ error: 'Failed to get conversations' });
  }
});

// Delete conversation
app.delete('/api/conversations/:id', authenticateRequest, async (req, res) => {
  try {
    const user = (req as express.Request & { user: { userId: string; email: string } }).user;
    const sessionId = req.params.id;

    if (!sessionId) {
      res.status(400).json({ error: 'Session ID is required' });
      return;
    }

    const deleted = await deleteSession(sessionId, user.userId);
    if (!deleted) {
      res.status(404).json({ error: 'Conversation not found or unauthorized' });
      return;
    }

    res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (error: unknown) {
    logger.error('Error deleting conversation:', error);
    res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// ============================================
// REST API for Chat (Serverless-compatible)
// ============================================

// Create or get chat session
app.post('/api/chat/session', authenticateRequest, async (req, res) => {
  try {
    const user = (req as express.Request & { user: { userId: string; email: string } }).user;
    const { createNew, sessionId: requestedSessionId, product } = req.body;

    let session;

    if (createNew) {
      // Always create new session with specified product (default: jack)
      session = await createSession({ userId: user.userId, product: product || 'jack' });
      logger.info(`Created new session ${session.id} with product: ${product || 'jack'}`);
    } else if (requestedSessionId) {
      // Try to get specific session
      session = await getSession(requestedSessionId);
      if (!session || session.userId !== user.userId) {
        res.status(404).json({ error: 'Session not found or unauthorized' });
        return;
      }
    } else {
      // Get or create active session
      session = await getUserSession(user.userId);
      if (!session) {
        session = await createSession({ userId: user.userId });
      }
    }

    // Prepare entry step if needed
    const hydratedSession = await getSession(session.id);
    let assistantAudio: Awaited<ReturnType<typeof synthesizeAssistantAudio>> = null;
    if (hydratedSession) {
      const entryStepResult = await prepareEntryStep(hydratedSession);
      if (entryStepResult.metadataUpdates) {
        await updateSessionMetadata(hydratedSession.id, entryStepResult.metadataUpdates);
      }
      if (entryStepResult.message) {
        await addMessageToSession(hydratedSession.id, entryStepResult.message);
        const ttsText = getSpeakableTextFromAssistantMessage(entryStepResult.message);
        if (ttsText) {
          assistantAudio = await synthesizeAssistantAudio({ text: ttsText, lang: 'ru-RU' });
        }
      }
    }

    // Return updated session
    const finalSession = await getSession(session.id);
    res.json({
      sessionId: finalSession?.id,
      messages: finalSession?.messages || [],
      metadata: finalSession?.metadata,
      assistantAudio,
    });
  } catch (error: unknown) {
    logger.error('Error creating/getting chat session:', error);
    res.status(500).json({ error: 'Failed to create/get chat session' });
  }
});

// Get chat session with history
app.get('/api/chat/session/:id', authenticateRequest, async (req, res) => {
  try {
    const user = (req as express.Request & { user: { userId: string; email: string } }).user;
    const sessionId = req.params.id;

    const session = await getSession(sessionId);
    if (!session || session.userId !== user.userId) {
      res.status(404).json({ error: 'Session not found or unauthorized' });
      return;
    }

    res.json({
      sessionId: session.id,
      messages: session.messages,
      metadata: session.metadata,
    });
  } catch (error: unknown) {
    logger.error('Error getting chat session:', error);
    res.status(500).json({ error: 'Failed to get chat session' });
  }
});

// Send message to chat session (REST alternative to Socket.io)
app.post('/api/chat/session/:id/message', authenticateRequest, async (req, res) => {
  try {
    const user = (req as express.Request & { user: { userId: string; email: string } }).user;
    const sessionId = req.params.id;
    const { content } = req.body;

    if (!content || !content.trim()) {
      res.status(400).json({ error: 'Message content is required' });
      return;
    }

    const session = await getSession(sessionId);
    if (!session || session.userId !== user.userId) {
      res.status(404).json({ error: 'Session not found or unauthorized' });
      return;
    }

    // Create user message
    const userMessage: Message = {
      id: uuidv4(),
      type: MessageType.TEXT,
      role: MessageRole.USER,
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      content: content.trim(),
    };

    // Save user message
    await addMessageToSession(session.id, userMessage);

    // Process reply
    const rawAuthHeader = req.headers['x-auth-token'] || req.headers.authorization;
    const token = extractBearerToken(
      typeof rawAuthHeader === 'string' || Array.isArray(rawAuthHeader)
        ? rawAuthHeader
        : undefined
    );
    const replyResult = await handleUserReply(session, content.trim(), token || undefined);

    if (replyResult.metadataUpdates) {
      await updateSessionMetadata(session.id, replyResult.metadataUpdates);
    }

    let assistantMessage = null;
    let assistantAudio: Awaited<ReturnType<typeof synthesizeAssistantAudio>> = null;
    if (replyResult.message) {
      await addMessageToSession(session.id, replyResult.message);
      assistantMessage = replyResult.message;
      const ttsText = getSpeakableTextFromAssistantMessage(replyResult.message);
      if (ttsText) {
        assistantAudio = await synthesizeAssistantAudio({ text: ttsText, lang: 'ru-RU' });
      }
    }

    // Mirror WebSocket behavior: trigger completion integration on REST path too.
    if (!replyResult.nextStepId && replyResult.metadataUpdates?.currentStepId === undefined) {
      const updatedSessionForCompletion = await getSession(session.id);
      if (updatedSessionForCompletion) {
        const completedSteps = updatedSessionForCompletion.metadata.completedSteps || [];
        if (completedSteps.length > 5) {
          const rawAuthHeader = req.headers['x-auth-token'] || req.headers.authorization;
          const token = extractBearerToken(
            typeof rawAuthHeader === 'string' || Array.isArray(rawAuthHeader)
              ? rawAuthHeader
              : undefined
          );

          if (token) {
            handleConversationCompletion({
              sessionId: updatedSessionForCompletion.id,
              userId: updatedSessionForCompletion.userId,
              email: user.email || '',
              token,
              product: updatedSessionForCompletion.metadata.product,
              scenarioId: updatedSessionForCompletion.metadata.scenarioId,
            }).catch((err) => {
              logger.error('Error in REST conversation completion integration:', err);
            });
          }
        }
      }
    }

    // Return updated session
    const updatedSession = await getSession(session.id);
    res.json({
      userMessage,
      assistantMessage,
      assistantAudio,
      sessionId: updatedSession?.id,
      messages: updatedSession?.messages || [],
      metadata: updatedSession?.metadata,
    });
  } catch (error: unknown) {
    logger.error('Error sending chat message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * Импорт полей профиля из резюме (после извлечения текста и AI на ai-nlp).
 * Полностью обновляет сессию в Redis и добавляет следующее сообщение ассистента.
 */
app.post('/api/chat/session/:id/merge-collected', authenticateRequest, async (req, res) => {
  try {
    const user = (req as express.Request & { user: { userId: string; email: string } }).user;
    const sessionId = req.params.id;
    const { collectedData } = req.body as { collectedData?: Record<string, unknown> };

    if (!collectedData || typeof collectedData !== 'object' || Array.isArray(collectedData)) {
      res.status(400).json({ error: 'collectedData (object) is required' });
      return;
    }

    const session = await getSession(sessionId);
    if (!session || session.userId !== user.userId) {
      res.status(404).json({ error: 'Session not found or unauthorized' });
      return;
    }

    const result = await applyImportedCollectedData(session, collectedData);
    await updateSession(session);

    let assistantMessage = null;
    let assistantAudio: Awaited<ReturnType<typeof synthesizeAssistantAudio>> = null;
    if (result.message) {
      await addMessageToSession(session.id, result.message);
      assistantMessage = result.message;
      const ttsText = getSpeakableTextFromAssistantMessage(result.message);
      if (ttsText) {
        assistantAudio = await synthesizeAssistantAudio({ text: ttsText, lang: 'ru-RU' });
      }
    }

    const updatedSession = await getSession(session.id);
    res.json({
      sessionId: updatedSession?.id,
      messages: updatedSession?.messages || [],
      metadata: updatedSession?.metadata,
      assistantMessage,
      assistantAudio,
    });
  } catch (error: unknown) {
    logger.error('Error merging collected data:', error);
    res.status(500).json({ error: 'Failed to merge collected data' });
  }
});

app.post('/api/chat/session/:id/resume', authenticateRequest, async (req, res) => {
  try {
    const user = (req as express.Request & { user: { userId: string; email: string } }).user;
    const sessionId = req.params.id;
    const session = await getSession(sessionId);
    if (!session || session.userId !== user.userId) {
      res.status(404).json({ error: 'Session not found or unauthorized' });
      return;
    }

    const rawAuthHeader = req.headers['x-auth-token'] || req.headers.authorization;
    const token = extractBearerToken(
      Array.isArray(rawAuthHeader) ? rawAuthHeader[0] : (rawAuthHeader as string | undefined)
    );

    const { resume, format } = await generateResumeFromCollectedData({
      collectedData: session.metadata.collectedData || {},
      format: 'markdown',
      authToken: token || undefined,
    });

    // По UX показываем только действия (скачать PDF/DOCX), без длинного markdown в чате.
    // Сам markdown-содержимое сохраняем в metadata.flags.resumeDraft для экспорта.
    const downloadCommand: Message = {
      id: uuidv4(),
      type: MessageType.COMMAND,
      role: MessageRole.ASSISTANT,
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      commands: [
        { id: 'resume_pdf', label: 'Скачать PDF', action: 'download_resume_pdf' },
        { id: 'resume_docx', label: 'Скачать DOCX', action: 'download_resume_docx' },
      ],
    };
    await addMessageToSession(session.id, downloadCommand);
    session.metadata.flags = {
      ...(session.metadata.flags || {}),
      resumeDraft: resume,
      resumeDraftFormat: format,
    };
    await updateSession(session);

    const updatedSession = await getSession(session.id);
    res.json({
      sessionId: updatedSession?.id,
      messages: updatedSession?.messages || [],
      metadata: updatedSession?.metadata,
      assistantMessage: null,
      downloadCommand,
      assistantAudio: null,
      resume,
      format,
    });
  } catch (error: unknown) {
    logger.error('Error generating resume draft:', error);
    res.status(500).json({ error: 'Failed to generate resume draft' });
  }
});

app.get('/api/chat/session/:id/resume-file', authenticateRequest, async (req, res) => {
  try {
    const user = (req as express.Request & { user: { userId: string; email: string } }).user;
    const sessionId = req.params.id;
    const format = String(req.query.format || 'pdf').toLowerCase();
    if (format !== 'pdf' && format !== 'docx') {
      res.status(400).json({ error: 'Unsupported format. Use pdf or docx.' });
      return;
    }

    const session = await getSession(sessionId);
    if (!session || session.userId !== user.userId) {
      res.status(404).json({ error: 'Session not found or unauthorized' });
      return;
    }

    const authHeader = req.headers['x-auth-token'] || req.headers.authorization;
    const token = extractBearerToken(
      Array.isArray(authHeader) ? authHeader[0] : (authHeader as string | undefined)
    );

    const cachedDraft =
      typeof session.metadata.flags?.resumeDraft === 'string'
        ? session.metadata.flags.resumeDraft
        : '';
    const resumeText =
      cachedDraft ||
      (
        await generateResumeFromCollectedData({
          collectedData: session.metadata.collectedData || {},
          format: 'markdown',
          authToken: token || undefined,
        })
      ).resume;

    const fileName = `resume-${session.id}.${format}`;
    if (format === 'pdf') {
      const pdfBuffer = await generateResumePdfBuffer(resumeText);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.send(pdfBuffer);
      return;
    }

    const docxBuffer = await generateResumeDocxBuffer(resumeText);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    );
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(docxBuffer);
  } catch (error: unknown) {
    logger.error('Error generating resume file:', error);
    res.status(500).json({ error: 'Failed to generate resume file' });
  }
});

app.post('/api/chat/session/:id/resume-email', authenticateRequest, async (req, res) => {
  try {
    const user = (req as express.Request & { user: { userId: string; email: string } }).user;
    const sessionId = req.params.id;
    const session = await getSession(sessionId);
    if (!session || session.userId !== user.userId) {
      res.status(404).json({ error: 'Session not found or unauthorized' });
      return;
    }

    const authHeader = req.headers['x-auth-token'] || req.headers.authorization;
    const token = extractBearerToken(
      Array.isArray(authHeader) ? authHeader[0] : (authHeader as string | undefined)
    );
    const bearer = token ? `Bearer ${token}` : '';

    const { resume } = await generateResumeFromCollectedData({
      collectedData: session.metadata.collectedData || {},
      format: 'markdown',
      authToken: token || undefined,
    });

    const coverLetter = await generateFreeChatResponse({
      message:
        'Сгенерируй короткое сопроводительное письмо на русском (5-7 предложений) к отклику на релевантную вакансию, с акцентом на опыт кандидата и конкретную пользу для работодателя.',
      collectedData: session.metadata.collectedData || {},
      conversationHistory: [],
    });

    const emailServiceUrl = process.env.EMAIL_SERVICE_URL || 'http://localhost:3005';
    const axios = (await import('axios')).default;
    await axios.post(
      `${emailServiceUrl}/api/email/send-resume-package`,
      {
        resume,
        coverLetter,
      },
      {
        headers: {
          Authorization: bearer,
          'X-Auth-Token': bearer,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      }
    );

    const assistantMessage: Message = {
      id: uuidv4(),
      type: MessageType.TEXT,
      role: MessageRole.ASSISTANT,
      timestamp: new Date().toISOString(),
      sessionId: session.id,
      content:
        `Готово! Отправил резюме и сопроводительное письмо на вашу почту: ${user.email}. ` +
        'Проверьте входящие и папку "Спам".',
    };

    await addMessageToSession(session.id, assistantMessage);
    let assistantAudio = null;
    const ttsText = getSpeakableTextFromAssistantMessage(assistantMessage);
    if (ttsText) {
      assistantAudio = await synthesizeAssistantAudio({ text: ttsText, lang: 'ru-RU' });
    }

    const updatedSession = await getSession(session.id);
    res.json({
      sessionId: updatedSession?.id,
      messages: updatedSession?.messages || [],
      metadata: updatedSession?.metadata,
      assistantMessage,
      assistantAudio,
      success: true,
      email: user.email,
    });
  } catch (error: unknown) {
    logger.error('Error sending resume package email:', error);
    res.status(500).json({ error: 'Failed to send resume package email' });
  }
});

// Generate/get report for chat session (proxy to Report Service)
app.post('/api/chat/session/:id/report', authenticateRequest, async (req, res) => {
  try {
    const user = (req as express.Request & { user: { userId: string; email: string } }).user;
    const sessionId = req.params.id;

    const session = await getSession(sessionId);
    if (!session || session.userId !== user.userId) {
      res.status(404).json({ error: 'Session not found or unauthorized' });
      return;
    }

    // Check if session is for wannanew product
    if (session.metadata.product !== 'wannanew') {
      res.status(400).json({ error: 'Reports are only available for wannanew sessions' });
      return;
    }

    // Proxy request to Report Service
    const reportServiceUrl = process.env.REPORT_SERVICE_URL || 'http://localhost:3007';
    const authHeader = req.headers['x-auth-token'] || req.headers.authorization;

    try {
      const axios = (await import('axios')).default;
      const response = await axios.post(
        `${reportServiceUrl}/api/report/generate`,
        { sessionId, userId: user.userId, email: user.email },
        {
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      res.json(response.data);
    } catch (reportError: any) {
      logger.error('Error calling Report Service:', reportError?.message);
      res.status(500).json({ error: 'Failed to generate report. Please try again later.' });
    }
  } catch (error: unknown) {
    logger.error('Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

// JSON preview for interview completion cards (proxy to Report Service)
app.get('/api/chat/session/:id/report-preview', authenticateRequest, async (req, res) => {
  try {
    const user = (req as express.Request & { user: { userId: string; email: string } }).user;
    const sessionId = req.params.id;

    const session = await getSession(sessionId);
    if (!session || session.userId !== user.userId) {
      res.status(404).json({ error: 'Session not found or unauthorized' });
      return;
    }

    if (session.metadata.product !== 'wannanew') {
      res.status(400).json({ error: 'Report preview is only available for interview sessions' });
      return;
    }

    const reportServiceUrl = process.env.REPORT_SERVICE_URL || 'http://localhost:3007';
    const authHeader = req.headers['x-auth-token'] || req.headers.authorization;

    try {
      const axios = (await import('axios')).default;
      const bearer =
        typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
          ? authHeader
          : `Bearer ${String(authHeader || '').replace(/^Bearer\s+/i, '')}`;

      // Report не дергает conversation по сети — передаём collectedData после проверки сессии здесь.
      const response = await axios.post(
        `${reportServiceUrl}/api/report/preview-compute`,
        { collectedData: session.metadata.collectedData || {} },
        {
          headers: {
            Authorization: bearer,
            'X-Auth-Token': bearer,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        }
      );

      res.json(response.data);
    } catch (reportError: unknown) {
      const err = reportError as { response?: { status?: number; data?: { error?: string } } };
      logger.error('Error calling Report Service preview:', (reportError as Error)?.message);
      const status = err.response?.status === 404 ? 404 : 500;
      res.status(status).json({
        error: err.response?.data?.error || 'Failed to load report preview',
      });
    }
  } catch (error: unknown) {
    logger.error('Error loading report preview:', error);
    res.status(500).json({ error: 'Failed to load report preview' });
  }
});

// Get report status/download URL
app.get('/api/chat/session/:sessionId/report/:reportId', authenticateRequest, async (req, res) => {
  try {
    const user = (req as express.Request & { user: { userId: string; email: string } }).user;
    const { sessionId, reportId } = req.params;

    const session = await getSession(sessionId);
    if (!session || session.userId !== user.userId) {
      res.status(404).json({ error: 'Session not found or unauthorized' });
      return;
    }

    // Proxy request to Report Service
    const reportServiceUrl = process.env.REPORT_SERVICE_URL || 'http://localhost:3007';
    const authHeader = req.headers['x-auth-token'] || req.headers.authorization;

    try {
      const axios = (await import('axios')).default;
      const response = await axios.get(
        `${reportServiceUrl}/api/report/${reportId}/status`,
        {
          headers: {
            Authorization: authHeader,
          },
          timeout: 10000,
        }
      );

      res.json(response.data);
    } catch (reportError: any) {
      logger.error('Error getting report status:', reportError?.message);
      res.status(500).json({ error: 'Failed to get report status' });
    }
  } catch (error: unknown) {
    logger.error('Error getting report:', error);
    res.status(500).json({ error: 'Failed to get report' });
  }
});

// Execute command in chat session
app.post('/api/chat/session/:id/command', authenticateRequest, async (req, res) => {
  try {
    const user = (req as express.Request & { user: { userId: string; email: string } }).user;
    const sessionId = req.params.id;
    const { commandId, action } = req.body;

    if (!commandId || !action) {
      res.status(400).json({ error: 'commandId and action are required' });
      return;
    }

    const session = await getSession(sessionId);
    if (!session || session.userId !== user.userId) {
      res.status(404).json({ error: 'Session not found or unauthorized' });
      return;
    }

    const commandResult = await handleCommand(session, commandId, action);

    if (commandResult.metadataUpdates) {
      await updateSessionMetadata(session.id, commandResult.metadataUpdates);
    }

    if (commandResult.message) {
      await addMessageToSession(session.id, commandResult.message);
    }

    // If next step changed, prepare it
    if (commandResult.nextStepId && commandResult.nextStepId !== session.metadata.currentStepId) {
      const updatedSession = await getSession(session.id);
      if (updatedSession) {
        const nextStepResult = await prepareEntryStep(updatedSession);
        if (nextStepResult.metadataUpdates) {
          await updateSessionMetadata(updatedSession.id, nextStepResult.metadataUpdates);
        }
        if (nextStepResult.message) {
          await addMessageToSession(updatedSession.id, nextStepResult.message);
        }
      }
    }

    // Return updated session
    const finalSession = await getSession(session.id);
    res.json({
      sessionId: finalSession?.id,
      messages: finalSession?.messages || [],
      metadata: finalSession?.metadata,
    });
  } catch (error: unknown) {
    logger.error('Error executing chat command:', error);
    res.status(500).json({ error: 'Failed to execute command' });
  }
});

// ============================================
// Socket.io (kept for local development)
// ============================================

// Socket.io connection handling
io.use(async (socket, next) => {
  try {
    logger.info(`WebSocket handshake attempt from ${socket.handshake.address}`);

    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) {
      logger.error('Authentication error: No token provided');
      next(new Error('Authentication error: No token provided'));
      return;
    }

    const user = await verifyToken(token);
    if (!user) {
      next(new Error('Authentication error: Invalid token'));
      return;
    }

    socket.data.user = user;
    logger.info(`WebSocket authenticated for user: ${user.userId}`);
    next();
  } catch (error: unknown) {
    logger.error('Socket authentication failed:', error);
    next(new Error('Authentication error'));
  }
});

io.on('connection', async (socket) => {
  const user = socket.data.user as { userId: string; email: string } | undefined;
  if (!user) {
    logger.warn('Socket connection established without authenticated user');
    socket.disconnect();
    return;
  }

  logger.info(`WebSocket connection established for user: ${user.userId} (${user.email})`);

  // Check if specific sessionId is provided in auth
  const requestedSessionId = socket.handshake.auth?.sessionId as string | undefined;
  const createNew = socket.handshake.auth?.createNew === true;
  const requestedProduct = (socket.handshake.auth as SocketAuth | undefined)?.product;

  let hydratedSession: ConversationSession | null = null;

  // If createNew is true, always create a new session
  if (createNew) {
    logger.info(`User requested new session (createNew=true)`);
    const newSession = await createSession({
      userId: user.userId,
      product: requestedProduct || 'jack',
    });
    hydratedSession = await getSession(newSession.id);
    if (!hydratedSession) {
      logger.error('Failed to create new session for user:', user.userId);
      socket.emit('error', { message: 'Не удалось создать новую сессию. Попробуйте снова.' });
      socket.disconnect();
      return;
    }
    logger.info(`Created new session: ${hydratedSession.id}, product: ${requestedProduct || 'jack'}`);
  }
  // If sessionId is provided and createNew is false, try to use it
  else if (requestedSessionId) {
    logger.info(`User requested specific session: ${requestedSessionId}`);
    const requestedSession = await getSession(requestedSessionId);

    // Verify session exists and belongs to user
    if (requestedSession && requestedSession.userId === user.userId) {
      hydratedSession = requestedSession;
      logger.info(`Using requested session: ${requestedSessionId}`);
    } else {
      logger.warn(
        `Session ${requestedSessionId} not found or doesn't belong to user ${user.userId}`
      );
      socket.emit('error', { message: 'Сессия не найдена или недоступна.' });
      socket.disconnect();
      return;
    }
  }
  // If no sessionId and no createNew flag, get or create active session (backward compatibility)
  else {
    let session = await getUserSession(user.userId);
    if (!session) {
      session = await createSession({ userId: user.userId });
    }

    hydratedSession = await getSession(session.id);
    if (!hydratedSession) {
      logger.error('Failed to initialise session for user:', user.userId);
      socket.emit('error', { message: 'Не удалось создать сессию. Попробуйте снова.' });
      socket.disconnect();
      return;
    }
    logger.info(`Using active session: ${hydratedSession.id}`);
  }

  // Prepare entry step question (if not already sent)
  const entryStepResult = await prepareEntryStep(hydratedSession);
  if (entryStepResult.metadataUpdates) {
    await updateSessionMetadata(hydratedSession.id, entryStepResult.metadataUpdates);
    hydratedSession = (await getSession(hydratedSession.id)) ?? hydratedSession;
  }
  if (entryStepResult.message) {
    await addMessageToSession(hydratedSession.id, entryStepResult.message);
    hydratedSession = (await getSession(hydratedSession.id)) ?? hydratedSession;
  }

  // Join session room
  socket.join(`session:${hydratedSession.id}`);
  socket.emit('session:joined', { sessionId: hydratedSession.id });

  // Store session ID in socket data for use in event handlers
  socket.data.sessionId = hydratedSession.id;

  if (hydratedSession.messages.length > 0) {
    socket.emit('session:history', { messages: hydratedSession.messages });
  }

  // Handle new message
  socket.on('message:send', async (data: { content: string }) => {
    try {
      const { content } = data;
      if (!content || !content.trim()) {
        socket.emit('error', { message: 'Message cannot be empty' });
        return;
      }

      const sessionId = socket.data.sessionId as string | undefined;
      if (!sessionId) {
        socket.emit('error', { message: 'Сессия не найдена. Попробуйте обновить страницу.' });
        return;
      }

      const sessionSnapshot = await getSession(sessionId);
      if (!sessionSnapshot) {
        socket.emit('error', { message: 'Сессия не найдена. Попробуйте обновить страницу.' });
        return;
      }

      // Create user message
      const userMessage: Message = {
        id: uuidv4(),
        type: MessageType.TEXT,
        role: MessageRole.USER,
        timestamp: new Date().toISOString(),
        sessionId: sessionSnapshot.id,
        content: content.trim(),
      };

      // Save user message
      await addMessageToSession(sessionSnapshot.id, userMessage);
      io.to(`session:${sessionSnapshot.id}`).emit('message:received', { message: userMessage });

      const socketToken =
        typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined;
      const replyResult = await handleUserReply(sessionSnapshot, content.trim(), socketToken);

      if (replyResult.metadataUpdates) {
        await updateSessionMetadata(sessionSnapshot.id, replyResult.metadataUpdates);
      }

      if (replyResult.message) {
        await addMessageToSession(sessionSnapshot.id, replyResult.message);
        io.to(`session:${sessionSnapshot.id}`).emit('message:received', {
          message: replyResult.message,
        });
      }

      // Check if conversation is complete (no next step and not in free chat)
      if (!replyResult.nextStepId && replyResult.metadataUpdates?.currentStepId === undefined) {
        const updatedSession = await getSession(sessionSnapshot.id);
        if (updatedSession) {
          const completedSteps = updatedSession.metadata.completedSteps || [];
          // Trigger integration if we have collected data (at least some steps completed)
          if (completedSteps.length > 5) {
            // Get token from socket (if available)
            const token = socket.handshake.auth?.token;
            if (token) {
              // Trigger integration in background (don't await)
              // For Jack: job matching → email
              // For wannanew: placeholder for report generation
              handleConversationCompletion({
                sessionId: updatedSession.id,
                userId: updatedSession.userId,
                email: (socket.handshake.auth as SocketAuth)?.email || '',
                token,
                product: updatedSession.metadata.product,
                scenarioId: updatedSession.metadata.scenarioId,
              }).catch((err) => {
                logger.error('Error in conversation completion integration:', err);
              });
            }
          }
        }
      }
    } catch (error) {
      logger.error('Error processing message:', error);
      socket.emit('error', { message: 'Failed to process message' });
    }
  });

  // Handle command selection
  socket.on('command:select', async (data: { commandId: string; action: string }) => {
    try {
      const { commandId, action } = data;
      logger.info(`Command selected: ${commandId} - ${action}`);

      const sessionId = socket.data.sessionId as string | undefined;
      if (!sessionId) {
        socket.emit('error', { message: 'Сессия не найдена. Попробуйте обновить страницу.' });
        return;
      }

      const sessionSnapshot = await getSession(sessionId);
      if (!sessionSnapshot) {
        socket.emit('error', { message: 'Сессия не найдена. Попробуйте обновить страницу.' });
        return;
      }

      // Check if session is paused
      if (sessionSnapshot.metadata.flags?.paused && action !== 'resume') {
        socket.emit('error', { message: 'Диалог на паузе. Используйте команду "Возобновить".' });
        return;
      }

      const commandResult = await handleCommand(sessionSnapshot, commandId, action);

      if (commandResult.metadataUpdates) {
        await updateSessionMetadata(sessionSnapshot.id, commandResult.metadataUpdates);
      }

      if (commandResult.message) {
        await addMessageToSession(sessionSnapshot.id, commandResult.message);
        io.to(`session:${sessionSnapshot.id}`).emit('message:received', {
          message: commandResult.message,
        });
      }

      // If next step changed, prepare it
      if (
        commandResult.nextStepId &&
        commandResult.nextStepId !== sessionSnapshot.metadata.currentStepId
      ) {
        const updatedSession = await getSession(sessionSnapshot.id);
        if (updatedSession) {
          const nextStepResult = await prepareEntryStep(updatedSession);
          if (nextStepResult.metadataUpdates) {
            await updateSessionMetadata(updatedSession.id, nextStepResult.metadataUpdates);
          }
          if (nextStepResult.message) {
            await addMessageToSession(updatedSession.id, nextStepResult.message);
            io.to(`session:${updatedSession.id}`).emit('message:received', {
              message: nextStepResult.message,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error handling command:', error);
      socket.emit('error', { message: 'Не удалось выполнить команду' });
    }
  });

  // Legacy handler for backward compatibility
  socket.on('command:execute', async (data: { commandId: string; action: string }) => {
    // Redirect to command:select
    socket.emit('command:select', data);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${user.userId}`);
  });
});

// Start server
async function start() {
  try {
    // Validate configuration before starting
    validateAndLogConfig('Conversation Service');

    // Connect to Redis for session storage
    await connectRedis();

    // Setup Redis adapter for Socket.io (session sharing across instances)
    const redisHost = process.env.REDIS_HOST || 'localhost';
    const redisPort = parseInt(process.env.REDIS_PORT || '6379', 10);
    const redisPassword = process.env.REDIS_PASSWORD || undefined;
    const redisUser = process.env.REDIS_USER || undefined;
    const redisSsl = process.env.REDIS_SSL === 'true';

    const redisUrl = redisPassword
      ? `redis${redisSsl ? 's' : ''}://${redisUser ? redisUser + ':' : ''}${redisPassword}@${redisHost}:${redisPort}`
      : `redis://${redisHost}:${redisPort}`;

    logger.info(`Setting up Socket.io Redis adapter...`);

    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    pubClient.on('error', (err) => logger.error('Redis Pub Client Error:', err));
    subClient.on('error', (err) => logger.error('Redis Sub Client Error:', err));

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    logger.info(`Socket.io Redis adapter connected successfully`);

    // Start HTTP server
    httpServer.listen(PORT, '0.0.0.0', () => {
      logger.info(`Conversation Service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`WebSocket: ws://localhost:${PORT}/socket.io`);
      logger.info(`Test page: http://localhost:${PORT}/test-client.html`);
    });
  } catch (error: unknown) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
