/**
 * Jobs Controller
 * Handles HTTP requests for job matching
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import jobRepository from '../models/jobRepository';
import { getUserProfile, getCollectedData } from '../services/userService';
import { matchJobs } from '../services/matcher';
import { scrapeHHJobs } from '../services/scraper';
import { logger } from '../utils/logger';

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

    // Get user profile
    let userProfile;
    try {
      userProfile = await getUserProfile(token);
    } catch (error: unknown) {
      logger.error('Failed to get user profile:', error);
      res.status(500).json({ error: 'Failed to get user profile' });
      return;
    }

    // Get collected data from session
    const collectedData = await getCollectedData(userId);

    // Get all jobs
    const allJobs = await jobRepository.findAll({
      limit: 500, // Limit for performance
    });

    if (allJobs.length === 0) {
      res.json({
        jobs: [],
        count: 0,
        message: 'No jobs available. Please wait for job scraping to complete.',
      });
      return;
    }

    // Match jobs
    const matchedJobs = matchJobs(allJobs, collectedData, {
      location: userProfile.preferences?.location,
      workMode: userProfile.preferences?.workMode,
    });

    // Limit to top 20
    const topJobs = matchedJobs.slice(0, 20);

    res.json({
      jobs: topJobs.map((match) => ({
        job: match.job,
        score: match.score,
        reasons: match.reasons,
      })),
      count: topJobs.length,
      totalMatched: matchedJobs.length,
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

    const job = await jobRepository.findById(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    res.json({ job });
  } catch (error: unknown) {
    logger.error('Error getting job details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Trigger job scraping (for development/admin)
 */
export async function refreshJobs(_req: AuthRequest, res: Response): Promise<void> {
  try {
    logger.info('Manual job scraping triggered');

    // Trigger scraping in background
    scrapeHHJobs()
      .then((result) => {
        if (result.mockJobsUsed) {
          logger.warn('⚠️  Job scraping completed using MOCK DATA');
          logger.warn(`   Sources used: ${result.sourcesUsed.join(', ')}`);
          logger.warn(`   Jobs: ${result.jobsScraped} scraped, ${result.jobsSaved} saved`);
        } else {
          logger.info('✅ Job scraping completed successfully');
          logger.info(`   Sources used: ${result.sourcesUsed.join(', ')}`);
          logger.info(`   Jobs: ${result.jobsScraped} scraped, ${result.jobsSaved} saved`);
        }
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
