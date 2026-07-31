import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { deriveProfileSignals } from '../services/deriveProfileSignals';
import { CollectedData } from '../services/userService';
import { logger } from '../utils/logger';

/**
 * POST /api/jobs/derive-profile-signals
 * Rule-based enrichment: role_family, seniority, job_preferences, normalized_skills.
 * Validation without zod — avoids MODULE_NOT_FOUND if node_modules is incomplete.
 */
export async function deriveProfileSignalsHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const body = req.body ?? {};
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const rawCollected = (body as { collectedData?: unknown }).collectedData;
    if (
      rawCollected !== undefined &&
      (rawCollected === null || typeof rawCollected !== 'object' || Array.isArray(rawCollected))
    ) {
      res.status(400).json({ error: 'Invalid payload', details: { collectedData: 'must be an object' } });
      return;
    }

    const collectedData = (rawCollected ?? {}) as CollectedData;
    const signals = deriveProfileSignals(collectedData);

    res.json({
      status: 'success',
      signals,
    });
  } catch (error: unknown) {
    logger.error('derive-profile-signals error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
