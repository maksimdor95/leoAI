import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';
import { logger } from '../utils/logger';

export async function recordInteraction(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { jobId, interactionType } = req.body;
    if (!jobId || !interactionType) {
      res.status(400).json({ error: 'jobId and interactionType are required' });
      return;
    }

    const validTypes = ['view', 'like', 'dislike', 'apply'];
    if (!validTypes.includes(interactionType)) {
      res.status(400).json({ error: 'Invalid interactionType' });
      return;
    }

    const query = `
      INSERT INTO recommendation_interactions (user_id, job_id, interaction_type)
      VALUES ($1, $2, $3)
      RETURNING id
    `;
    await pool.query(query, [userId, jobId, interactionType]);

    res.json({ success: true });
  } catch (error: unknown) {
    logger.error('Error recording interaction:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
