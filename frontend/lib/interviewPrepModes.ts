import type { CommandItem, InterviewPrepMode, Message } from '@/types/chat';
import { MessageRole, MessageType } from '@/types/chat';

export const INTERVIEW_PREP_MODES: InterviewPrepMode[] = [
  'diagnostics',
  'theory',
  'case',
  'mock',
  'star',
  'employer_questions',
];

export const INTERVIEW_PREP_MODE_LABELS: Record<InterviewPrepMode, string> = {
  diagnostics: 'Диагностика',
  theory: 'Теория',
  case: 'Кейс',
  mock: 'Мок-интервью',
  star: 'STAR',
  employer_questions: 'Вопросы работодателю',
};

/** Короткие подписи для табов в истории диалога. */
export const INTERVIEW_PREP_MODE_TAB_LABELS: Record<InterviewPrepMode, string> = {
  diagnostics: 'Диагностика',
  theory: 'Теория',
  case: 'Кейс',
  mock: 'Мок',
  star: 'STAR',
  employer_questions: 'Работодат.',
};

export type PrepHistoryFilter = 'general' | InterviewPrepMode;

export function parseInterviewModeFromAction(action: string): InterviewPrepMode | null {
  if (!action.startsWith('interview_mode:')) {
    return null;
  }
  const raw = action.replace('interview_mode:', '');
  return INTERVIEW_PREP_MODES.includes(raw as InterviewPrepMode)
    ? (raw as InterviewPrepMode)
    : null;
}

export function filterMessagesByPrepHistory(
  messages: Message[],
  filter: PrepHistoryFilter
): Message[] {
  if (filter === 'general') {
    return messages.filter((m) => !m.interviewMode);
  }
  return messages.filter((m) => m.interviewMode === filter);
}

/** Рекомендуемые режимы тренажёра по дням плана подготовки. */
export const PREP_DAY_SUGGESTED_MODES: Record<number, InterviewPrepMode[]> = {
  1: ['diagnostics', 'theory'],
  2: ['star', 'theory', 'case'],
  3: ['theory', 'case', 'star'],
  4: ['star', 'employer_questions'],
  5: ['case', 'mock'],
};

export function interviewModeCommandItem(mode: InterviewPrepMode): CommandItem {
  return {
    id: mode,
    label: INTERVIEW_PREP_MODE_LABELS[mode],
    action: `interview_mode:${mode}`,
  };
}

/** Одно сообщение для старта режима (без executeCommand + sendMessage). */
export function buildInterviewPrepModeStartMessage(
  mode: InterviewPrepMode,
  day?: number
): string {
  const label = INTERVIEW_PREP_MODE_LABELS[mode];
  return typeof day === 'number' ? `Начать режим: ${label} · день ${day}` : `Начать режим: ${label}`;
}

export function isInterviewPrepStageAssistantMessage(message: Message): boolean {
  if (message.role !== MessageRole.ASSISTANT) {
    return false;
  }
  if (message.type === MessageType.QUESTION && message.interviewMode) {
    return true;
  }
  return message.type === MessageType.TEXT && Boolean(message.interviewMode);
}

export function getInterviewPrepStageText(message: Message): string {
  if (message.type === MessageType.QUESTION) {
    return message.question;
  }
  if (message.type === MessageType.TEXT) {
    return message.content;
  }
  return '';
}

export function getInterviewPrepStageModeLabel(message: Message): string {
  if (message.type === MessageType.QUESTION) {
    return 'Вопрос';
  }
  if (message.type === MessageType.TEXT && message.interviewMode) {
    return INTERVIEW_PREP_MODE_LABELS[message.interviewMode];
  }
  return 'LEO';
}
