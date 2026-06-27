import {
  interviewPrepReportGenerator,
  isInterviewPrepTrainerCollected,
} from '../interviewPrepReportGenerator';

describe('interviewPrepReportGenerator', () => {
  it('detects trainer collected data', () => {
    expect(isInterviewPrepTrainerCollected({})).toBe(false);
    expect(
      isInterviewPrepTrainerCollected({
        vacancyProfile: { role: 'PM' },
        prepPlan: [{ day: 1, focus: 'x', tasks: [] }],
      })
    ).toBe(true);
  });

  it('builds report with readiness and checklist', () => {
    const data = interviewPrepReportGenerator.buildFromCollected('sess-1', {
      vacancyProfile: { role: 'Product Owner', level: 'Senior', requirements: ['B2B'] },
      prepPlan: [{ day: 1, focus: 'Метрики', tasks: ['диагностика'] }],
      diagnosticsPackComplete: true,
      theoryLessonsCompleted: 2,
      mockPhase: 'complete',
      mockSummary: 'Итог мока',
      starHistory: [{ grading: { overallScore: 6, modelStructure: ['S', 'T', 'A', 'R'] } }],
      prepProgress: { overallPercent: 85 },
    });

    expect(data.role).toBe('Product Owner');
    expect(data.readinessPercent).toBeGreaterThan(0);
    expect(data.checklist.some((item: { label: string; done: boolean }) => item.label === 'Диагностика' && item.done)).toBe(true);
    expect(data.starStories.length).toBe(1);
    expect(data.mockSummary).toContain('Итог мока');
  });

  it('builds progress comparison for returning users', () => {
    const data = interviewPrepReportGenerator.buildFromCollected('sess-2', {
      vacancyProfile: { role: 'Senior PM', level: 'Senior' },
      prepPlan: [{ day: 1, focus: 'Кейсы', tasks: [] }],
      priorPrepSnapshot: {
        role: 'Product Owner',
        level: 'Middle',
        readinessPercent: 40,
        fatalGaps: ['нет метрик', 'слабый STAR'],
        competencyScores: [
          { dimension: 'metrics', label: 'Метрики', score: 4 },
          { dimension: 'structure', label: 'Структура', score: 5 },
        ],
      },
      mockAnswers: [
        {
          grading: {
            dimensionScores: { metrics: 7, structure: 6 },
            fatalGaps: ['слабый STAR'],
          },
        },
      ],
      prepProgress: { overallPercent: 70 },
    });

    expect(data.progressComparison?.priorRole).toBe('Product Owner');
    expect(data.progressComparison?.readinessDelta).toBe(30);
    expect(data.progressComparison?.closedGaps).toContain('нет метрик');
    expect(data.progressComparison?.remainingGaps).toContain('слабый STAR');
  });

  it('extracts employer questions from pack artifact', () => {
    const data = interviewPrepReportGenerator.buildFromCollected('sess-3', {
      vacancyProfile: { role: 'PM' },
      prepPlan: [{ day: 1, focus: 'x', tasks: [] }],
      prepArtifacts: [
        {
          packType: 'employer_questions',
          title: 'Вопросы',
          content:
            'Вот список:\n1. Как измеряете успех роли?\n2. Какие риски у команды сейчас?\n3. Как устроен процесс приоритизации?',
        },
      ],
    });

    expect(data.employerQuestions.length).toBeGreaterThanOrEqual(2);
    expect(data.employerQuestions[0]).toContain('успех');
  });
});
