import {
  buildPrepActivities,
  computePrepProgress,
  evaluateMockGate,
} from '../prepActivities';
import type { PrepActivity } from '../prepActivities';

describe('prepActivities', () => {
  const plan = [
    { day: 1, focus: 'B2B метрики', tasks: ['диагностика'] },
    { day: 2, focus: 'STAR', tasks: ['история'] },
  ];

  it('evaluateMockGate blocks without prerequisites', () => {
    const gate = evaluateMockGate({});
    expect(gate.allowed).toBe(false);
    expect(gate.blockers.length).toBeGreaterThanOrEqual(3);
  });

  it('evaluateMockGate allows when prerequisites met', () => {
    const gate = evaluateMockGate({
      diagnosticsPackComplete: true,
      theoryLessonsCompleted: 2,
      starHistory: [{ grading: { overallScore: 7 } }],
      vacancyProfile: { level: 'Senior' },
    });
    expect(gate.allowed).toBe(true);
  });

  it('computePrepProgress marks diagnostics complete', () => {
    const progress = computePrepProgress(plan, { diagnosticsPackComplete: true });
    const diagnostics = progress.activities.find((a: PrepActivity) => a.mode === 'diagnostics');
    expect(diagnostics?.completed).toBe(true);
    expect(progress.overallPercent).toBeGreaterThan(0);
  });

  it('buildPrepActivities creates day-scoped ids', () => {
    const activities = buildPrepActivities(plan, {});
    expect(activities.some((a: PrepActivity) => a.id.startsWith('d1-'))).toBe(true);
    expect(activities.some((a: PrepActivity) => a.mode === 'star')).toBe(true);
  });
});
