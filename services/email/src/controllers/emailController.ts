/**
 * Email Controller
 * Handles HTTP requests for email notifications
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import {
  sendWelcomeEmail,
  sendJobsDigestEmail,
  sendResumePackageEmail,
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

    const { resume, coverLetter } = req.body as { resume?: string; coverLetter?: string };
    if (!resume || typeof resume !== 'string') {
      res.status(400).json({ error: 'resume is required' });
      return;
    }
    if (!coverLetter || typeof coverLetter !== 'string') {
      res.status(400).json({ error: 'coverLetter is required' });
      return;
    }

    const token = req.headers.authorization?.replace('Bearer ', '') || '';
    let userName: string | undefined;
    try {
      const userProfile = await getUserProfile(token);
      userName = userProfile.name;
    } catch (error: unknown) {
      logger.warn('Failed to get user profile for resume package email:', error);
    }

    const success = await sendResumePackageEmail({
      userEmail: user.email,
      userName,
      resume,
      coverLetter,
    });

    if (success) {
      res.json({
        success: true,
        email: user.email,
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
