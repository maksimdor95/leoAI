import {
  applyImportedCollectedData,
  detectInterviewModeCommandFromUserText,
  evaluateCondition,
  getScenarioIdByProduct,
  hasDesiredRoleInCollected,
  isResumePathMode,
  pickResumeClarifyStepId,
  resolveNextStep,
  tagUserMessageWithInterviewMode,
  wantsDetailedProfileAnalysis,
} from '../dialogueEngine';
import { MessageRole, MessageType } from '../../types/message';
import { ConversationSession } from '../../types/session';
import { ScenarioNextValue } from '../../types/scenario';

// Mock the logger
jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('dialogueEngine', () => {
  describe('evaluateCondition', () => {
    it('should evaluate numeric less than condition', () => {
      const condition = 'totalExperience < 1';
      const collectedData = { totalExperience: '0 лет' };
      const result = evaluateCondition(condition, collectedData);
      expect(result).toBe(true);
    });

    it('should evaluate numeric greater than condition', () => {
      const condition = 'totalExperience > 10';
      const collectedData = { totalExperience: '15 лет' };
      const result = evaluateCondition(condition, collectedData);
      expect(result).toBe(true);
    });

    it('should evaluate numeric less than or equal condition', () => {
      const condition = 'totalExperience <= 1';
      const collectedData = { totalExperience: '1 год' };
      const result = evaluateCondition(condition, collectedData);
      expect(result).toBe(true);
    });

    it('should evaluate numeric greater than or equal condition', () => {
      const condition = 'totalExperience >= 10';
      const collectedData = { totalExperience: '10 лет' };
      const result = evaluateCondition(condition, collectedData);
      expect(result).toBe(true);
    });

    it('should evaluate equality condition with exact match', () => {
      const condition = "readyToStart === 'готов'";
      const collectedData = { readyToStart: 'готов' };
      const result = evaluateCondition(condition, collectedData);
      expect(result).toBe(true);
    });

    it('should evaluate equality condition with case insensitive match', () => {
      const condition = "readyToStart === 'готов'";
      const collectedData = { readyToStart: 'ГОТОВ' };
      const result = evaluateCondition(condition, collectedData);
      expect(result).toBe(true);
    });

    it('should evaluate inequality condition', () => {
      const condition = "readyToStart !== 'не готов'";
      const collectedData = { readyToStart: 'готов' };
      const result = evaluateCondition(condition, collectedData);
      expect(result).toBe(true);
    });

    it('should handle short answers with exact match (prevents false positives)', () => {
      const condition = "readyToStart === 'не готов'";
      const collectedData = { readyToStart: 'готов' };
      const result = evaluateCondition(condition, collectedData);
      expect(result).toBe(false);
    });

    it('should return false for invalid condition', () => {
      const condition = 'invalid condition';
      const collectedData = { totalExperience: '5 лет' };
      const result = evaluateCondition(condition, collectedData);
      expect(result).toBe(false);
    });
  });

  describe('resolveNextStep', () => {
    it('should return default step when no conditions', () => {
      const next: ScenarioNextValue = 'role';
      const collectedData = {};
      const result = resolveNextStep(next, collectedData);
      expect(result).toBe('role');
    });

    it('should return default step when conditions array is empty', () => {
      const next: ScenarioNextValue = {
        default: 'role',
        when: [],
      };
      const collectedData = {};
      const result = resolveNextStep(next, collectedData);
      expect(result).toBe('role');
    });

    it('should return step from matching condition', () => {
      const next: ScenarioNextValue = {
        default: 'role',
        when: [
          {
            condition: "readyToStart === 'не готов'",
            to: 'pause_reminder',
          },
        ],
      };
      const collectedData = { readyToStart: 'не готов' };
      const result = resolveNextStep(next, collectedData);
      expect(result).toBe('pause_reminder');
    });

    it('should return default step when no conditions match', () => {
      const next: ScenarioNextValue = {
        default: 'role',
        when: [
          {
            condition: "readyToStart === 'не готов'",
            to: 'pause_reminder',
          },
        ],
      };
      const collectedData = { readyToStart: 'готов' };
      const result = resolveNextStep(next, collectedData);
      expect(result).toBe('role');
    });

    it('should return first matching condition when multiple conditions match', () => {
      const next: ScenarioNextValue = {
        default: 'role',
        when: [
          {
            condition: 'totalExperience < 1',
            to: 'junior_intro',
          },
          {
            condition: 'totalExperience > 10',
            to: 'senior_deep_dive',
          },
        ],
      };
      const collectedData = { totalExperience: '0 лет' };
      const result = resolveNextStep(next, collectedData);
      expect(result).toBe('junior_intro');
    });

    it('should handle null next step', () => {
      const next: ScenarioNextValue = null;
      const collectedData = {};
      const result = resolveNextStep(next, collectedData);
      expect(result).toBeNull();
    });
  });

  describe('getScenarioIdByProduct', () => {
    it('should route interview prep product to interview scenario', () => {
      expect(getScenarioIdByProduct('interview-prep')).toBe('interview-prep-v1');
    });
  });

  describe('quick_ready intent detection', () => {
    it('detects detailed analysis requests', () => {
      expect(wantsDetailedProfileAnalysis('перейти к детальному анализу')).toBe(true);
      expect(wantsDetailedProfileAnalysis('детализированный анализ')).toBe(true);
      expect(wantsDetailedProfileAnalysis('хочу развернутый разбор')).toBe(true);
    });

    it('does not treat meta clarify prompts as detailed analysis', () => {
      expect(wantsDetailedProfileAnalysis('Можно уточнить детали')).toBe(false);
    });
  });

  describe('resume path helpers', () => {
    it('detects resume path scenario mode', () => {
      expect(isResumePathMode({ scenarioMode: 'готовое резюме' })).toBe(true);
      expect(isResumePathMode({ scenarioMode: 'быстрый подбор' })).toBe(false);
    });

    it('routes greeting to resume_upload for resume mode', () => {
      const next: ScenarioNextValue = {
        default: 'career_overview',
        when: [{ condition: "scenarioMode === 'готовое резюме'", to: 'resume_upload' }],
      };
      expect(resolveNextStep(next, { scenarioMode: 'готовое резюме' })).toBe('resume_upload');
    });

    it('picks clarify step when role or location missing', () => {
      expect(pickResumeClarifyStepId({ desired_role: 'PM', totalExperience: 5 })).toBe(
        'quick_location'
      );
      expect(pickResumeClarifyStepId({ careerSummary: '5 лет в продукте' })).toBe('quick_role');
      expect(hasDesiredRoleInCollected({ desired_role: 'Analyst' })).toBe(true);
    });

    it('merges imported resume fields into session collectedData on resume path', async () => {
      const session = {
        id: 's-resume',
        userId: 'u1',
        metadata: {
          product: 'jack',
          scenarioId: 'jack-profile-v2',
          currentStepId: 'resume_upload',
          collectedData: { scenarioMode: 'готовое резюме' },
          completedSteps: [],
        },
        messages: [],
      } as unknown as ConversationSession;

      await applyImportedCollectedData(session, {
        desired_role: 'Product Manager',
        careerSummary: '5 лет в продуктовых командах',
        skills_hard: 'SQL, Jira',
        totalExperience: 5,
      });

      expect(session.metadata.collectedData?.desired_role).toBe('Product Manager');
      expect(session.metadata.currentStepId).toBe('resume_ready');
      expect(session.metadata.completedSteps).toContain('resume_upload');
    });
  });

  describe('interview prep mode detection', () => {
    it('does not treat long answers with «задачи» as case mode', () => {
      const answer =
        'В первую очередь в работу попадали задачи с максимальным влиянием на целевые метрики.';
      expect(detectInterviewModeCommandFromUserText(answer)).toBeNull();
    });

    it('detects short explicit mode commands', () => {
      expect(detectInterviewModeCommandFromUserText('теория')).toBe('theory');
      expect(detectInterviewModeCommandFromUserText('кейс')).toBe('case');
      expect(detectInterviewModeCommandFromUserText('Начать режим: Диагностика')).toBe('diagnostics');
    });

    it('tags user messages only with activeMode from session', () => {
      const session = {
        id: 's1',
        userId: 'u1',
        metadata: {
          product: 'interview-prep',
          collectedData: { activeMode: 'diagnostics' },
        },
        messages: [],
      } as unknown as ConversationSession;

      const tagged = tagUserMessageWithInterviewMode(session, {
        id: 'm1',
        type: MessageType.TEXT,
        role: MessageRole.USER,
        timestamp: new Date().toISOString(),
        sessionId: 's1',
        content: 'В работу попадали задачи с высоким эффектом.',
      });

      expect(tagged.interviewMode).toBe('diagnostics');
    });
  });
});
