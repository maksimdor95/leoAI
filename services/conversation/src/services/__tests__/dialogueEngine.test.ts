import { evaluateCondition, resolveNextStep } from '../dialogueEngine';
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
});
