import { Request, Response } from 'express';
import { enrichProfile } from '../profileEnrichmentController';

jest.mock('../../services/yandexClient', () => ({
  callYandexModel: jest.fn(),
}));

jest.mock('../profileController', () => ({
  runProfileAnalysis: jest.fn(),
  getFieldDisplayName: (field: string) => field,
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import { callYandexModel } from '../../services/yandexClient';
import { runProfileAnalysis } from '../profileController';

describe('profileEnrichmentController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseJson: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    responseJson = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: responseJson });

    mockRequest = { body: {} };
    mockResponse = {
      json: responseJson,
      status: statusMock,
    };

    jest.clearAllMocks();
  });

  it('merges rule signals with LLM enrichment phases', async () => {
    mockRequest.body = {
      collectedData: {
        desired_role: 'Product Manager',
        skills_hard: 'SQL, Analytics',
      },
      ruleSignals: {
        role_family: 'product',
        seniority: 'middle',
        normalized_skills: [{ name: 'SQL', source: 'chat' }],
      },
      phase: 'all',
      completedSteps: ['skills'],
      currentStepId: 'desired_start',
      marketContext: {
        role_family: 'product',
        missingSkillsTop: ['Jira', 'A/B testing'],
      },
    };

    (runProfileAnalysis as jest.Mock).mockResolvedValue({
      completeness: 0.82,
      hasGaps: true,
      criticalGaps: [],
      missingFields: ['desired_salary'],
      contradictions: [],
      readyForMatching: true,
    });

    (callYandexModel as jest.Mock)
      .mockResolvedValueOnce({
        message: {
          text: JSON.stringify({
            domains: ['fintech'],
            motivation: 'impact',
          }),
        },
      })
      .mockResolvedValueOnce({
        message: {
          text: JSON.stringify({
            market_fit_summary: 'Сильный product-профиль, не хватает Jira.',
          }),
        },
      })
      .mockResolvedValueOnce({
        message: {
          text: JSON.stringify({
            achievements_with_metrics: [
              {
                achievement: 'Запустил фичу',
                metric_before: '0',
                metric_after: '10k users',
              },
            ],
          }),
        },
      });

    await enrichProfile(mockRequest as Request, mockResponse as Response);

    expect(responseJson).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        enriched: expect.objectContaining({
          role_family: 'product',
          seniority: 'middle',
          // rule-based completeness (не LLM missingFields)
          profile_completeness: 0.25,
          missing_fields: expect.arrayContaining([
            'ожидания по зарплате',
            'локация и формат',
          ]),
          market_fit_summary: 'Сильный product-профиль, не хватает Jira.',
          achievements_with_metrics: expect.arrayContaining([
            expect.objectContaining({ achievement: 'Запустил фичу' }),
          ]),
        }),
      })
    );
  });

  it('returns 400 for invalid payload', async () => {
    mockRequest.body = { phase: 'invalid' };

    await enrichProfile(mockRequest as Request, mockResponse as Response);

    expect(statusMock).toHaveBeenCalledWith(400);
  });
});
