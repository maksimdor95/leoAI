/**
 * Email Routes
 * API routes for email notification endpoints
 */

import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import * as emailController from '../controllers/emailController';
import { consultationRateLimit } from '../middleware/ipRateLimit';

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

/**
 * POST /api/email/send-resume-package
 * Send resume + cover letter email
 */
router.post('/send-resume-package', authenticateToken, emailController.sendResumePackage);

/**
 * POST /api/email/send-consultation
 * Public consultation lead from support widget
 */
router.post('/send-consultation', consultationRateLimit, emailController.sendConsultation);

/**
 * POST /api/email/send-password-reset
 * Password reset link (internal — user-profile service)
 */
router.post('/send-password-reset', emailController.sendPasswordReset);

export default router;
