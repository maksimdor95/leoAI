import { Request, Response } from 'express';
import { validateAnswer } from '../validationController';

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

describe('validationController', () => {
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

  describe('validateAnswer - pre-validation checks', () => {
    it('should return irrelevant for empty answer', async () => {
      mockRequest.body = {
        question: 'Какую должность вы ищете?',
        answer: '',
        stepId: 'role',
      };

      await validateAnswer(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          validation: expect.objectContaining({
            quality: 'unclear',
            reason: expect.stringContaining('пуст'),
          }),
        })
      );
    });

    it('should return irrelevant for whitespace-only answer', async () => {
      mockRequest.body = {
        question: 'Какую должность вы ищете?',
        answer: '   ',
        stepId: 'role',
      };

      await validateAnswer(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          validation: expect.objectContaining({
            quality: 'unclear',
          }),
        })
      );
    });

    it('should return irrelevant for punctuation-only answer', async () => {
      mockRequest.body = {
        question: 'Какую должность вы ищете?',
        answer: '???',
        stepId: 'role',
      };

      await validateAnswer(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          validation: expect.objectContaining({
            quality: 'unclear',
          }),
        })
      );
    });
  });

  describe('validateAnswer - numeric answers for experience', () => {
    it('should accept numeric answer for experience question', async () => {
      mockRequest.body = {
        question: 'Сколько лет у вас общего опыта работы?',
        answer: '4',
        stepId: 'experience',
      };

      // Mock YandexGPT response
      (callYandexModel as jest.Mock).mockResolvedValue({
        message: {
          text: JSON.stringify({
            quality: 'good',
            reason: 'Числовой ответ валиден для вопроса об опыте',
          }),
        },
        usage: {
          inputTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      });

      await validateAnswer(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          validation: expect.objectContaining({
            quality: 'good',
          }),
        })
      );
    });
  });

  describe('validateAnswer - short industry answers', () => {
    it('should accept short industry name', async () => {
      mockRequest.body = {
        question: 'В какой отрасли вы работали?',
        answer: 'IT',
        stepId: 'industries',
      };

      (callYandexModel as jest.Mock).mockResolvedValue({
        message: {
          text: JSON.stringify({
            quality: 'good',
            reason: 'Короткое название отрасли валидно',
          }),
        },
        usage: {
          inputTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      });

      await validateAnswer(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          validation: expect.objectContaining({
            quality: 'good',
          }),
        })
      );
    });

    it('should accept generic industry answer', async () => {
      mockRequest.body = {
        question: 'В какой отрасли вы работали?',
        answer: 'любой',
        stepId: 'industries',
      };

      (callYandexModel as jest.Mock).mockResolvedValue({
        message: {
          text: JSON.stringify({
            quality: 'good',
            reason: 'Общий ответ валиден',
          }),
        },
        usage: {
          inputTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      });

      await validateAnswer(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          validation: expect.objectContaining({
            quality: 'good',
          }),
        })
      );
    });
  });

  describe('validateAnswer - job title validation', () => {
    it('should accept simple job title', async () => {
      mockRequest.body = {
        question: 'Какую должность вы рассматриваете?',
        answer: 'водитель',
        stepId: 'role',
      };

      (callYandexModel as jest.Mock).mockResolvedValue({
        message: {
          text: JSON.stringify({
            quality: 'good',
            reason: 'Любое название должности валидно',
          }),
        },
        usage: {
          inputTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
      });

      await validateAnswer(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          validation: expect.objectContaining({
            quality: 'good',
          }),
        })
      );
    });
  });

  describe('validateAnswer - error handling', () => {
    it('should return good quality on YandexGPT error (fallback)', async () => {
      mockRequest.body = {
        question: 'Какую должность вы ищете?',
        answer: 'Product Manager',
        stepId: 'role',
      };

      (callYandexModel as jest.Mock).mockRejectedValue(new Error('API Error'));

      await validateAnswer(mockRequest as Request, mockResponse as Response);

      expect(responseJson).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          validation: expect.objectContaining({
            quality: 'good',
          }),
        })
      );
    });
  });
});
