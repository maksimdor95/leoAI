/**
 * Job Routes
 * API routes for job matching endpoints
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireJobCatalogAccess } from '../middleware/jobCatalogAuth';
import * as jobsController from '../controllers/jobsController';
import { getViewedJobIds, recordInteraction } from '../controllers/telemetryController';

const router = Router();

/**
 * POST /api/jobs/interaction
 * Record user interaction with a job
 */
router.post('/interaction', authenticateToken, recordInteraction);

/**
 * GET /api/jobs/interactions/viewed
 * Job ids the user has opened in the vacancy preview (interaction_type = view).
 */
router.get('/interactions/viewed', authenticateToken, getViewedJobIds);

/**
 * GET /api/jobs/catalog
 * List jobs in DB (filter by source, pagination). Register before /:jobId.
 */
router.get('/catalog', requireJobCatalogAccess, jobsController.listJobCatalog);

/**
 * GET /api/jobs/hh/salary-evaluation/:areaId
 * HH salary bank proxy (protected with admin/debug token middleware).
 */
router.get(
  '/hh/salary-evaluation/:areaId',
  requireJobCatalogAccess,
  jobsController.getHHSalaryEvaluation
);

/**
 * GET /api/jobs/match/:userId
 * Get matched jobs for a user
 */
router.get('/match/:userId', authenticateToken, jobsController.getMatchedJobs);

/**
 * GET /api/jobs/:jobId
 * Get job details by ID
 */
router.get('/:jobId', authenticateToken, jobsController.getJobDetails);

/**
 * POST /api/jobs/refresh
 * Trigger generic job scraping (diverse seed). Для админ-обновления каталога.
 */
router.post('/refresh', requireJobCatalogAccess, jobsController.refreshJobs);

/**
 * POST /api/jobs/scrape/for-user/:userId
 * Триггер сбора вакансий по профилю пользователя (role-family + skills).
 * Использует собственный токен пользователя; conversation-service вызывает
 * это при завершении шага `desired_role`.
 */
router.post('/scrape/for-user/:userId', authenticateToken, jobsController.scrapeForUser);

export default router;
