/**
 * User Profile Service Client
 * Makes HTTP requests to User Profile Service
 */

import axios, { AxiosInstance } from 'axios';
import { logger } from '../utils/logger';

export interface UserProfile {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

const USER_PROFILE_SERVICE_URL = process.env.USER_PROFILE_SERVICE_URL || 'http://localhost:3001';

class UserProfileServiceClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: USER_PROFILE_SERVICE_URL,
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Get user profile by ID
   */
  async getUserProfile(_userId: string, token: string): Promise<UserProfile> {
    try {
      const response = await this.client.get(`/api/users/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      return response.data;
    } catch (error: unknown) {
      logger.error('Error fetching user profile:', error);
      throw new Error('Failed to fetch user profile');
    }
  }
}

export const userProfileService = new UserProfileServiceClient();
