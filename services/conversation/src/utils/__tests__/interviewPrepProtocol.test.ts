import {
  buildMockBriefingMessage,
  getRescueAttemptLimit,
  isMockReadySignal,
  isModeStartCommand,
  shouldTriggerFullRescue,
  shouldTriggerMicroRescue,
} from '../interviewPrepProtocol';

describe('interviewPrepProtocol', () => {
  it('detects mode start command', () => {
    expect(isModeStartCommand('Начать режим: Мок-интервью')).toBe(true);
    expect(isModeStartCommand('готов')).toBe(false);
  });

  it('detects mock ready signal', () => {
    expect(isMockReadySignal('готов')).toBe(true);
    expect(isMockReadySignal('Начать режим: Мок')).toBe(false);
  });

  it('builds briefing with role', () => {
    expect(buildMockBriefingMessage('Product Owner')).toContain('Product Owner');
    expect(buildMockBriefingMessage()).toContain('вашей вакансии');
  });

  it('triggers full rescue for weak case answers', () => {
    expect(shouldTriggerFullRescue({ overallScore: 3, fatalGaps: [] }, 'long enough answer here', 'case')).toBe(
      true
    );
    expect(shouldTriggerFullRescue({ overallScore: 7, fatalGaps: [] }, 'не знаю', 'case')).toBe(true);
    expect(shouldTriggerFullRescue({ overallScore: 7, fatalGaps: [] }, 'strong structured answer', 'mock')).toBe(
      false
    );
  });

  it('triggers micro rescue only in mock active', () => {
    expect(shouldTriggerMicroRescue({ overallScore: 2, fatalGaps: ['x'] }, 'mock', 'active')).toBe(true);
    expect(shouldTriggerMicroRescue({ overallScore: 2, fatalGaps: ['x'] }, 'mock', 'briefing')).toBe(false);
  });

  it('returns rescue limits by seniority', () => {
    expect(getRescueAttemptLimit('Junior')).toBe(3);
    expect(getRescueAttemptLimit('Lead')).toBe(1);
  });
});
