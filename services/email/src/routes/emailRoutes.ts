/**
 * Email Routes
 * API routes for email notification endpoints
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as emailController from '../controllers/emailController';

const router = Router();

/**
 * POST /api/email/send-jobs
 * Send jobs digest email
 */
router.post('/send-jobs', authenticateToken, emailController.sendJobs);

/**
 * POST /api/email/send-welcome
 * Send welcome email
 */
router.post('/send-welcome', authenticateToken, emailController.sendWelcome);

export default router;
