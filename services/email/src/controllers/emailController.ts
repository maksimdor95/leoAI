/**
 * Email Controller
 * Handles HTTP requests for email notifications
 */

import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  sendWelcomeEmail,
  sendJobsDigestEmail,
  sendResumePackageEmail,
  sendConsultationEmail,
  sendPasswordResetEmail,
} from '../services/emailService';
import { getUserProfile } from '../services/userService';
import { getJobsByIds } from '../services/jobService';
import { logger } from '../utils/logger';

/**
 * Send jobs digest email to user
 */
export async function sendJobs(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { jobIds } = req.body;

    if (!jobIds || !Array.isArray(jobIds) || jobIds.length === 0) {
      res.status(400).json({ error: 'jobIds array is required' });
      return;
    }

    // Get auth token
    const token = req.headers.authorization?.replace('Bearer ', '') || '';

    // Get user profile
    let userProfile;
    try {
      userProfile = await getUserProfile(token);
    } catch (error: unknown) {
      logger.error('Failed to get user profile:', error);
      res.status(500).json({ error: 'Failed to get user profile' });
      return;
    }

    // Get job details
    const jobs = await getJobsByIds(jobIds, token);
    if (jobs.length === 0) {
      res.status(404).json({ error: 'No jobs found' });
      return;
    }

    // Format jobs with scores (assuming all jobs are matched)
    const matchedJobs = jobs.map((job) => ({
      job,
      score: 80, // Default score, in production this would come from matching service
      reasons: ['Вакансия подходит по критериям'],
    }));

    // Send email
    const success = await sendJobsDigestEmail(userProfile.email, userProfile.name, matchedJobs);

    if (success) {
      res.json({
        success: true,
        message: 'Email sent successfully',
        jobsCount: matchedJobs.length,
      });
    } else {
      res.status(500).json({ error: 'Failed to send email' });
    }
  } catch (error: unknown) {
    logger.error('Error sending jobs email:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Send welcome email to user
 */
export async function sendWelcome(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: 'email is required' });
      return;
    }

    // Get auth token
    const token = req.headers.authorization?.replace('Bearer ', '') || '';

    // Get user profile for name
    let userName: string | undefined;
    try {
      const userProfile = await getUserProfile(token);
      userName = userProfile.name;
    } catch (error: unknown) {
      logger.warn('Failed to get user profile for welcome email:', error);
      // Continue without name
    }

    // Send welcome email
    const success = await sendWelcomeEmail(email, userName);

    if (success) {
      res.json({
        success: true,
        message: 'Welcome email sent successfully',
      });
    } else {
      res.status(500).json({ error: 'Failed to send welcome email' });
    }
  } catch (error: unknown) {
    logger.error('Error sending welcome email:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function sendResumePackage(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const { resume, coverLetter, recipientEmail } = req.body as {
      resume?: string;
      coverLetter?: string;
      recipientEmail?: string;
    };
    if (!resume || typeof resume !== 'string') {
      res.status(400).json({ error: 'resume is required' });
      return;
    }
    if (!coverLetter || typeof coverLetter !== 'string') {
      res.status(400).json({ error: 'coverLetter is required' });
      return;
    }

    const targetEmail = (typeof recipientEmail === 'string' && recipientEmail.includes('@'))
      ? recipientEmail.trim()
      : user.email;

    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    let userName: string | undefined;
    try {
      const userProfile = await getUserProfile(token);
      userName = userProfile.name;
    } catch (error: unknown) {
      logger.warn('Failed to get user profile for resume package email:', error);
    }

    const success = await sendResumePackageEmail({
      userEmail: targetEmail,
      userName,
      resume,
      coverLetter,
    });

    if (success) {
      res.json({
        success: true,
        email: targetEmail,
        message: 'Resume package email sent successfully',
      });
    } else {
      res.status(500).json({ error: 'Failed to send resume package email' });
    }
  } catch (error: unknown) {
    logger.error('Error sending resume package email:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Публичная заявка на консультацию с виджета поддержки (без авторизации).
 */
export async function sendConsultation(req: Request, res: Response): Promise<void> {
  try {
    const { name, email, phone, service, message, consent, source, sourceUrl } = req.body as {
      name?: string;
      email?: string;
      phone?: string;
      service?: string;
      message?: string;
      consent?: boolean;
      source?: string;
      sourceUrl?: string;
    };

    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'message is required' });
      return;
    }

    if (consent !== true) {
      res.status(400).json({ error: 'consent is required' });
      return;
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length > 5000) {
      res.status(400).json({ error: 'message is too long' });
      return;
    }

    const success = await sendConsultationEmail({
      name: typeof name === 'string' ? name.trim().slice(0, 200) : undefined,
      email: typeof email === 'string' ? email.trim().slice(0, 320) : undefined,
      phone: typeof phone === 'string' ? phone.trim().slice(0, 50) : undefined,
      service: typeof service === 'string' ? service.trim().slice(0, 200) : undefined,
      message: trimmedMessage,
      source: typeof source === 'string' ? source.trim().slice(0, 100) : undefined,
      sourceUrl: typeof sourceUrl === 'string' ? sourceUrl.trim().slice(0, 500) : undefined,
    });

    if (success) {
      res.json({ success: true, message: 'Consultation request sent' });
      return;
    }

    res.status(500).json({ error: 'Failed to send consultation request' });
  } catch (error: unknown) {
    logger.error('Error sending consultation email:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function isAllowedResetUrl(resetUrl: string): boolean {
  try {
    const parsed = new URL(resetUrl);
    const allowedBases = [
      process.env.FRONTEND_URL,
      process.env.BASE_URL,
      process.env.CORS_ORIGIN?.split(',')[0]?.trim(),
      'http://localhost:3000',
      'http://127.0.0.1:3000',
    ]
      .filter(Boolean)
      .map((base) => base!.replace(/\/+$/, ''));

    const origin = `${parsed.protocol}//${parsed.host}`;
    return allowedBases.some((base) => resetUrl.startsWith(base) || origin === new URL(base).origin);
  } catch {
    return false;
  }
}

function assertInternalCaller(req: Request): boolean {
  const expected = process.env.INTERNAL_API_KEY?.trim();
  const isProduction = process.env.NODE_ENV === 'production';
  if (!expected) {
    return !isProduction;
  }
  const provided = req.header('X-Internal-Key')?.trim();
  return provided === expected;
}

/**
 * Отправка письма со ссылкой сброса пароля (вызывается user-profile service).
 */
export async function sendPasswordReset(req: Request, res: Response): Promise<void> {
  try {
    if (!assertInternalCaller(req)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const { to, resetUrl, userName } = req.body as {
      to?: string;
      resetUrl?: string;
      userName?: string;
    };

    if (!to || typeof to !== 'string' || !to.includes('@')) {
      res.status(400).json({ error: 'Valid to email is required' });
      return;
    }

    if (!resetUrl || typeof resetUrl !== 'string' || !isAllowedResetUrl(resetUrl)) {
      res.status(400).json({ error: 'Invalid resetUrl' });
      return;
    }

    const success = await sendPasswordResetEmail({
      to: to.trim(),
      resetUrl: resetUrl.trim(),
      userName: typeof userName === 'string' ? userName.trim().slice(0, 100) : undefined,
    });

    if (success) {
      res.json({ success: true, message: 'Password reset email sent' });
      return;
    }

    res.status(500).json({ error: 'Failed to send password reset email' });
  } catch (error: unknown) {
    logger.error('Error sending password reset email:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
