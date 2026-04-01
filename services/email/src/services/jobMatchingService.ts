/**
 * Job Matching Service Client
 * Makes HTTP requests to Job Matching Service
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  salary_min?: number;
  salary_max?: number;
  currency?: string;
  description: string;
  source_url: string;
}

const JOB_MATCHING_SERVICE_URL = process.env.JOB_MATCHING_SERVICE_URL || 'http://localhost:3004';

class JobMatchingServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: JOB_MATCHING_SERVICE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get job details by ID
   */
  async getJobById(jobId: string): Promise<Job> {
    try {
      const response = await this.client.get(`/api/jobs/${jobId}`);
      return response.data.job;
    } catch (error: unknown) {
      logger.error('Error fetching job:', error);
      throw new Error('Failed to fetch job details');
    }
  }
}

export const jobMatchingService = new JobMatchingServiceClient();
