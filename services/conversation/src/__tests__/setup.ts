// Jest setup file
// This file runs before all tests

// Mock environment variables
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.AI_SERVICE_URL = 'http://localhost:3003';
process.env.JWT_SECRET = 'test-secret-key';

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
