import {
  buildPrepContinueEmailDraft,
  buildPrepContinueEmailDraftFromCollected,
  parsePrepPace,
  shouldSchedulePrepReminder,
} from '../prepContinueReminder';
import type { ConversationSession } from '../../types/session';
import type { PrepProgress } from '../prepActivities';

function sessionWithProgress(
  progress: PrepProgress,
  extras: Record<string, unknown> = {}
): ConversationSession {
  return {
    id: 's1',
    userId: 'u1',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    messages: [],
    metadata: {
      product: 'interview-prep',
      scenarioId: 'interview-prep-v1',
      status: 'active',
      completedSteps: [],
      flags: {},
      collectedData: {
        prepProgress: progress,
        vacancyProfile: { role: 'Product Owner' },
        ...extras,
      },
    },
  };
}

const baseProgress: PrepProgress = {
  currentDay: 1,
  totalDays: 5,
  overallPercent: 20,
  completedActivityIds: ['d1-diagnostics-apply'],
  activities: [
    {
      id: 'd1-diagnostics-apply',
      day: 1,
      type: 'apply',
      title: 'Карта пробелов',
      mode: 'diagnostics',
      durationMin: 25,
      required: true,
      completed: true,
    },
    {
      id: 'd1-theory-learn',
      day: 1,
      type: 'learn',
      title: 'Первый урок',
      mode: 'theory',
      durationMin: 20,
      required: true,
      completed: false,
    },
  ],
};

describe('prepContinueReminder (P1 DoD)', () => {
  it('builds draft for incomplete route with progress', () => {
    const draft = buildPrepContinueEmailDraft(sessionWithProgress(baseProgress));
    expect(draft).toMatchObject({
      nextTitle: 'Первый урок',
      stageLabel: 'Закрытие пробелов',
      role: 'Product Owner',
    });
    expect(draft?.emailKey).toContain('stage-1-');
  });

  it('skips when already sent for this key', () => {
    const draft = buildPrepContinueEmailDraftFromCollected({
      prepProgress: baseProgress,
      prepContinueEmailKey: `stage-1-d1-theory-learn`,
      vacancyProfile: { role: 'PO' },
    });
    expect(draft).toBeNull();
  });

  it('requirePauseElapsed blocks before 24h', () => {
    const now = Date.parse('2026-07-31T12:00:00.000Z');
    const draft = buildPrepContinueEmailDraftFromCollected(
      {
        prepProgress: baseProgress,
        prepLastActiveAt: new Date(now - 60 * 60 * 1000).toISOString(),
      },
      { requirePauseElapsed: true, nowMs: now, pauseMs: 24 * 60 * 60 * 1000 }
    );
    expect(draft).toBeNull();
  });

  it('requirePauseElapsed allows after 24h', () => {
    const now = Date.parse('2026-07-31T12:00:00.000Z');
    const draft = buildPrepContinueEmailDraftFromCollected(
      {
        prepProgress: baseProgress,
        prepLastActiveAt: new Date(now - 25 * 60 * 60 * 1000).toISOString(),
      },
      { requirePauseElapsed: true, nowMs: now, pauseMs: 24 * 60 * 60 * 1000 }
    );
    expect(draft?.nextTitle).toBe('Первый урок');
  });

  it('shouldSchedulePrepReminder respects sprint vs marathon', () => {
    expect(shouldSchedulePrepReminder({ prepPace: 'sprint' })).toBe(false);
    expect(shouldSchedulePrepReminder({ prepPace: 'marathon' })).toBe(true);
    expect(shouldSchedulePrepReminder({})).toBe(true);
  });

  it('parsePrepPace validates values', () => {
    expect(parsePrepPace('sprint')).toBe('sprint');
    expect(parsePrepPace('marathon')).toBe('marathon');
    expect(parsePrepPace('jog')).toBeNull();
  });
});
