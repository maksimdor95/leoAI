/**
 * Job Service
 * Fetches job details from Job Matching Service
 */

import axios from 'axios';
import { logger } from '../utils/logger';

const JOB_MATCHING_SERVICE_URL = process.env.JOB_MATCHING_SERVICE_URL || 'http://localhost:3004';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string[];
  salary_min?: number | null;
  salary_max?: number | null;
  currency?: string | null;
  description: string;
  requirements: string;
  skills: string[];
  experience_level?: string | null;
  work_mode?: string | null;
  source: string;
  source_url: string;
}

export interface MatchedJob {
  job: Job;
  score: number;
  reasons: string[];
}

/**
 * Get job details by ID from Job Matching Service
 */
export async function getJobById(jobId: string, token: string): Promise<Job | null> {
  try {
    const response = await axios.get(`${JOB_MATCHING_SERVICE_URL}/api/jobs/${jobId}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data.job || null;
  } catch (error: unknown) {
    logger.error(`Failed to get job ${jobId}:`, error);
    return null;
  }
}

/**
 * Get multiple jobs by IDs
 */
export async function getJobsByIds(jobIds: string[], token: string): Promise<Job[]> {
  const jobs: Job[] = [];

  for (const jobId of jobIds) {
    const job = await getJobById(jobId, token);
    if (job) {
      jobs.push(job);
    }

    // Small delay to avoid overwhelming the service
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  return jobs;
}
