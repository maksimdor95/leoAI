/**
 * Jobs Controller
 * Handles HTTP requests for job matching
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import { extractAccessToken } from '../utils/extractAccessToken';
import jobRepository, { resolveMatchScanLimit } from '../models/jobRepository';
import { getUserProfile, getCollectedDataWithFallback, CollectedData } from '../services/userService';
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
import { triggerScraping, scheduleLazyEnrichForMatchJobs } from '../services/scrapingQueue';
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
import { aggregateMissingSkillsTop } from '../services/aggregateMissingSkills';
import { findMissingSkillsMentionedInExperience } from '../services/experienceSignals';
import {
  buildMatchCacheKey,
  getCachedMatchPayload,
  hashMatchProfile,
  setCachedMatchPayload,
} from '../services/matchCache';
import {
  MATCH_RETURN_RECOMMENDED_MAX,
  MATCH_RETURN_WEAK_MAX,
  mapMatchForResponse,
  stripJobEmbeddings,
} from '../services/matchPayload';
import type { Job } from '../models/job';
import type { LlmRerankMeta } from '../services/llmRerank';

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

    // Cookie / X-Auth-Token / Bearer — тот же источник, что и authenticateToken
    const token = extractAccessToken(req) || '';
    const forceFresh =
      req.query.fresh === '1' ||
      req.query.fresh === 'true' ||
      req.query.refresh === '1' ||
      req.query.refresh === 'true';

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

    const catalogFp = await jobRepository.getCatalogFingerprint();
    const profileHash = hashMatchProfile(
      collectedData ? (collectedData as unknown as Record<string, unknown>) : null
    );
    const cacheKey = buildMatchCacheKey({
      userId,
      sessionId,
      profileHash,
      catalog: catalogFp,
    });

    if (!forceFresh) {
      const cached = await getCachedMatchPayload(cacheKey);
      if (cached && typeof cached === 'object') {
        logger.info(`[match] cache hit userId=${userId} key=${cacheKey.slice(0, 48)}…`);
        res.json({ ...(cached as Record<string, unknown>), matchCache: 'hit' });
        return;
      }
    }

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

    const jobsInDb = catalogFp.jobsInDb;
    const scanLimit = resolveMatchScanLimit(jobsInDb);

    // LEO Med: профиль медика (ветка в чате) матчится только против med-каталога,
    // IT-семейства и семантический добор здесь только шумят.
    const { isMedVerticalEnabled: medEnabled, resolveMedRoleIdFromCollected } = await import(
      '../services/med'
    );
    const medRoleId = medEnabled()
      ? resolveMedRoleIdFromCollected(collectedData as Record<string, unknown> | null)
      : null;
    let allJobs: Job[];

    if (medRoleId) {
      const medFeed = await jobRepository.findMedFeed({
        medRoleId,
        limit: Math.min(100, scanLimit),
      });
      allJobs = medFeed.jobs;
      logger.info(
        `[match] med profile userId=${userId} medRoleId=${medRoleId} candidates=${allJobs.length}/${medFeed.total}`
      );
    } else {
      const familyJobs = await jobRepository.findForMatch({
        primaryFamily: profileRoles.primary,
        adjacentFamilies: profileRoles.adjacent,
        limit: scanLimit,
      });

      // Layer 2: hybrid candidate set = family scan ∪ nearest by profile embedding
      allJobs = familyJobs;
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
    }

    // Не держим embedding-векторы в RAM на всём скане (если вдруг пришли).
    stripJobEmbeddings(allJobs);

    if (allJobs.length === 0) {
      const emptyPayload = {
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
        matchLayers: {
          llmRerank: {
            status: 'skipped',
            authPresent: Boolean(token),
            topN: 0,
            durationMs: 0,
            reason: 'empty_catalog',
          } satisfies LlmRerankMeta,
        },
        matchCache: 'miss',
        message: 'No jobs available. Please wait for job scraping to complete.',
      };
      res.json(emptyPayload);
      return;
    }

    const prefs = {
      location: userProfile.preferences?.location,
      workMode: userProfile.preferences?.workMode,
    };

    const { matches: matchedJobs, weakMatches, stats } = matchJobs(allJobs, collectedData, prefs);

    // Phase 3: lazy out-of-band enrich for cards shown without embeddings (non-blocking).
    scheduleLazyEnrichForMatchJobs([
      ...matchedJobs.map((m) => m.job),
      ...weakMatches.map((m) => m.job),
    ]);

    const effectiveForSignals = normalizeForMatch(collectedData);
    const missingSkillsPool = [...matchedJobs, ...weakMatches];
    const {
      missingSkillsTop,
      missingSkillsDetails,
      missingSkillsAmongTopN,
      missingSkillsTotalUnique,
    } = aggregateMissingSkillsTop(missingSkillsPool, {
      // Full current match set (not an arbitrary “top 20 sample”).
      amongTopN: Math.max(missingSkillsPool.length, 1),
      limit: 25,
      minCount: 35,
    });

    const missingPoolForExperience = aggregateMissingSkillsTop(missingSkillsPool, {
      amongTopN: Math.max(missingSkillsPool.length, 1),
      limit: 40,
      minCount: 0,
    });
    const skillsMentionedInExperience = effectiveForSignals
      ? findMissingSkillsMentionedInExperience(
          missingPoolForExperience.missingSkillsTop,
          effectiveForSignals as CollectedData,
          { limit: 6 }
        )
      : [];

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
      missingSkillsDetails,
      missingSkillsAmongTopN,
      missingSkillsTotalUnique,
      skillsMentionedInExperience,
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

    const { matches: rerankedRaw, meta: llmRerankMeta } = await llmRerankRecommended(
      prioritizedRecommended,
      collectedData,
      token
    );
    const rerankedRecommended = rerankedRaw.map((m, i) => ({ ...m, rank: i + 1 }));

    if (
      !catalogWarning &&
      stats.primaryFamily === 'unknown' &&
      rerankedRecommended.length === 0 &&
      matchedJobs.length > 0
    ) {
      catalogWarning = 'no_matches';
    }

    const prioritizedWeakRaw = filterWeakMatchesForPresentation(
      weakMatches,
      stats.primaryFamily,
      catalogWarning
    );
    const prioritizedWeak = prioritizedWeakRaw.map((m, i) => ({ ...m, rank: i + 1 }));

    const totalMatched = rerankedRecommended.length;
    const weakTierTotal = prioritizedWeak.length;
    const returnedJobs = rerankedRecommended.slice(0, MATCH_RETURN_RECOMMENDED_MAX);
    const returnedWeak = prioritizedWeak.slice(0, MATCH_RETURN_WEAK_MAX);

    logger.info(
      `[match] userId=${userId} jobsInDb=${jobsInDb} scanned=${allJobs.length} scanLimit=${scanLimit} ` +
        `aboveThreshold=${stats.aboveThreshold} weakTierTotal=${stats.weakTierTotal} ` +
        `returnedRecommended=${returnedJobs.length}/${totalMatched} returnedWeak=${returnedWeak.length}/${weakTierTotal} ` +
        `maxScore=${stats.maxScore} threshold=${MATCH_SCORE_THRESHOLD} ` +
        `weakFloor=${WEAK_MATCH_SCORE_FLOOR} primaryFamily=${stats.primaryFamily} ` +
        `familyRelevance=${(stats.familyRelevanceShare * 100).toFixed(1)}% ` +
        `llmRerank=${llmRerankMeta.status} authPresent=${llmRerankMeta.authPresent} ` +
        `rssMb=${Math.round(process.memoryUsage().rss / (1024 * 1024))}`
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

    const payload = {
      jobs: returnedJobs.map((match, i) => mapMatchForResponse(match, match.rank ?? i + 1)),
      count: returnedJobs.length,
      totalMatched,
      weakJobs: returnedWeak.map((match, i) => mapMatchForResponse(match, match.rank ?? i + 1)),
      weakCount: returnedWeak.length,
      weakTierTotal,
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
      matchLayers: {
        llmRerank: llmRerankMeta,
      },
      matchCache: forceFresh ? 'bypass' : 'miss',
      returnLimits: {
        recommendedMax: MATCH_RETURN_RECOMMENDED_MAX,
        weakMax: MATCH_RETURN_WEAK_MAX,
      },
    };

    await setCachedMatchPayload(cacheKey, payload);
    res.json(payload);
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
 * Phase 2: enqueue only — never call scrapeCatalog from the HTTP process path.
 */
export async function refreshJobs(_req: AuthRequest, res: Response): Promise<void> {
  try {
    logger.info('Manual generic job scraping enqueued');
    await triggerScraping({ origin: 'manual' });

    res.json({
      message: 'Job scraping enqueued',
      note: 'Worker picks up the job. Check logs for progress.',
    });
  } catch (error: unknown) {
    logger.error('Error triggering job scraping:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Phase 0/2: extended-only catalog fill (no HH/SJ) via queue.
 * Auth: same as /refresh (JOB_CATALOG_TOKEN in prod).
 */
export async function scrapeExtendedJobs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const body = (req.body || {}) as { keywords?: unknown; enrich?: unknown };
    const keywords = Array.isArray(body.keywords)
      ? body.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
      : undefined;
    const enrich = body.enrich === true;

    logger.info(
      `Manual extended-only scraping enqueued (enrich=${enrich}, keywords=${keywords?.length ?? 'default'})`
    );

    await triggerScraping({
      origin: 'extended-only',
      families: ['extended'],
      enrichExtended: enrich,
      keywords: keywords && keywords.length > 0 ? keywords : undefined,
    });

    res.json({
      message: 'Extended-only job scraping enqueued',
      note: 'Runs via Bull worker without HH/SJ. Check logs / catalog by source.',
      enrich,
      keywords: keywords && keywords.length > 0 ? keywords : 'DEFAULT_SEED_KEYWORDS',
    });
  } catch (error: unknown) {
    logger.error('Error triggering extended-only scraping:', error);
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

    const token = extractAccessToken(req) || '';
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

/**
 * GET /api/jobs/med/roles — nomenclature for LEO Med dropdown (Phase 1).
 */
export async function listMedRolesHandler(_req: Request, res: Response): Promise<void> {
  try {
    const { isMedVerticalEnabled, listMedRoles, getMedRolesCatalog } = await import(
      '../services/med'
    );
    if (!isMedVerticalEnabled()) {
      res.status(503).json({
        error: 'LEO Med vertical is disabled',
        code: 'MED_VERTICAL_OFF',
        hint: 'Set ENABLE_MED_VERTICAL=true',
      });
      return;
    }
    const catalog = getMedRolesCatalog();
    res.json({
      levels: catalog.levels,
      source: catalog.source,
      roles: listMedRoles().map((r) => ({
        id: r.id,
        level: r.level,
        title: r.title,
        hiring_closed_from: r.hiring_closed_from,
      })),
    });
  } catch (error: unknown) {
    logger.error('Error listing med roles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/jobs/med/map-role — free-text role → med role + taxonomy prefill.
 * Used by the chat (conversation service) to branch a candidate into LEO Med.
 * Query: title.
 */
export async function mapMedRoleHandler(req: Request, res: Response): Promise<void> {
  try {
    const {
      isMedVerticalEnabled,
      mapVacancyToMedRole,
      rankMedTaxonomyItemsForPrefill,
      resolveMedTaxonomyForRole,
      MED_UNKNOWN_ROLE_ID,
    } = await import('../services/med');

    if (!isMedVerticalEnabled()) {
      res.status(503).json({
        error: 'LEO Med vertical is disabled',
        code: 'MED_VERTICAL_OFF',
        hint: 'Set ENABLE_MED_VERTICAL=true',
      });
      return;
    }

    const title =
      typeof req.query.title === 'string' && req.query.title.trim()
        ? req.query.title.trim()
        : '';
    if (!title) {
      res.status(400).json({ error: 'title is required' });
      return;
    }

    const match = mapVacancyToMedRole(title);
    const isMed = match.med_role_id !== MED_UNKNOWN_ROLE_ID;
    const taxonomy = isMed ? resolveMedTaxonomyForRole(match.med_role_id, match.title) : null;

    res.json({
      is_med: isMed,
      med_role_id: isMed ? match.med_role_id : null,
      role_title: match.title,
      level: match.level,
      confidence: match.confidence,
      prefill: taxonomy
        ? {
            // Профессионально-специфичные пункты идут первыми — чат берёт верхушку списка.
            skills: rankMedTaxonomyItemsForPrefill(taxonomy.skills).map((s) => ({
              id: s.id,
              label: s.label,
              core: s.core === true,
            })),
            duties: rankMedTaxonomyItemsForPrefill(taxonomy.duties).map((d) => ({
              id: d.id,
              label: d.label,
              core: d.core === true,
            })),
            disclaimer: taxonomy.disclaimer,
          }
        : null,
    });
  } catch (error: unknown) {
    logger.error('Error mapping med role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/jobs/med/feed — vacancies by profession (+ optional city).
 * Query: role_id, level, city, limit, offset.
 */
export async function getMedFeed(req: Request, res: Response): Promise<void> {
  try {
    const { isMedVerticalEnabled } = await import('../services/med');
    if (!isMedVerticalEnabled()) {
      res.status(503).json({
        error: 'LEO Med vertical is disabled',
        code: 'MED_VERTICAL_OFF',
        hint: 'Set ENABLE_MED_VERTICAL=true',
      });
      return;
    }

    const roleId =
      typeof req.query.role_id === 'string' && req.query.role_id.trim()
        ? req.query.role_id.trim()
        : undefined;
    const level =
      typeof req.query.level === 'string' && req.query.level.trim()
        ? req.query.level.trim()
        : undefined;
    const city =
      typeof req.query.city === 'string' && req.query.city.trim()
        ? req.query.city.trim()
        : undefined;
    const limitParsed = parseInt(String(req.query.limit ?? '30'), 10);
    const offsetParsed = parseInt(String(req.query.offset ?? '0'), 10);

    const { jobs, total } = await jobRepository.findMedFeed({
      medRoleId: roleId,
      level,
      city,
      limit: Number.isFinite(limitParsed) ? limitParsed : 30,
      offset: Number.isFinite(offsetParsed) ? offsetParsed : 0,
    });

    res.json({
      jobs,
      total,
      count: jobs.length,
      filters: { role_id: roleId ?? null, level: level ?? null, city: city ?? null },
    });
  } catch (error: unknown) {
    logger.error('Error fetching med feed:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/jobs/med/taxonomy
 * Query: role_id (med_roles id) | title | level
 */
export async function getMedTaxonomy(req: Request, res: Response): Promise<void> {
  try {
    const {
      isMedVerticalEnabled,
      getTaxonomyByMedRoleId,
      getTaxonomyBySourceTitle,
      listTaxonomiesForLevel,
      getMedTaxonomyCatalog,
      getMedTaxonomyDisclaimer,
    } = await import('../services/med');

    if (!isMedVerticalEnabled()) {
      res.status(503).json({
        error: 'LEO Med vertical is disabled',
        code: 'MED_VERTICAL_OFF',
        hint: 'Set ENABLE_MED_VERTICAL=true',
      });
      return;
    }

    const roleId =
      typeof req.query.role_id === 'string' && req.query.role_id.trim()
        ? req.query.role_id.trim()
        : undefined;
    const title =
      typeof req.query.title === 'string' && req.query.title.trim()
        ? req.query.title.trim()
        : undefined;
    const levelRaw =
      typeof req.query.level === 'string' && req.query.level.trim()
        ? req.query.level.trim()
        : undefined;

    if (roleId) {
      const taxonomy = getTaxonomyByMedRoleId(roleId);
      if (!taxonomy) {
        res.status(404).json({ error: 'Taxonomy not found for role_id', role_id: roleId });
        return;
      }
      res.json({ taxonomy, disclaimer: taxonomy.disclaimer });
      return;
    }

    if (title) {
      const taxonomy = getTaxonomyBySourceTitle(title);
      if (!taxonomy) {
        res.status(404).json({ error: 'Taxonomy not found for title', title });
        return;
      }
      res.json({ taxonomy, disclaimer: taxonomy.disclaimer });
      return;
    }

    if (levelRaw === 'doctor' || levelRaw === 'mid' || levelRaw === 'junior') {
      const list = listTaxonomiesForLevel(levelRaw);
      res.json({
        level: levelRaw,
        count: list.length,
        disclaimer: getMedTaxonomyDisclaimer(),
        taxonomies: list,
      });
      return;
    }

    const catalog = getMedTaxonomyCatalog();
    res.json({
      disclaimer: catalog.disclaimer,
      stats: catalog.stats,
      provenance_default: catalog.provenance_default,
      hint: 'Pass role_id, title, or level=doctor|mid|junior',
    });
  } catch (error: unknown) {
    logger.error('Error fetching med taxonomy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/jobs/med/profiles — complete LEO Med specialist profile (Phase 3).
 * Requires consent_a=true. Consent B optional / not required for metric N.
 */
export async function createMedProfile(req: Request, res: Response): Promise<void> {
  try {
    const {
      isMedVerticalEnabled,
      validateMedSpecialistInput,
      createMedSpecialist,
      countCompletedMedProfilesWithConsentA,
      CONSENT_A_VERSION,
    } = await import('../services/med');

    if (!isMedVerticalEnabled()) {
      res.status(503).json({
        error: 'LEO Med vertical is disabled',
        code: 'MED_VERTICAL_OFF',
        hint: 'Set ENABLE_MED_VERTICAL=true',
      });
      return;
    }

    const parsed = validateMedSpecialistInput(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error.message, code: parsed.error.code });
      return;
    }

    const profile = await createMedSpecialist(parsed.value);
    const n = await countCompletedMedProfilesWithConsentA();

    res.status(201).json({
      profile,
      metric: {
        completed_with_consent_a: n,
        milestones: { smoke: 10, signal: 50, confident: 100 },
      },
      consent_a_version: CONSENT_A_VERSION,
      note: 'consent_b is optional and not part of Phase 3 metric N',
    });
  } catch (error: unknown) {
    logger.error('Error creating med profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/jobs/med/profiles/stats — metric N (completed + consent A).
 */
export async function getMedProfileStats(_req: Request, res: Response): Promise<void> {
  try {
    const { isMedVerticalEnabled, countCompletedMedProfilesWithConsentA } = await import(
      '../services/med'
    );
    if (!isMedVerticalEnabled()) {
      res.status(503).json({
        error: 'LEO Med vertical is disabled',
        code: 'MED_VERTICAL_OFF',
        hint: 'Set ENABLE_MED_VERTICAL=true',
      });
      return;
    }
    const n = await countCompletedMedProfilesWithConsentA();
    res.json({
      completed_with_consent_a: n,
      milestones: { smoke: 10, signal: 50, confident: 100 },
    });
  } catch (error: unknown) {
    logger.error('Error fetching med profile stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /api/jobs/med/profiles/:id
 */
export async function getMedProfile(req: Request, res: Response): Promise<void> {
  try {
    const { isMedVerticalEnabled, getMedSpecialistById } = await import('../services/med');
    if (!isMedVerticalEnabled()) {
      res.status(503).json({
        error: 'LEO Med vertical is disabled',
        code: 'MED_VERTICAL_OFF',
        hint: 'Set ENABLE_MED_VERTICAL=true',
      });
      return;
    }
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : '';
    if (!id) {
      res.status(400).json({ error: 'id required' });
      return;
    }
    const profile = await getMedSpecialistById(id);
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }
    res.json({ profile });
  } catch (error: unknown) {
    logger.error('Error fetching med profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * POST /api/jobs/scrape/med — enqueue Med ingest (HH+SJ+active TG).
 */
export async function scrapeMedJobs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { isMedVerticalEnabled } = await import('../services/med');
    if (!isMedVerticalEnabled()) {
      res.status(503).json({
        error: 'LEO Med vertical is disabled',
        code: 'MED_VERTICAL_OFF',
        hint: 'Set ENABLE_MED_VERTICAL=true',
      });
      return;
    }

    const body = (req.body || {}) as { keywords?: unknown; includeTg?: unknown };
    const keywords = Array.isArray(body.keywords)
      ? body.keywords.filter((k): k is string => typeof k === 'string' && k.trim().length > 0)
      : undefined;
    const includeTg = body.includeTg !== false;

    await triggerScraping({
      origin: 'med-only',
      keywords: keywords && keywords.length > 0 ? keywords : undefined,
      includeTg,
    });

    res.json({
      message: 'Med job scraping enqueued',
      note: 'Worker runs HH+SJ medicine keywords + active Med TG. Jobs tagged med_role_id.',
      includeTg,
      keywords: keywords && keywords.length > 0 ? keywords : 'buildMedScrapeKeywords()',
    });
  } catch (error: unknown) {
    logger.error('Error triggering med scraping:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
