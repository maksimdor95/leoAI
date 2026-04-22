import { Response } from 'express';
import { z } from 'zod';
import { CareerService } from '../services/careerService';
import { AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const upsertProfileSchema = z.object({
  track_id: z.string().uuid().optional(),
  current_role: z.string().min(1).optional(),
  target_role: z.string().min(1).optional(),
  experience_years: z.number().int().min(0).max(50).optional(),
  resume_text: z.string().min(1).optional(),
});

const createTrackSchema = z.object({
  name: z.string().min(1).max(255),
  current_role: z.string().optional(),
  target_role: z.string().optional(),
  experience_years: z.number().int().min(0).max(50).optional(),
  is_default: z.boolean().optional(),
});

const updateTrackSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  current_role: z.string().nullable().optional(),
  target_role: z.string().nullable().optional(),
  experience_years: z.number().int().min(0).max(50).nullable().optional(),
});

export class CareerController {
  static async listTracks(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const tracks = await CareerService.listTracks(req.userId);
      return res.status(200).json({ tracks });
    } catch (error: unknown) {
      logger.error('Error in listTracks:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async createTrack(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const parsed = createTrackSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
      }
      const track = await CareerService.createTrack(req.userId, parsed.data);
      return res.status(201).json({ track });
    } catch (error: unknown) {
      logger.error('Error in createTrack:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async updateTrack(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const { trackId } = req.params;
      if (!trackId || !z.string().uuid().safeParse(trackId).success) {
        return res.status(400).json({ error: 'Invalid track id' });
      }
      const parsed = updateTrackSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Invalid payload', details: parsed.error.flatten() });
      }
      const track = await CareerService.updateTrack(req.userId, trackId, parsed.data);
      if (!track) {
        return res.status(404).json({ error: 'Track not found' });
      }
      return res.status(200).json({ track });
    } catch (error: unknown) {
      logger.error('Error in updateTrack:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async setDefaultTrack(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const { trackId } = req.params;
      if (!trackId || !z.string().uuid().safeParse(trackId).success) {
        return res.status(400).json({ error: 'Invalid track id' });
      }
      const track = await CareerService.setDefaultTrack(req.userId, trackId);
      if (!track) {
        return res.status(404).json({ error: 'Track not found' });
      }
      return res.status(200).json({ track });
    } catch (error: unknown) {
      logger.error('Error in setDefaultTrack:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Create or update minimal career track fields + optional resume row for that track.
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

  static async uploadResume(
    req: AuthRequest & { file?: { buffer: Buffer; originalname: string; mimetype: string } },
    res: Response
  ) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      if (!req.file?.buffer) {
        return res.status(400).json({ error: 'Файл не передан. Используйте поле file (multipart/form-data).' });
      }
      const trackId =
        typeof req.body?.track_id === 'string' && req.body.track_id.length > 0
          ? req.body.track_id
          : undefined;

      const result = await CareerService.createResumeFromFileUpload(req.userId, {
        buffer: req.file.buffer,
        originalFilename: req.file.originalname || 'resume',
        mimeType: req.file.mimetype || 'application/octet-stream',
        trackId,
      });

      return res.status(201).json({
        resume: result.resume,
        careerProfile: result.careerProfile,
        extractedText: result.extractedText,
        docId: result.resume.id,
        chunksCount: result.resume.content_list?.chunks?.length || 0,
        contentList: result.resume.content_list || null,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Internal server error';
      logger.error('Error in uploadResume:', error);
      return res.status(400).json({ error: message });
    }
  }

  static async listResumes(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const trackId =
        typeof req.query.track_id === 'string' && req.query.track_id.length > 0
          ? req.query.track_id
          : undefined;
      const resumes = await CareerService.listResumes(req.userId, trackId);
      return res.status(200).json({ resumes });
    } catch (error: unknown) {
      logger.error('Error in listResumes:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async getResumeById(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const { resumeId } = req.params;
      if (!resumeId || !z.string().uuid().safeParse(resumeId).success) {
        return res.status(400).json({ error: 'Invalid resume id' });
      }
      const resume = await CareerService.getResumeById(req.userId, resumeId);
      if (!resume) {
        return res.status(404).json({ error: 'Resume not found' });
      }
      return res.status(200).json({ resume });
    } catch (error: unknown) {
      logger.error('Error in getResumeById:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async deleteResume(req: AuthRequest, res: Response) {
    try {
      if (!req.userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const { resumeId } = req.params;
      if (!resumeId || !z.string().uuid().safeParse(resumeId).success) {
        return res.status(400).json({ error: 'Invalid resume id' });
      }
      const ok = await CareerService.deleteResume(req.userId, resumeId);
      if (!ok) {
        return res.status(404).json({ error: 'Resume not found' });
      }
      return res.status(200).json({ success: true });
    } catch (error: unknown) {
      logger.error('Error in deleteResume:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

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
