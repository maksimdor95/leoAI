/**
 * API Client
 * Functions for communicating with backend services
 */

import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests if available (except public endpoints)
const PUBLIC_ENDPOINTS = ['/api/users/register', '/api/users/login'];

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // Don't add Authorization header for public endpoints
    // Yandex Serverless Containers validates this header at infrastructure level
    const isPublicEndpoint = PUBLIC_ENDPOINTS.some((endpoint) => config.url?.includes(endpoint));
    if (!isPublicEndpoint) {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
  }
  return config;
});

const CONVERSATION_API_URL = process.env.NEXT_PUBLIC_CONVERSATION_API_URL || '';

const conversationApi = axios.create({
  baseURL: CONVERSATION_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to conversation API requests if available
conversationApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

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
  product?: 'jack' | 'wannanew';
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
