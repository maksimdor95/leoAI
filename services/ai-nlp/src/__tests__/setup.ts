// Jest setup file
// This file runs before all tests

// Mock environment variables
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.YC_FOLDER_ID = 'test-folder-id';
process.env.YC_API_KEY = 'test-api-key';
process.env.YC_MODEL_ID = 'foundation-models/yandexgpt-lite';

// Suppress console logs during tests (optional)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };
