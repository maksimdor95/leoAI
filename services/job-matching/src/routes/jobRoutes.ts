/**
 * Job Routes
 * API routes for job matching endpoints
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as jobsController from '../controllers/jobsController';

const router = Router();

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
 * Trigger job scraping (for development/admin)
 */
router.post('/refresh', authenticateToken, jobsController.refreshJobs);

export default router;
