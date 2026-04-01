import { jest } from '@jest/globals';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'jack_ai_test';
process.env.DB_USER = 'postgres';
process.env.DB_PASSWORD = 'postgres';
process.env.JWT_SECRET = 'test-jwt-secret';

// Increase timeout for database operations
jest.setTimeout(30000);

// Mock console methods to reduce noise during tests
global.console = {
  ...console,
  // Keep log and warn for debugging
  // Comment out error and info to reduce noise
  error: jest.fn(),
  info: jest.fn(),
};
