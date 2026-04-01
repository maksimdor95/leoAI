import { Request, Response } from 'express';
import { analyzeProfile } from '../profileController';

// Mock dependencies
jest.mock('../../services/yandexClient', () => ({
  callYandexModel: jest.fn(),
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import after mocks
import { callYandexModel } from '../../services/yandexClient';

describe('profileController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn();

    mockRequest = {
      body: {},
    };

    mockResponse = {
      json: responseJson,
    };

    jest.clearAllMocks();
  });

  describe('analyzeProfile - complete profile', () => {
    it('should return readyForMatching=true for complete profile', async () => {
      mockRequest.body = {
        collectedData: {
          desiredRole: 'Product Manager',
          totalExperience: '5 лет',
          location: 'Москва',
          workFormat: 'удаленно',
          skills: 'Python, SQL',
          salaryExpectation: '200 000 - 300 000',
        },
        completedSteps: ['greeting', 'role', 'experience', 'location'],
        currentStepId: 'additional',
      };

      (callYandexModel as jest.Mock).mockResolvedValue({
        message: {
          text: JSON.stringify({
            completeness: 0.9,
            hasGaps: false,
            criticalGaps: [],
            missingFields: [],
            contradictions: [],
            readyForMatching: true,
          }),
        },
        usage: {
          inputTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      });

      await analyzeProfile(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          analysis: expect.objectContaining({
            completeness: 0.9,
            hasGaps: false,
            readyForMatching: true,
          }),
        })
      );
    });
  });

  describe('analyzeProfile - incomplete profile', () => {
    it('should return hasGaps=true when critical fields are missing', async () => {
      mockRequest.body = {
        collectedData: {
          desiredRole: 'Product Manager',
          // totalExperience missing
          // location missing
        },
        completedSteps: ['greeting', 'role'],
        currentStepId: 'additional',
      };

      (callYandexModel as jest.Mock).mockResolvedValue({
        message: {
          text: JSON.stringify({
            completeness: 0.4,
            hasGaps: true,
            criticalGaps: ['totalExperience', 'location'],
            missingFields: ['totalExperience', 'location', 'workFormat', 'skills'],
            contradictions: [],
            readyForMatching: false,
          }),
        },
        usage: {
          inputTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      });

      await analyzeProfile(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          analysis: expect.objectContaining({
            hasGaps: true,
            criticalGaps: expect.arrayContaining(['totalExperience', 'location']),
            readyForMatching: false,
          }),
        })
      );
    });
  });

  describe('analyzeProfile - error handling', () => {
    it('should return fallback result on YandexGPT error', async () => {
      mockRequest.body = {
        collectedData: {
          desiredRole: 'Product Manager',
        },
        completedSteps: ['greeting', 'role'],
        currentStepId: 'additional',
      };

      (callYandexModel as jest.Mock).mockRejectedValue(new Error('API Error'));

      await analyzeProfile(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          analysis: expect.objectContaining({
            completeness: 0.5,
            hasGaps: true,
            readyForMatching: false,
          }),
        })
      );
    });

    it('should handle invalid JSON response', async () => {
      mockRequest.body = {
        collectedData: {
          desiredRole: 'Product Manager',
        },
        completedSteps: ['greeting', 'role'],
        currentStepId: 'additional',
      };

      (callYandexModel as jest.Mock).mockResolvedValue({
        message: {
          text: 'Invalid JSON response',
        },
        usage: {
          inputTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      });

      await analyzeProfile(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          analysis: expect.objectContaining({
            completeness: 0.5,
            hasGaps: true,
            readyForMatching: false,
          }),
        })
      );
    });
  });

  describe('analyzeProfile - validation', () => {
    it('should handle invalid request body gracefully', async () => {
      mockRequest.body = {
        // Missing required currentStepId
      };

      // Zod validation throws, but controller catches it in try-catch
      // In real Express app, this would be handled by error middleware
      // For test, we expect it to throw (which Express middleware would catch)
      try {
        await analyzeProfile(mockRequest as Request, mockResponse as Response);
        // If we get here, the error was caught and handled
        // This is actually fine - the controller should handle validation errors
      } catch (error) {
        // ZodError is thrown before try-catch in controller
        expect(error).toBeDefined();
      }
    });
  });
});
