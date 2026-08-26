/**
 * API Client
 * Functions for communicating with backend services
 */

import axios from 'axios';
import { getPublicApiBaseUrl, getPublicConversationBaseUrl } from './publicApiBaseUrl';

const API_URL = getPublicApiBaseUrl();

const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => config);

const CONVERSATION_API_URL = getPublicConversationBaseUrl();

const conversationApi = axios.create({
  baseURL: CONVERSATION_API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to conversation API requests if available
conversationApi.interceptors.request.use((config) => config);

// User API
export const userAPI = {
  /**
   * Register a new user
   */
  register: async (data: {
    email: string;
    password: string;
    first_name?: string;
    last_name?: string;
  }) => {
    const response = await api.post('/api/users/register', data);
    return response.data;
  },

  /**
   * Login user
   */
  login: async (data: { email: string; password: string }) => {
    const response = await api.post('/api/users/login', data);
    return response.data;
  },

  forgotPassword: async (email: string) => {
    const response = await api.post('/api/users/forgot-password', { email });
    return response.data as { message: string };
  },

  validateResetToken: async (token: string) => {
    const response = await api.get('/api/users/reset-password/validate', {
      params: { token },
    });
    return response.data as { valid: boolean };
  },

  resetPassword: async (data: { token: string; password: string }) => {
    const response = await api.post('/api/users/reset-password', data);
    return response.data as { message: string };
  },

  logout: async () => {
    const response = await api.post('/api/users/logout');
    return response.data;
  },

  getOAuthStartUrl: (provider: 'yandex') => {
    return `${API_URL}/api/users/oauth/${provider}/start`;
  },

  /**
   * Get user profile
   */
  getProfile: async () => {
    const response = await api.get('/api/users/profile');
    return response.data;
  },

  /**
   * Update user profile
   */
  updateProfile: async (data: { email?: string; first_name?: string; last_name?: string }) => {
    const response = await api.put('/api/users/profile', data);
    return response.data;
  },

  uploadAvatar: async (file: File) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_URL}/api/users/profile/avatar`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error((data as { error?: string }).error || `HTTP ${res.status}`) as Error & {
        response?: { data?: { error?: string }; status?: number };
      };
      err.response = { data: data as { error?: string }, status: res.status };
      throw err;
    }
    return data as {
      message: string;
      user: {
        id: string;
        email: string;
        first_name?: string;
        last_name?: string;
        avatar_url?: string;
        created_at?: string;
        updated_at?: string;
      };
    };
  },

  deleteAvatar: async () => {
    const response = await api.delete('/api/users/profile/avatar');
    return response.data as {
      message: string;
      user: {
        id: string;
        email: string;
        first_name?: string;
        last_name?: string;
        avatar_url?: string;
        created_at?: string;
        updated_at?: string;
      };
    };
  },
};

// Conversation API
export interface ConversationPreview {
  id: string;
  createdAt: string;
  updatedAt: string;
  preview: string;
  messageCount: number;
  status: string;
  collectedData: Record<string, unknown>;
  product?: 'jack' | 'wannanew' | 'interview-prep';
  scenarioId?: string;
}

export const conversationAPI = {
  /**
   * Get all conversations for authenticated user
   */
  getConversations: async (): Promise<{ conversations: ConversationPreview[] }> => {
    const response = await conversationApi.get('/api/conversations');
    return response.data;
  },

  /**
   * Delete a conversation
   */
  deleteConversation: async (
    conversationId: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await conversationApi.delete(`/api/conversations/${conversationId}`);
    return response.data;
  },
};

export default api;
