import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth';
import { reportService } from '../services/reportService';
import { logger } from '../utils/logger';

export const reportController = {
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

      res.redirect(downloadUrl);
    } catch (error) {
      logger.error('Failed to download report', { error: (error as Error).message });
      res.status(500).json({ error: 'Failed to download report' });
    }
  },
};
