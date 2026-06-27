import { logger } from '../utils/logger';
import { InterviewPrepReportData, PrepProgressComparison } from '../types/interviewPrepReport';

type CollectedData = Record<string, unknown>;

type PrepArtifactLike = {
  packType: string;
  title: string;
  content: string;
};

const DIMENSION_LABELS: Record<string, string> = {
  structure: 'Структура',
  depth: 'Глубина',
  metrics: 'Метрики',
  tradeOffs: 'Trade-offs',
  communication: 'Коммуникация',
  seniorityFit: 'Уровень',
};

type GradingLike = {
  dimensionScores?: Record<string, number>;
  fatalGaps?: string[];
  strengths?: string[];
  improvements?: string[];
  modelStructure?: string[];
};

function historyHasGradedEntry(historyKey: string, collected: CollectedData): boolean {
  const history = collected[historyKey];
  if (!Array.isArray(history) || history.length === 0) return false;
  return history.some(
    (entry) =>
      entry != null && typeof entry === 'object' && ('grading' in entry || 'responsePhase' in entry)
  );
}

function extractGradings(collected: CollectedData): GradingLike[] {
  const gradings: GradingLike[] = [];
  for (const key of ['mockAnswers', 'caseHistory', 'starHistory', 'diagnosticsHistory']) {
    const source = collected[key];
    if (!Array.isArray(source)) continue;
    for (const entry of source) {
      if (entry && typeof entry === 'object' && 'grading' in entry) {
        const g = (entry as { grading?: GradingLike }).grading;
        if (g) gradings.push(g);
      }
    }
  }
  const last = collected.lastInterviewGrade as GradingLike | undefined;
  if (last) gradings.push(last);
  return gradings;
}

function aggregateCompetencyScores(collected: CollectedData) {
  const buckets = new Map<string, number[]>();
  for (const grading of extractGradings(collected)) {
    const dims = grading.dimensionScores;
    if (!dims) continue;
    for (const [key, value] of Object.entries(dims)) {
      if (typeof value !== 'number') continue;
      const list = buckets.get(key) ?? [];
      list.push(value);
      buckets.set(key, list);
    }
  }
  return Array.from(buckets.entries()).map(([dimension, scores]) => ({
    dimension,
    label: DIMENSION_LABELS[dimension] ?? dimension,
    score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
  }));
}

function collectFatalGaps(collected: CollectedData): string[] {
  const gaps = new Set<string>();
  for (const grading of extractGradings(collected)) {
    for (const gap of grading.fatalGaps ?? []) {
      if (gap?.trim()) gaps.add(gap.trim());
    }
  }
  return Array.from(gaps).slice(0, 8);
}

function collectExecutiveSummary(collected: CollectedData) {
  const strengths = new Set<string>();
  const improvements = new Set<string>();
  for (const grading of extractGradings(collected)) {
    for (const s of grading.strengths ?? []) {
      if (s?.trim()) strengths.add(s.trim());
    }
    for (const i of grading.improvements ?? []) {
      if (i?.trim()) improvements.add(i.trim());
    }
  }
  const fatal = collectFatalGaps(collected);
  const actions = improvements.size > 0 ? Array.from(improvements) : fatal;
  return {
    strengths: Array.from(strengths).slice(0, 3),
    gaps: fatal.slice(0, 3),
    actions: actions.slice(0, 3),
  };
}

function buildChecklist(collected: CollectedData, readinessPercent: number) {
  const profile = collected.vacancyProfile as { level?: string } | undefined;
  const level = (collected.candidateSeniority as string) || profile?.level || '';
  const theoryTarget = /junior|intern|джун/i.test(level) ? 3 : 2;
  const theoryLessons = Number(collected.theoryLessonsCompleted ?? 0);
  return [
    { label: 'Диагностика', done: Boolean(collected.diagnosticsPackComplete) },
    { label: `Уроки (${theoryLessons}/${theoryTarget})`, done: theoryLessons >= theoryTarget },
    { label: 'STAR с разбором', done: historyHasGradedEntry('starHistory', collected) },
    { label: 'Мок-интервью', done: collected.mockPhase === 'complete' },
    { label: 'План подготовки', done: readinessPercent >= 80 },
  ];
}

function extractStarStories(collected: CollectedData) {
  const history = collected.starHistory;
  if (!Array.isArray(history)) return [];
  return history
    .slice(-3)
    .map((entry, index) => {
      const grading = (entry as { grading?: GradingLike }).grading;
      const structure = grading?.modelStructure?.join(' → ') || 'S → T → A → R';
      return { title: `STAR ${index + 1}`, structure };
    });
}

function extractCaseStructures(collected: CollectedData) {
  const history = collected.caseHistory;
  if (!Array.isArray(history)) return [];
  const structures: string[] = [];
  for (const entry of history) {
    const grading = (entry as { grading?: GradingLike }).grading;
    if (grading?.modelStructure?.length) {
      structures.push(grading.modelStructure.join(' → '));
    }
  }
  return structures.slice(0, 3);
}

type PriorPrepSnapshotLike = {
  sessionId?: string;
  role?: string;
  level?: string;
  readinessPercent?: number;
  competencyScores?: Array<{ dimension: string; label: string; score: number }>;
  fatalGaps?: string[];
  preparedAt?: string;
};

function normalizeGapText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function gapsOverlap(a: string, b: string): boolean {
  const left = normalizeGapText(a);
  const right = normalizeGapText(b);
  if (!left || !right) return false;
  if (left === right || left.includes(right) || right.includes(left)) return true;
  const leftWords = new Set(left.split(' ').filter((word) => word.length > 3));
  return right.split(' ').some((word) => word.length > 3 && leftWords.has(word));
}

function buildProgressComparison(
  prior: PriorPrepSnapshotLike,
  currentReadinessPercent: number,
  currentFatalGaps: string[],
  currentCompetencyScores: InterviewPrepReportData['competencyScores']
): PrepProgressComparison | undefined {
  if (!prior.role) return undefined;

  const priorGaps = (prior.fatalGaps ?? []).filter((gap) => gap.trim());
  const closedGaps = priorGaps.filter(
    (gap) => !currentFatalGaps.some((currentGap) => gapsOverlap(gap, currentGap))
  );
  const remainingGaps = priorGaps.filter((gap) =>
    currentFatalGaps.some((currentGap) => gapsOverlap(gap, currentGap))
  );
  const newGaps = currentFatalGaps.filter(
    (gap) => !priorGaps.some((priorGap) => gapsOverlap(gap, priorGap))
  );

  const priorByDimension = new Map(
    (prior.competencyScores ?? []).map((score) => [score.dimension, score])
  );
  const competencyDeltas = currentCompetencyScores.map((currentScore) => {
    const priorScore = priorByDimension.get(currentScore.dimension)?.score;
    return {
      dimension: currentScore.dimension,
      label: currentScore.label,
      priorScore,
      currentScore: currentScore.score,
      delta:
        typeof priorScore === 'number'
          ? Math.round((currentScore.score - priorScore) * 10) / 10
          : undefined,
    };
  });

  const priorReadinessPercent = prior.readinessPercent ?? 0;
  return {
    priorRole: prior.role,
    priorLevel: prior.level,
    priorReadinessPercent,
    currentReadinessPercent,
    readinessDelta: currentReadinessPercent - priorReadinessPercent,
    closedGaps: closedGaps.slice(0, 5),
    remainingGaps: remainingGaps.slice(0, 5),
    newGaps: newGaps.slice(0, 5),
    competencyDeltas,
  };
}

function parsePackQuestionLines(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.replace(/^[\s•\-–—\d.)\]]+/, '').trim())
    .filter((line) => line.length > 12 && (line.includes('?') || line.length > 24))
    .slice(0, 12);
}

function extractEmployerQuestions(collected: CollectedData): string[] {
  const raw = collected.prepArtifacts;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (
        item != null &&
        typeof item === 'object' &&
        (item as PrepArtifactLike).packType === 'employer_questions' &&
        typeof (item as PrepArtifactLike).content === 'string'
      ) {
        const parsed = parsePackQuestionLines((item as PrepArtifactLike).content);
        if (parsed.length > 0) return parsed;
      }
    }
  }

  const history = collected.employer_questionsHistory;
  if (!Array.isArray(history)) return [];
  const questions: string[] = [];
  for (const entry of history) {
    const msg = (entry as { userMessage?: string }).userMessage;
    if (msg?.trim()) questions.push(msg.trim());
  }
  return questions.slice(0, 8);
}

function extractCheatsheets(collected: CollectedData): PrepArtifactLike[] {
  const raw = collected.prepArtifacts;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is PrepArtifactLike =>
        item != null &&
        typeof item === 'object' &&
        typeof (item as PrepArtifactLike).content === 'string' &&
        typeof (item as PrepArtifactLike).packType === 'string'
    )
    .filter((item) => !['prep_complete', 'mock_summary'].includes(item.packType))
    .map((item) => ({
      packType: item.packType,
      title: item.title || item.packType,
      content: item.content,
    }))
    .slice(0, 12);
}

function computeReadinessPercent(collected: CollectedData): number {
  const raw = collected.prepProgress as { overallPercent?: number } | undefined;
  if (typeof raw?.overallPercent === 'number') return raw.overallPercent;
  const checklist = buildChecklist(collected, 0);
  const done = checklist.filter((item) => item.done).length;
  return Math.round((done / checklist.length) * 100);
}

function buildDayProgress(collected: CollectedData): InterviewPrepReportData['dayProgress'] {
  const plan = collected.prepPlan;
  if (!Array.isArray(plan)) return [];
  const progress = collected.prepProgress as
    | { activities?: Array<{ day: number; required: boolean; completed: boolean }> }
    | undefined;
  const activities = progress?.activities ?? [];
  return plan
    .filter((day): day is { day: number; focus: string } => day != null && typeof day === 'object')
    .map((day) => {
      const dayRequired = activities.filter((a) => a.day === day.day && a.required);
      const done =
        dayRequired.length > 0
          ? dayRequired.every((a) => a.completed)
          : Boolean(collected.mockPhase === 'complete' && day.day === 5);
      return { day: day.day, focus: String(day.focus ?? ''), done };
    });
}

export function isInterviewPrepTrainerCollected(collected: CollectedData): boolean {
  return Boolean(collected.vacancyProfile && collected.prepPlan);
}

export const interviewPrepReportGenerator = {
  buildFromCollected(sessionId: string, collected: CollectedData): InterviewPrepReportData {
    logger.info('Building interview prep report', { sessionId });
    const profile = (collected.vacancyProfile ?? {}) as InterviewPrepReportData['vacancyProfile'];
    const readinessPercent = computeReadinessPercent(collected);
    const readinessStatus =
      readinessPercent >= 80 ? 'Готов к собеседованию' : 'Нужно закрыть пробелы';

    const competencyScores = aggregateCompetencyScores(collected);
    const fatalGaps = collectFatalGaps(collected);
    const priorSnapshot = collected.priorPrepSnapshot as PriorPrepSnapshotLike | undefined;
    const progressComparison =
      priorSnapshot?.role
        ? buildProgressComparison(priorSnapshot, readinessPercent, fatalGaps, competencyScores)
        : undefined;

    return {
      sessionId,
      generatedAt: new Date().toISOString(),
      role: profile.role || 'Роль не указана',
      level: profile.level || 'Уровень не указан',
      company: (collected.vacancyCompany as string) || 'Вакансия',
      readinessPercent,
      readinessStatus,
      executiveSummary: collectExecutiveSummary(collected),
      vacancyProfile: profile,
      competencyScores,
      fatalGaps,
      starStories: extractStarStories(collected),
      caseStructures: extractCaseStructures(collected),
      employerQuestions: extractEmployerQuestions(collected),
      checklist: buildChecklist(collected, readinessPercent),
      dayProgress: buildDayProgress(collected),
      mockSummary: typeof collected.mockSummary === 'string' ? collected.mockSummary : undefined,
      cheatsheets: extractCheatsheets(collected),
      progressComparison,
    };
  },
};
