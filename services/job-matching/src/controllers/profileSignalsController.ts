import { Response } from 'express';
import { z } from 'zod';
import { AuthRequest } from '../middleware/auth';
import { deriveProfileSignals } from '../services/deriveProfileSignals';
import { CollectedData } from '../services/userService';
import { logger } from '../utils/logger';

const deriveSchema = z.object({
  collectedData: z.record(z.unknown()).optional(),
});

/**
 * POST /api/jobs/derive-profile-signals
 * Rule-based enrichment: role_family, seniority, job_preferences, normalized_skills.
 */
export async function deriveProfileSignalsHandler(req: AuthRequest, res: Response): Promise<void> {
  try {
    const parsed = deriveSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
      return;
    }

    const collectedData = (parsed.data.collectedData ?? {}) as CollectedData;
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
