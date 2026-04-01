/**
 * User Service
 * Fetches user profile from User Profile Service
 */

import axios from 'axios';
import { logger } from '../utils/logger';

const USER_PROFILE_SERVICE_URL = process.env.USER_PROFILE_SERVICE_URL || 'http://localhost:3001';

export interface UserProfile {
  id: string;
  email: string;
  name?: string;
}

/**
 * Get user profile from User Profile Service
 */
export async function getUserProfile(token: string): Promise<UserProfile> {
  try {
    const response = await axios.get(`${USER_PROFILE_SERVICE_URL}/api/users/profile`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  } catch (error: unknown) {
    logger.error('Failed to get user profile:', error);
    throw error;
  }
}
