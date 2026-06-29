import { Request, Response } from 'express';
import { HhIntegrationService, isHhIntegrationConfigured } from '../services/hhIntegrationService';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Unknown error';

export class HhIntegrationController {
  static async oauthStart(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      if (!isHhIntegrationConfigured()) {
        res.status(503).json({ error: 'HH OAuth is not configured' });
        return;
      }

      const returnTo =
        typeof req.query.returnTo === 'string' && req.query.returnTo.trim()
          ? req.query.returnTo.trim()
          : undefined;
      const authorizeUrl = HhIntegrationService.getAuthorizationUrl(req.userId, returnTo);

      const wantsJson =
        req.headers.accept?.includes('application/json') || req.query.format === 'json';
      if (wantsJson) {
        res.json({ authorizeUrl });
        return;
      }

      res.redirect(authorizeUrl);
    } catch (error: unknown) {
      logger.error('HH OAuth start error:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  }

  static async oauthCallback(req: Request, res: Response): Promise<void> {
    try {
      const oauthError = req.query.error;
      if (typeof oauthError === 'string' && oauthError.trim()) {
        res.redirect(HhIntegrationService.getFailureRedirect(oauthError));
        return;
      }

      const code = req.query.code;
      const state = req.query.state;
      if (typeof code !== 'string' || typeof state !== 'string') {
        res.redirect(HhIntegrationService.getFailureRedirect('Missing OAuth callback parameters'));
        return;
      }

      const parsedState = HhIntegrationService.parseStateToken(state);
      await HhIntegrationService.exchangeAuthorizationCode(code, parsedState.userId);
      res.redirect(HhIntegrationService.getSuccessRedirect(parsedState.returnTo));
    } catch (error: unknown) {
      logger.error('HH OAuth callback error:', error);
      res.redirect(HhIntegrationService.getFailureRedirect(getErrorMessage(error)));
    }
  }

  static async getStatus(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const lite = req.query.lite === '1' || req.query.lite === 'true';
      const status = await HhIntegrationService.getIntegrationStatus(req.userId, { lite });
      res.json(status);
    } catch (error: unknown) {
      logger.error('HH integration status error:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  }

  static async revoke(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.userId) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const removed = await HhIntegrationService.revokeIntegration(req.userId);
      res.json({ success: true, removed });
    } catch (error: unknown) {
      logger.error('HH integration revoke error:', error);
      res.status(500).json({ error: getErrorMessage(error) });
    }
  }
}
