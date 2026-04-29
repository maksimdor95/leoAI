import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { reportGenerator } from '../services/reportGenerator';
import { reportService } from '../services/reportService';
import { CollectedData } from '../types/report';
import { logger } from '../utils/logger';
import fs from 'fs';

export const reportController = {
  /**
   * Превью по collectedData — conversation уже проверил сессию; report не ходит обратно в conversation.
   */
  async previewFromCollected(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const raw = req.body?.collectedData;
      if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        res.status(400).json({ error: 'collectedData object required' });
        return;
      }
      const data = reportGenerator.buildReportDataFromCollected(raw as CollectedData, req.userEmail);
      res.json(data);
    } catch (error) {
      logger.error('Failed to build preview from collected data', { error: (error as Error).message });
      res.status(500).json({ error: 'Failed to load report preview' });
    }
  },

  async generateReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { sessionId } = req.body;
      const userId = req.userId!;
      const email = req.userEmail;

      if (!sessionId) {
        res.status(400).json({ error: 'sessionId is required' });
        return;
      }

      const result = await reportService.initiateGeneration({
        sessionId,
        userId,
        email,
      });

      res.json(result);
    } catch (error) {
      logger.error('Failed to generate report', { error: (error as Error).message });
      res.status(500).json({ error: 'Failed to generate report' });
    }
  },

  async getReportStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const userId = req.userId!;

      const status = await reportService.getStatus(reportId, userId);

      if (!status) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }

      res.json(status);
    } catch (error) {
      logger.error('Failed to get report status', { error: (error as Error).message });
      res.status(500).json({ error: 'Failed to get report status' });
    }
  },

  async downloadReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const userId = req.userId!;

      const downloadUrl = await reportService.getDownloadUrl(reportId, userId);

      if (!downloadUrl) {
        res.status(404).json({ error: 'Report not found or not ready' });
        return;
      }

      if (downloadUrl.startsWith('localfile:')) {
        const localPath = downloadUrl.substring('localfile:'.length);
        if (!fs.existsSync(localPath)) {
          res.status(404).json({ error: 'Report file not found' });
          return;
        }
        res.download(localPath);
        return;
      }

      res.redirect(downloadUrl);
    } catch (error) {
      logger.error('Failed to download report', { error: (error as Error).message });
      res.status(500).json({ error: 'Failed to download report' });
    }
  },

  /** JSON-разбор отчёта для экрана «Интервью завершено» (без генерации PDF). */
  async previewSessionReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    const { sessionId } = req.params;
    const userId = req.userId!;
    const email = req.userEmail;
    const authHeader =
      req.headers.authorization ||
      (typeof req.headers['x-auth-token'] === 'string' ? req.headers['x-auth-token'] : undefined);

    if (!authHeader || !String(authHeader).includes('Bearer')) {
      res.status(401).json({ error: 'Authorization header required' });
      return;
    }

    const bearer =
      String(authHeader).startsWith('Bearer ') ? String(authHeader) : `Bearer ${String(authHeader)}`;

    try {
      // Одна авторизованная загрузка сессии (без лишнего HTTP-цикла report→conversation с неверным URL в Docker).
      const data = await reportGenerator.generateReportData(sessionId, userId, email, {
        authorization: bearer,
      });
      res.json(data);
    } catch (error: unknown) {
      const ax = error as { response?: { status?: number } };
      if (ax.response?.status === 404 || ax.response?.status === 401) {
        res.status(404).json({ error: 'Session not found or unauthorized' });
        return;
      }
      logger.error('Failed to preview report', { error: (error as Error).message });
      res.status(500).json({ error: 'Failed to load report preview' });
    }
  },
};
