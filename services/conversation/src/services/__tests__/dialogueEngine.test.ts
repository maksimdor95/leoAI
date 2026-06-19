import {
  detectInterviewModeCommandFromUserText,
  evaluateCondition,
  getScenarioIdByProduct,
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
