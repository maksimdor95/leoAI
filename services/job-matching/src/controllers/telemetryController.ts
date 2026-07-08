import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import pool from '../config/database';
import { logger } from '../utils/logger';

export async function getViewedJobIds(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const query = `
      SELECT DISTINCT job_id
      FROM recommendation_interactions
      WHERE user_id = $1 AND interaction_type = 'view'
    `;
    const result = await pool.query(query, [userId]);
    const jobIds = result.rows
      .map((row: { job_id?: string }) => row.job_id)
      .filter((id): id is string => typeof id === 'string');

    res.json({ jobIds });
  } catch (error: unknown) {
    logger.error('Error getting viewed job ids:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

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

    const validTypes = ['view', 'like', 'dislike', 'apply', 'apply_intent', 'draft_generated'];
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
