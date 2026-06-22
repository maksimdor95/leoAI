/**
 * Interview prep protocol — state machine helpers (§4.5 mock, §4.6 rescue).
 * Spec: docs/INTERVIEW_PREP_MOCK_RITUAL_PROMPT_SPEC.md, INTERVIEW_PREP_RESCUE_PROMPT_SPEC.md
 */

export type MockPhase = 'briefing' | 'active' | 'debrief' | 'complete';

export type InterviewResponsePhase =
  | 'default'
  | 'mock_active'
  | 'mock_micro_rescue'
  | 'mock_debrief'
  | 'rescue';

export const RESCUE_SCORE_THRESHOLD = 4;

export type RescueGrading = {
  overallScore: number;
  fatalGaps?: string[];
};

const WEAK_ANSWER_PATTERN =
  /^(не\s*знаю|не\s*уверен|не\s*уверена|затрудняюсь|хз|нет\s*идей|не\s*помню)\.?$/i;

export function isModeStartCommand(userMessage: string): boolean {
  return /^начать режим:/i.test(userMessage.trim());
}

export function isMockReadySignal(userMessage: string): boolean {
  const value = userMessage.trim().toLowerCase();
  if (isModeStartCommand(userMessage)) {
    return false;
  }
  return (
    /^(готов|готова|готовы|начать|начинаем|да|ok|ок|go|start|поехали|давай)$/.test(value) ||
    /^начать мок/.test(value)
  );
}

export function inferSeniorityFromLevel(level?: string): 'junior' | 'middle' | 'senior' | 'lead' | 'unknown' {
  const value = (level ?? '').toLowerCase();
  if (/(junior|intern|стажер|джун)/.test(value)) return 'junior';
  if (/(middle|mid|мидл)/.test(value)) return 'middle';
  if (/(senior|sen|сеньор)/.test(value)) return 'senior';
  if (/(lead|head|staff|principal|director|vp|руковод)/.test(value)) return 'lead';
  return 'unknown';
}

export function getRescueAttemptLimit(level?: string): number {
  switch (inferSeniorityFromLevel(level)) {
    case 'junior':
      return 3;
    case 'middle':
      return 2;
    case 'senior':
      return 2;
    case 'lead':
      return 1;
    default:
      return 2;
  }
}

export function isExplicitWeakAnswer(answer: string): boolean {
  const trimmed = answer.trim();
  return trimmed.length < 25 || WEAK_ANSWER_PATTERN.test(trimmed);
}

/** Full Rescue for case/star (§4.6). */
export function shouldTriggerFullRescue(
  grading: RescueGrading | null | undefined,
  answer: string,
  mode: string
): boolean {
  if (mode !== 'case' && mode !== 'star') {
    return false;
  }
  if (isExplicitWeakAnswer(answer)) {
    return true;
  }
  if (!grading) {
    return false;
  }
  if (grading.overallScore < RESCUE_SCORE_THRESHOLD) {
    return true;
  }
  return (grading.fatalGaps?.length ?? 0) >= 2;
}

/** One-line structure hint between mock questions (§4.5). */
export function shouldTriggerMicroRescue(
  grading: RescueGrading | null | undefined,
  mode: string,
  mockPhase?: string
): boolean {
  return (
    mode === 'mock' &&
    mockPhase === 'active' &&
    grading != null &&
    grading.overallScore < RESCUE_SCORE_THRESHOLD
  );
}

export function buildMockBriefingMessage(role?: string): string {
  const roleLabel = role?.trim() || 'вашей вакансии';
  return [
    `Сейчас начнём пробное собеседование. Я переключусь в роль нанимающего менеджера по вакансии «${roleLabel}».`,
    '',
    'Это безопасная среда: цель — увидеть пробелы до реального собеса, а не получить оффер.',
    '',
    'Формат: 3 вопроса, по одному. После каждого — короткий разбор. В конце — итоговый отчёт.',
    '',
    'Когда будете готовы — напишите «готов».',
  ].join('\n');
}

export function getRescueCountKey(mode: string): string {
  return `${mode}RescueCount`;
}
