/**
 * Jobs Controller
 * Handles HTTP requests for job matching
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import jobRepository, { resolveMatchScanLimit } from '../models/jobRepository';
import { getUserProfile, getCollectedDataWithFallback } from '../services/userService';
import {
  matchJobs,
  MATCH_SCORE_THRESHOLD,
  WEAK_MATCH_SCORE_FLOOR,
  HEALTHY_FAMILY_SHARE,
  filterWeakMatchesForPresentation,
  filterRecommendedMatchesForPresentation,
  normalizeForMatch,
} from '../services/matcher';
import { classifyProfileRoles, familyLabelRu } from '../services/roleFamily';
import { scrapeHHJobs } from '../services/scraper';
import { triggerScraping } from '../services/scrapingQueue';
import { deriveScrapeParams } from '../services/scrapeProfileParams';
import {
  getSalaryEvaluation,
  HHSalaryApiError,
  HH_OPENAPI_REDOC,
} from '../services/hhSalaryService';
import { logger } from '../utils/logger';
import {
  buildJobDetailsPayload,
  jobNeedsHhMetaRefresh,
  refreshJobFromHh,
} from '../services/jobDetailsService';
import { ensureProfileEmbedding } from '../services/profileEmbedding';
import { llmRerankRecommended } from '../services/llmRerank';
import type { Job } from '../models/job';

const CATALOG_MAX_LIMIT = 200;

/**
 * GET /api/jobs/catalog — list jobs stored in DB (admin / debugging).
 * Query: source (e.g. superjob.ru), limit (default 50, max 200), offset.
 */
export async function listJobCatalog(req: Request, res: Response): Promise<void> {
  try {
    const sourceRaw = req.query.source;
    const source =
      typeof sourceRaw === 'string' && sourceRaw.trim() ? sourceRaw.trim() : undefined;

    const limitParsed = parseInt(String(req.query.limit ?? '50'), 10);
    const limit = Math.min(
      CATALOG_MAX_LIMIT,
      Math.max(1, Number.isFinite(limitParsed) ? limitParsed : 50)
    );
    const offsetParsed = parseInt(String(req.query.offset ?? '0'), 10);
    const offset = Math.max(0, Number.isFinite(offsetParsed) ? offsetParsed : 0);

    const [jobs, total] = await Promise.all([
      jobRepository.findAll({ source, limit, offset }),
      jobRepository.count({ source }),
    ]);

    res.json({
      jobs,
      total,
      limit,
      offset,
      count: jobs.length,
    });
  } catch (error: unknown) {
    logger.error('Error listing job catalog:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get matched jobs for a user
 */
export async function getMatchedJobs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.params.userId;
    const user = req.user;

    if (!user || user.userId !== userId) {
      res.status(403).json({ error: 'Forbidden: Cannot access other user data' });
      return;
    }

    // Get auth token from request
    const token = req.headers.authorization?.replace('Bearer ', '') || '';

    // Get user profile (preferences optional — matching works from collectedData)
    let userProfile: Awaited<ReturnType<typeof getUserProfile>>;
    try {
      userProfile = await getUserProfile(token);
    } catch (error: unknown) {
      logger.warn('Failed to get user profile, continuing with session data only:', error);
      userProfile = {
        id: userId,
        email: user.email,
      };
    }

    // Get collected data from session (explicit sessionId from chat UI, else active session)
    const sessionId =
      typeof req.query.sessionId === 'string' && req.query.sessionId.trim()
        ? req.query.sessionId.trim()
        : undefined;
    const collectedData = await getCollectedDataWithFallback(userId, token, sessionId);
    await ensureProfileEmbedding(collectedData, token);

    const effectiveProfile = normalizeForMatch(collectedData);
    const profileRoles = effectiveProfile
      ? classifyProfileRoles({
          desiredRole:
            effectiveProfile.desiredRole ||
            (effectiveProfile.desired_role as string | undefined),
          positionRoles: Array.from({ length: 5 }, (_, i) => {
            const v = effectiveProfile[`position_${i + 1}_role` as keyof typeof effectiveProfile];
            return typeof v === 'string' ? v : null;
          }),
          careerSummary:
            typeof effectiveProfile.careerSummary === 'string'
              ? effectiveProfile.careerSummary
              : null,
        })
      : { primary: 'unknown' as const, adjacent: [], detected: [] };

    const jobsInDb = await jobRepository.count();
    const scanLimit = resolveMatchScanLimit(jobsInDb);
    const familyJobs = await jobRepository.findForMatch({
      primaryFamily: profileRoles.primary,
      adjacentFamilies: profileRoles.adjacent,
      limit: scanLimit,
    });

    // Layer 2: hybrid candidate set = family scan ∪ nearest by profile embedding
    let allJobs: Job[] = familyJobs;
    const profileEmbedding = collectedData?.embedding;
    if (Array.isArray(profileEmbedding) && profileEmbedding.length > 0) {
      const semanticJobs = await jobRepository.findNearestByEmbedding(
        profileEmbedding,
        Math.min(150, scanLimit)
      );
      if (semanticJobs.length > 0) {
        const byId = new Map<string, Job>();
        for (const job of familyJobs) byId.set(job.id, job);
        for (const job of semanticJobs) {
          if (!byId.has(job.id)) byId.set(job.id, job);
        }
        allJobs = [...byId.values()];
        logger.info(
          `Hybrid match candidates: family=${familyJobs.length}, semantic=${semanticJobs.length}, merged=${allJobs.length}`
        );
      }
    }

    if (allJobs.length === 0) {
      res.json({
        jobs: [],
        count: 0,
        totalMatched: 0,
        jobsInDb,
        jobsScanned: 0,
        maxMatchScore: 0,
        matchThreshold: MATCH_SCORE_THRESHOLD,
        weakJobs: [],
        weakCount: 0,
        weakTierTotal: 0,
        weakMatchFloor: WEAK_MATCH_SCORE_FLOOR,
        catalogWarning: 'empty_catalog',
        profileFamily: null,
        profileFamilyLabel: null,
        message: 'No jobs available. Please wait for job scraping to complete.',
      });
      return;
    }

    const prefs = {
      location: userProfile.preferences?.location,
      workMode: userProfile.preferences?.workMode,
    };

    const { matches: matchedJobs, weakMatches, stats } = matchJobs(allJobs, collectedData, prefs);

    const effectiveForSignals = normalizeForMatch(collectedData);
    const missingSkillsTop = (() => {
      const counts = new Map<string, number>();
      for (const m of [...matchedJobs, ...weakMatches].slice(0, 20)) {
        for (const skill of m.missingSkills ?? []) {
          counts.set(skill, (counts.get(skill) ?? 0) + 1);
        }
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([skill]) => skill);
    })();

    const profileSignals = {
      role_family: stats.primaryFamily !== 'unknown' ? stats.primaryFamily : null,
      seniority:
        effectiveForSignals &&
        typeof (effectiveForSignals as Record<string, unknown>).__enriched === 'object'
          ? (
              (effectiveForSignals as Record<string, unknown>).__enriched as {
                seniority?: string;
              }
            ).seniority ?? null
          : null,
      missingSkillsTop,
    };

    // Диагностика каталога: если пользователь классифицирован, а его семейство
    // и смежные занимают меньше HEALTHY_FAMILY_SHARE от всего каталога —
    // вероятнее всего scraper собран под другой профиль (например, dev-кейворды
    // для PM-кандидата). Клиенту вернём warning, чтобы показать плашку
    // «запустите сбор свежих вакансий по вашему профилю».
    let catalogWarning: string | null = null;
    if (
      stats.primaryFamily !== 'unknown' &&
      stats.familyRelevanceShare < HEALTHY_FAMILY_SHARE
    ) {
      catalogWarning = 'catalog_family_mismatch';
    } else if (stats.aboveThreshold === 0 && stats.weakTierTotal === 0) {
      catalogWarning = 'no_matches';
    }

    const prioritizedRecommended = filterRecommendedMatchesForPresentation(
      matchedJobs,
      stats.primaryFamily
    );

    const rerankedRecommended = await llmRerankRecommended(
      prioritizedRecommended,
      collectedData,
      token
    );

    if (
      !catalogWarning &&
      stats.primaryFamily === 'unknown' &&
      rerankedRecommended.length === 0 &&
      matchedJobs.length > 0
    ) {
      catalogWarning = 'no_matches';
    }

    const prioritizedWeak = filterWeakMatchesForPresentation(
      weakMatches,
      stats.primaryFamily,
      catalogWarning
    );

    const returnedJobs = rerankedRecommended;
    const returnedWeak = prioritizedWeak;

    logger.info(
      `[match] userId=${userId} jobsInDb=${jobsInDb} scanned=${allJobs.length} scanLimit=${scanLimit} ` +
        `aboveThreshold=${stats.aboveThreshold} weakTierTotal=${stats.weakTierTotal} ` +
        `returnedRecommended=${returnedJobs.length} returnedWeak=${returnedWeak.length} maxScore=${stats.maxScore} threshold=${MATCH_SCORE_THRESHOLD} ` +
        `weakFloor=${WEAK_MATCH_SCORE_FLOOR} primaryFamily=${stats.primaryFamily} ` +
        `familyRelevance=${(stats.familyRelevanceShare * 100).toFixed(1)}%`
    );

    if (stats.aboveThreshold === 0 && stats.weakTierTotal === 0 && jobsInDb > 0) {
      logger.warn(
        `[match] no jobs in recommended or weak tier; maxScore=${stats.maxScore} (floors: weak ${WEAK_MATCH_SCORE_FLOOR}, rec ${MATCH_SCORE_THRESHOLD})`
      );
    }

    if (catalogWarning) {
      // Trigger background scraping for this user
      const params = deriveScrapeParams(collectedData);
      triggerScraping({
        origin: 'user-profile',
        userId,
        keywords: params.keywords.length > 0 ? params.keywords : undefined,
        locationId: params.locationId,
      }).catch((err: unknown) => logger.error('Failed to trigger background scraping:', err));
    }

    res.json({
      jobs: returnedJobs.map((match) => ({
        job: match.job,
        score: match.score,
        reasons: match.reasons,
        jobFamily: match.jobFamily,
        familyMatch: match.familyMatch,
        demoteReasons: match.demoteReasons ?? null,
      })),
      count: returnedJobs.length,
      totalMatched: returnedJobs.length,
      weakJobs: returnedWeak.map((match) => ({
        job: match.job,
        score: match.score,
        reasons: match.reasons,
        jobFamily: match.jobFamily,
        familyMatch: match.familyMatch,
        demoteReasons: match.demoteReasons ?? null,
      })),
      weakCount: returnedWeak.length,
      weakTierTotal: returnedWeak.length,
      weakMatchFloor: WEAK_MATCH_SCORE_FLOOR,
      jobsInDb,
      jobsScanned: allJobs.length,
      maxMatchScore: stats.maxScore,
      matchThreshold: MATCH_SCORE_THRESHOLD,
      profileFamily: stats.primaryFamily,
      profileFamilyLabel:
        stats.primaryFamily !== 'unknown' ? familyLabelRu(stats.primaryFamily) : null,
      adjacentFamilies: stats.adjacentFamilies,
      familyRelevanceShare: Number(stats.familyRelevanceShare.toFixed(3)),
      familyCatalogCount: stats.familyCatalogCount,
      familyDistribution: stats.familyDistribution,
      catalogWarning,
      profileSignals,
    });
  } catch (error: unknown) {
    logger.error('Error getting matched jobs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get job details by ID
 */
export async function getJobDetails(req: AuthRequest, res: Response): Promise<void> {
  try {
    const jobId = req.params.jobId;
    const refreshRaw = req.query.refresh;
    const shouldRefresh = refreshRaw === '1' || refreshRaw === 'true';

    let job = await jobRepository.findById(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    if (shouldRefresh && job.source === 'hh.ru') {
      const refreshed = await refreshJobFromHh(job);
      if (refreshed) {
        job = refreshed;
      }
    } else if (jobNeedsHhMetaRefresh(job)) {
      const refreshed = await refreshJobFromHh(job);
      if (refreshed) {
        job = refreshed;
      }
    }

    res.json(buildJobDetailsPayload(job));
  } catch (error: unknown) {
    logger.error('Error getting job details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Trigger generic job scraping (diverse seed keyword set).
 * Оставлено для обратной совместимости: admin-кнопка «пересобрать каталог».
 * Для релевантного пользователю подбора используйте `scrapeForUser`.
 */
export async function refreshJobs(_req: AuthRequest, res: Response): Promise<void> {
  try {
    logger.info('Manual generic job scraping triggered');

    scrapeHHJobs()
      .then((result) => {
        if (result.mockJobsUsed) {
          logger.warn('⚠️  Job scraping completed using MOCK DATA');
        } else {
          logger.info('✅ Job scraping completed successfully');
        }
        logger.info(
          `   Sources=${result.sourcesUsed.join(', ')} scraped=${result.jobsScraped} saved=${result.jobsSaved}`
        );
        if (result.errors.length > 0) {
          logger.warn(`   Errors: ${result.errors.join('; ')}`);
        }
      })
      .catch((error) => {
        logger.error('Job scraping failed:', error);
      });

    res.json({
      message: 'Job scraping started',
      note: 'Scraping runs in background. Check logs for progress.',
    });
  } catch (error: unknown) {
    logger.error('Error triggering job scraping:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Trigger per-user scraping: берём профиль пользователя, определяем
 * role-family и запрашиваем источники по релевантным ключевым словам.
 *
 * Защита: вызывать можно только самому пользователю. Внутренние сервисы
 * (conversation, когда триггерит автосбор на шаге desired_role) проходят
 * тот же JWT-пайплайн и передают токен пользователя.
 */
export async function scrapeForUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const userId = req.params.userId || req.user?.userId;
    if (!userId) {
      res.status(400).json({ error: 'userId is required' });
      return;
    }
    if (!req.user || req.user.userId !== userId) {
      res.status(403).json({ error: 'Forbidden: Cannot trigger scrape for other user' });
      return;
    }

    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    const collectedData = await getCollectedDataWithFallback(userId, token);
    const params = deriveScrapeParams(collectedData);

    if (params.keywordSource === 'fallback' || params.keywords.length === 0) {
      logger.warn(
        `[scrapeForUser] userId=${userId}: profile not yet classified (${params.familyPrimary}); ` +
          `skipping per-user scrape and using generic seed instead`
      );
      await triggerScraping({ origin: 'user-profile', userId });
      res.json({
        message: 'Scraping enqueued with default seed (profile too thin to classify)',
        familyPrimary: params.familyPrimary,
        usedProfileKeywords: false,
      });
      return;
    }

    await triggerScraping({
      origin: 'user-profile',
      userId,
      keywords: params.keywords,
      locationId: params.locationId,
    });

    logger.info(
      `[scrapeForUser] userId=${userId} family=${params.familyPrimary} ` +
        `location=${params.locationId} keywords=${params.keywords.length}`
    );

    res.json({
      message: 'Profile-driven scraping enqueued',
      familyPrimary: params.familyPrimary,
      familyAdjacent: params.familyAdjacent,
      locationId: params.locationId,
      keywords: params.keywords,
      usedProfileKeywords: true,
    });
  } catch (error: unknown) {
    logger.error('Error triggering per-user scraping:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/jobs/hh/salary-evaluation/:areaId
 * Proxy to HH salary bank API with service-side auth.
 */
export async function getHHSalaryEvaluation(req: Request, res: Response): Promise<void> {
  try {
    const areaId = parseInt(req.params.areaId, 10);
    if (!Number.isInteger(areaId) || areaId <= 0) {
      res.status(400).json({
        source: 'hh.ru',
        endpoint: '/salary_statistics/paid/salary_evaluation/:areaId',
        client: {
          code: 'HH_SALARY_INVALID_AREA_ID',
          message: 'Параметр areaId в пути должен быть положительным целым числом (код региона в справочнике salary areas HH).',
        },
        hints: { openapi_redoc: HH_OPENAPI_REDOC },
      });
      return;
    }

    const safeQuery: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        safeQuery[key] = value;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        safeQuery[key] = value;
      } else if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
        safeQuery[key] = value[0];
      }
    }

    // OpenAPI: extend_sources — boolean; из query приходит строка "true" / "false".
    const ext = safeQuery.extend_sources;
    if (typeof ext === 'string') {
      const lower = ext.toLowerCase();
      if (lower === 'true' || lower === '1') {
        safeQuery.extend_sources = true;
      } else if (lower === 'false' || lower === '0') {
        safeQuery.extend_sources = false;
      }
    }

    const data = await getSalaryEvaluation(areaId, safeQuery);
    res.json({
      source: 'hh.ru',
      endpoint: '/salary_statistics/paid/salary_evaluation/:areaId',
      areaId,
      data,
    });
  } catch (error: unknown) {
    if (error instanceof HHSalaryApiError) {
      logger.warn(
        `HH salary evaluation upstream error: status=${error.statusCode} code=${(error.body.client as { code?: string })?.code ?? 'n/a'}`
      );
      res.status(error.statusCode).json(error.body);
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    logger.error('Error fetching HH salary evaluation:', message);

    if (message.includes('Failed to obtain HH access token')) {
      res.status(503).json({
        source: 'hh.ru',
        endpoint: '/salary_statistics/paid/salary_evaluation/:areaId',
        areaId: parseInt(req.params.areaId, 10),
        hh: { status: null },
        client: {
          code: 'HH_OAUTH_TOKEN_UNAVAILABLE',
          message:
            'Не удалось получить OAuth токен HH (проверьте HH_ACCESS_TOKEN, refresh_token или client_credentials в конфигурации job-matching).',
        },
      });
      return;
    }

    res.status(502).json({
      source: 'hh.ru',
      endpoint: '/salary_statistics/paid/salary_evaluation/:areaId',
      areaId: parseInt(req.params.areaId, 10),
      hh: { status: null },
      client: {
        code: 'HH_SALARY_GATEWAY_ERROR',
        message: 'Не удалось обратиться к HH salary API.',
      },
      details: message,
    });
  }
}
