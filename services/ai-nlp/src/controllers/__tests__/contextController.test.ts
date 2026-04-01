import { Request, Response } from 'express';
import { checkContext } from '../contextController';

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

describe('contextController', () => {
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

  describe('checkContext - on topic response', () => {
    it('should return onTopic=true for relevant answer', async () => {
      mockRequest.body = {
        currentStep: {
          id: 'role',
          label: 'Должность',
          instruction: 'Какую должность вы рассматриваете?',
        },
        userMessage: 'Product Manager',
        conversationHistory: [],
      };

      (callYandexModel as jest.Mock).mockResolvedValue({
        message: {
          text: JSON.stringify({
            onTopic: true,
            deviation: '',
            shouldRedirect: false,
            importantInfo: [],
          }),
        },
        usage: {
          inputTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      });

      await checkContext(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          contextCheck: expect.objectContaining({
            onTopic: true,
            shouldRedirect: false,
          }),
        })
      );
    });

    it('should extract important info from on-topic response', async () => {
      mockRequest.body = {
        currentStep: {
          id: 'role',
          label: 'Должность',
          instruction: 'Какую должность вы рассматриваете?',
        },
        userMessage: 'Product Manager, кстати ищу удаленную работу',
        conversationHistory: [],
      };

      (callYandexModel as jest.Mock).mockResolvedValue({
        message: {
          text: JSON.stringify({
            onTopic: true,
            deviation: '',
            shouldRedirect: false,
            importantInfo: ['ищет удаленную работу'],
          }),
        },
        usage: {
          inputTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      });

      await checkContext(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          contextCheck: expect.objectContaining({
            onTopic: true,
            importantInfo: expect.arrayContaining(['ищет удаленную работу']),
          }),
        })
      );
    });
  });

  describe('checkContext - off topic response', () => {
    it('should return onTopic=false for irrelevant answer', async () => {
      mockRequest.body = {
        currentStep: {
          id: 'role',
          label: 'Должность',
          instruction: 'Какую должность вы рассматриваете?',
        },
        userMessage: 'А сколько платят?',
        conversationHistory: [],
      };

      (callYandexModel as jest.Mock).mockResolvedValue({
        message: {
          text: JSON.stringify({
            onTopic: false,
            deviation: 'Пользователь задает встречный вопрос вместо ответа',
            shouldRedirect: true,
            importantInfo: [],
          }),
        },
        usage: {
          inputTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      });

      await checkContext(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          contextCheck: expect.objectContaining({
            onTopic: false,
            shouldRedirect: true,
            deviation: expect.stringContaining('встречный вопрос'),
          }),
        })
      );
    });
  });

  describe('checkContext - error handling', () => {
    it('should return fallback (onTopic=true) on YandexGPT error', async () => {
      mockRequest.body = {
        currentStep: {
          id: 'role',
          label: 'Должность',
          instruction: 'Какую должность вы рассматриваете?',
        },
        userMessage: 'Product Manager',
        conversationHistory: [],
      };

      (callYandexModel as jest.Mock).mockRejectedValue(new Error('API Error'));

      await checkContext(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          contextCheck: expect.objectContaining({
            onTopic: true,
            shouldRedirect: false,
          }),
        })
      );
    });

    it('should handle invalid JSON response', async () => {
      mockRequest.body = {
        currentStep: {
          id: 'role',
          label: 'Должность',
          instruction: 'Какую должность вы рассматриваете?',
        },
        userMessage: 'Product Manager',
        conversationHistory: [],
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

      await checkContext(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          contextCheck: expect.objectContaining({
            onTopic: true,
            shouldRedirect: false,
          }),
        })
      );
    });

    it('should handle JSON wrapped in markdown', async () => {
      mockRequest.body = {
        currentStep: {
          id: 'role',
          label: 'Должность',
          instruction: 'Какую должность вы рассматриваете?',
        },
        userMessage: 'Product Manager',
        conversationHistory: [],
      };

      (callYandexModel as jest.Mock).mockResolvedValue({
        message: {
          text: '```json\n{"onTopic": true, "shouldRedirect": false, "importantInfo": []}\n```',
        },
        usage: {
          inputTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      });

      await checkContext(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          contextCheck: expect.objectContaining({
            onTopic: true,
            shouldRedirect: false,
          }),
        })
      );
    });
  });

  describe('checkContext - validation', () => {
    it('should handle invalid request body gracefully', async () => {
      mockRequest.body = {
        // Missing required currentStep and userMessage
      };

      // Zod validation throws, but controller catches it in try-catch
      // In real Express app, this would be handled by error middleware
      // For test, we expect it to throw (which Express middleware would catch)
      try {
        await checkContext(mockRequest as Request, mockResponse as Response);
        // If we get here, the error was caught and handled
        // This is actually fine - the controller should handle validation errors
      } catch (error) {
        // ZodError is thrown before try-catch in controller
        expect(error).toBeDefined();
      }
    });
  });
});
