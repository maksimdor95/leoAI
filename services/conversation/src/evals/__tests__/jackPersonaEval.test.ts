import { ALL_JACK_PERSONA_FIXTURES } from '../fixtures';
import { runJackPersonaEval } from '../evalMetrics';

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../services/integrationService', () => ({
  triggerProfileDrivenScrape: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../services/aiClient', () => ({
  validateAnswer: jest.fn().mockResolvedValue({ quality: 'good', reason: 'eval mock' }),
  checkContext: jest.fn().mockResolvedValue({
    onTopic: true,
    shouldRedirect: false,
    deviation: '',
    importantInfo: [],
  }),
  analyzeProfile: jest.fn().mockResolvedValue({
    completeness: 0.9,
    hasGaps: false,
    criticalGaps: [],
    readyForMatching: true,
  }),
  generateStepQuestionText: jest.fn().mockResolvedValue(''),
  generateFreeChatResponse: jest.fn(),
  retrieveContext: jest.fn(),
  extractVacancyProfile: jest.fn(),
  generateInterviewPrepPlan: jest.fn(),
  generateInterviewModeResponse: jest.fn(),
  gradeInterviewAnswer: jest.fn(),
  generateMockInterviewSummary: jest.fn(),
}));

describe('Jack persona eval harness', () => {
  it.each(ALL_JACK_PERSONA_FIXTURES.map((persona) => [persona.id, persona] as const))(
    '%s completes without clarify loops',
    async (_id, persona) => {
      const result = await runJackPersonaEval(persona);

      expect(result.completed).toBe(true);
      expect(result.finalStepId).toBe(persona.expectedFinalStepId);
      expect(result.clarifyCount).toBeLessThanOrEqual(persona.maxClarifyCount);
      expect(result.missingKeys).toEqual([]);

      for (const milestone of persona.expectedMilestones ?? []) {
        expect(result.stepTrail).toContain(milestone);
      }
    }
  );
});
