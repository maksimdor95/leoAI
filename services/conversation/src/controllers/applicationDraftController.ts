import { Request, Response } from 'express';
import axios from 'axios';
import { getSession, getUserSession } from '../services/sessionService';
import { generateApplicationDraft } from '../services/aiClient';
import { jackCollectedDataReadyForApplication } from '../utils/jackProfileGating';
import { stripHtmlFromText } from '../utils/vacancyPrepText';
import { logger } from '../utils/logger';

const JOB_MATCHING_SERVICE_URL = process.env.JOB_MATCHING_SERVICE_URL || 'http://localhost:3004';

const APPLICATION_DRAFT_TONES = [
  'neutral',
  'formal',
  'concise',
  'casual',
  'human',
  'warm',
  'metrics',
  'detailed',
  'job_fit',
] as const;

type ApplicationDraftTone = (typeof APPLICATION_DRAFT_TONES)[number];

function isApplicationDraftTone(value: unknown): value is ApplicationDraftTone {
  return typeof value === 'string' && (APPLICATION_DRAFT_TONES as readonly string[]).includes(value);
}

interface JobDetailsPayload {
  job: {
    id: string;
    title: string;
    company: string;
    location?: string[];
    description?: string;
    requirements?: string;
    skills?: string[];
    work_mode?: string | null;
    source_meta?: Record<string, unknown> | null;
  };
  conditions?: Record<string, unknown> | null;
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header) return undefined;
  return header.replace(/^Bearer\s+/i, '').trim() || undefined;
}

export async function createApplicationDraft(req: Request, res: Response): Promise<void> {
  try {
    const user = (req as Request & { user?: { userId: string; email: string } }).user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const jobId = req.params.jobId;
    const body = (req.body || {}) as {
      sessionId?: string;
      tone?: ApplicationDraftTone;
      regenerate?: boolean;
      matchHighlights?: string[];
    };

    const authHeader = req.headers['x-auth-token'] || req.headers.authorization;
    const token = extractBearerToken(
      Array.isArray(authHeader) ? authHeader[0] : (authHeader as string | undefined)
    );
    const bearer = token ? `Bearer ${token}` : '';

    let session =
      typeof body.sessionId === 'string' && body.sessionId.trim()
        ? await getSession(body.sessionId.trim())
        : await getUserSession(user.userId);

    if (session && session.userId !== user.userId) {
      session = null;
    }

    const collectedData = (session?.metadata?.collectedData || {}) as Record<string, unknown>;
    if (!jackCollectedDataReadyForApplication(collectedData)) {
      res.status(422).json({
        error: 'Profile too thin for application draft',
        message: 'Заполните карьерный профиль в LEO: укажите роль, опыт или навыки в чате.',
      });
      return;
    }

    let jobResponse;
    try {
      jobResponse = await axios.get<JobDetailsPayload>(
        `${JOB_MATCHING_SERVICE_URL}/api/jobs/${jobId}`,
        {
          headers: { Authorization: bearer, 'X-Auth-Token': bearer },
          timeout: 12000,
        }
      );
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        res.status(404).json({ error: 'Job not found' });
        return;
      }
      throw error;
    }

    const { job, conditions } = jobResponse.data;
    const tone: ApplicationDraftTone = isApplicationDraftTone(body.tone) ? body.tone : 'neutral';

    const draft = await generateApplicationDraft({
      collectedData,
      job: {
        title: job.title,
        company: job.company,
        description: job.description ? stripHtmlFromText(job.description) : undefined,
        requirements: job.requirements ? stripHtmlFromText(job.requirements) : undefined,
        skills: job.skills,
        location: job.location,
        workMode: job.work_mode,
        conditions: conditions ?? job.source_meta ?? null,
      },
      tone,
      matchHighlights: Array.isArray(body.matchHighlights)
        ? body.matchHighlights.filter((item) => typeof item === 'string' && item.trim())
        : undefined,
      authToken: token,
    });

    res.json({
      jobId: job.id,
      coverLetter: draft.coverLetter,
      headline: draft.headline,
      bullets: draft.bullets,
      matchHighlights: body.matchHighlights ?? [],
      generatedAt: new Date().toISOString(),
      promptVersion: draft.promptVersion,
      regenerated: Boolean(body.regenerate),
    });
  } catch (error: unknown) {
    logger.error('Error creating application draft:', error);
    res.status(503).json({ error: 'Failed to generate application draft' });
  }
}
