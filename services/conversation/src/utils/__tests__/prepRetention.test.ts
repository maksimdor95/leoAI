import type { ConversationSession } from '../../types/session';
import {
  buildPrepRetentionState,
  buildPriorPrepSnapshot,
  buildReturningUserWelcome,
  extractStarEntriesFromCollected,
  inferRoleTrackFromProfile,
  mergeStarBankEntries,
} from '../prepRetention';

function makeSession(
  id: string,
  collectedData: Record<string, unknown>,
  updatedAt = '2026-06-01T10:00:00.000Z'
): ConversationSession {
  return {
    id,
    userId: 'user-1',
    metadata: {
      product: 'interview-prep',
      scenarioId: 'interview-prep-v1',
      currentStepId: 'mode_select',
      status: 'active',
      flags: {},
      collectedData,
      completedSteps: ['vacancy_input'],
    },
    messages: [],
    createdAt: updatedAt,
    updatedAt,
  } as ConversationSession;
}

describe('prepRetention', () => {
  it('detects same role track for returning user', () => {
    const prior = makeSession('s1', {
      vacancyProfile: { role: 'Senior Product Manager', level: 'Senior' },
      prepComplete: true,
    });
    const state = buildPrepRetentionState({
      priorSessions: [prior],
      newProfile: { role: 'Product Owner', level: 'Senior' },
    });

    expect(state.isReturningUser).toBe(true);
    expect(state.prepSessionNumber).toBe(2);
    expect(state.sameRoleTrack).toBe(true);
    expect(state.shortenedDiagnostics).toBe(true);
    expect(state.priorRole).toBe('Senior Product Manager');
  });

  it('extracts STAR entries from starHistory', () => {
    const entries = extractStarEntriesFromCollected(
      {
        vacancyProfile: { role: 'PM' },
        starHistory: [
          {
            at: '2026-06-01T12:00:00.000Z',
            userMessage:
              'В ситуации падения активации я пересобрал onboarding и поднял конверсию на 12 процентов за квартал.',
            grading: { overallScore: 7, modelStructure: ['S', 'T', 'A', 'R'] },
          },
        ],
      },
      's1'
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].role).toBe('PM');
    expect(entries[0].modelStructure).toEqual(['S', 'T', 'A', 'R']);
  });

  it('builds returning user welcome with STAR bank hint', () => {
    const state = buildPrepRetentionState({
      priorSessions: [
        makeSession('s1', {
          vacancyProfile: { role: 'Backend Engineer' },
        }),
      ],
      newProfile: { role: 'Senior Backend Engineer' },
    });
    const text = buildReturningUserWelcome(state, 'Senior Backend Engineer', 2);

    expect(text).toContain('Backend Engineer');
    expect(text).toContain('банке STAR');
    expect(text).toContain('короче');
  });

  it('merges STAR bank without duplicates', () => {
    const merged = mergeStarBankEntries(
      [
        {
          id: '1',
          userMessage: 'Same story about activation and metrics for the product team.',
          savedAt: '2026-06-01T10:00:00.000Z',
        },
      ],
      [
        {
          id: '2',
          sourceSessionId: 's2',
          userMessage: 'Same story about activation and metrics for the product team.',
          savedAt: '2026-06-02T10:00:00.000Z',
        },
      ]
    );

    expect(merged).toHaveLength(1);
  });

  it('infers role tracks consistently with profile keywords', () => {
    expect(inferRoleTrackFromProfile({ role: 'QA Engineer' })).toBe('qa_quality');
    expect(inferRoleTrackFromProfile({ role: 'Account Executive' })).toBe('sales_commercial');
  });

  it('builds prior prep snapshot from completed session', () => {
    const prior = makeSession('s1', {
      vacancyProfile: { role: 'PM', level: 'Middle' },
      prepPlan: [{ day: 1, focus: 'Диагностика', tasks: ['x'] }],
      diagnosticsPackComplete: true,
      theoryLessonsCompleted: 2,
      starHistory: [{ grading: { dimensionScores: { structure: 6 }, fatalGaps: ['метрики'] } }],
    });
    const snapshot = buildPriorPrepSnapshot(prior);

    expect(snapshot?.role).toBe('PM');
    expect(snapshot?.readinessPercent).toBeGreaterThan(0);
    expect(snapshot?.fatalGaps).toContain('метрики');
  });
});
