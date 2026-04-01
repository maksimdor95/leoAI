import { Response } from 'express';
import { z } from 'zod';
import { CareerService } from '../services/careerService';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const upsertProfileSchema = z.object({
  current_role: z.string().min(1).optional(),
  target_role: z.string().min(1).optional(),
  experience_years: z.number().int().min(0).max(50).optional(),
  resume_text: z.string().min(1).optional(),
});

export class CareerController {
  /**
   * Create or update minimal CareerProfile and optional Resume for the authenticated user
   */
  static async upsertProfile(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const parsed = upsertProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        logger.warn('Career profile validation error:', parsed.error.flatten());
        return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
      }

      const result = await CareerService.upsertCareerProfile(req.userId, parsed.data);

      return res.status(200).json({
        message: 'Career profile updated successfully',
        careerProfile: result.careerProfile,
        resume: result.resume,
      });
    } catch (error: unknown) {
      logger.error('Error in upsertProfile controller:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Return fake AI Readiness Score for the authenticated user
   */
  static async getAiReadinessScore(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await CareerService.getAiReadinessScore(req.userId);

      return res.status(200).json({
        ai_readiness_score: result.score,
        summary: result.summary,
        recommendations: result.recommendations,
      });
    } catch (error: unknown) {
      logger.error('Error in getAiReadinessScore controller:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Return full career profile with related entities for a given user
   */
  static async getCareerProfileByUserId(req: AuthRequest, res: Response) {
    try {
      const { userId: authUserId } = req;
      const { userId } = req.params;

      if (!authUserId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!userId || userId !== authUserId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const result = await CareerService.getCareerProfileWithDetails(userId);

      return res.status(200).json(result);
    } catch (error: unknown) {
      logger.error('Error in getCareerProfileByUserId controller:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Calculate mock AI Readiness Score based on number of skills
   */
  static async calculateMockAiReadiness(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await CareerService.getMockAiReadinessFromSkills(req.userId);

      return res.status(200).json({
        ai_readiness_score: result.score,
        skills_count: result.skillsCount,
      });
    } catch (error: unknown) {
      logger.error('Error in calculateMockAiReadiness controller:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

