import type { InterviewPrepMode, Message, TextMessage } from '@/types/chat';
import { INTERVIEW_PREP_MODE_LABELS } from '@/lib/interviewPrepModes';

export type PrepPackType =
  | 'diagnostics_map'
  | 'theory_cheatsheet'
  | 'rescue_cheatsheet'
  | 'star_pack'
  | 'case_structure'
  | 'mock_summary'
  | 'employer_questions'
  | 'prep_complete';

export interface PrepArtifact {
  id: string;
  packType: PrepPackType;
  mode: InterviewPrepMode;
  title: string;
  content: string;
  createdAt: string;
  messageId?: string;
}

export const PREP_PACK_LABELS: Record<PrepPackType, string> = {
  diagnostics_map: 'Карта пробелов',
  theory_cheatsheet: 'Шпаргалка из урока',
  rescue_cheatsheet: 'Разбор коуча',
  star_pack: 'STAR-история',
  case_structure: 'Структура кейса',
  mock_summary: 'Итог мок-интервью',
  employer_questions: 'Вопросы работодателю',
  prep_complete: 'Итог подготовки',
};

const PACK_TYPE_ORDER: PrepPackType[] = [
  'diagnostics_map',
  'theory_cheatsheet',
  'rescue_cheatsheet',
  'star_pack',
  'case_structure',
  'employer_questions',
  'mock_summary',
  'prep_complete',
];

function isPrepPackType(value: string): value is PrepPackType {
  return value in PREP_PACK_LABELS;
}

export function getArtifactsFromCollected(collected: Record<string, unknown>): PrepArtifact[] {
  const raw = collected.prepArtifacts;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (item): item is PrepArtifact =>
        item != null &&
        typeof item === 'object' &&
        typeof (item as PrepArtifact).packType === 'string' &&
        typeof (item as PrepArtifact).content === 'string'
    )
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function getArtifactsFromMessages(messages: Message[]): PrepArtifact[] {
  const fromMessages: PrepArtifact[] = [];
  for (const message of messages) {
    if (message.role !== 'assistant') continue;
    const packType =
      message.type === 'text'
        ? (message as TextMessage & { packType?: PrepPackType }).packType
        : message.type === 'info_card'
          ? (message as { packType?: PrepPackType }).packType
          : undefined;
    if (!packType || !isPrepPackType(packType)) continue;
    const content =
      message.type === 'text'
        ? message.content
        : message.type === 'info_card'
          ? [message.title, message.description, ...message.cards.map((c) => c.content)]
              .filter(Boolean)
              .join('\n\n')
          : '';
    if (!content.trim()) continue;
    fromMessages.push({
      id: `msg-${message.id}`,
      packType,
      mode: message.interviewMode ?? 'theory',
      title: PREP_PACK_LABELS[packType],
      content,
      createdAt: message.timestamp,
      messageId: message.id,
    });
  }
  return fromMessages;
}

/** Объединяет persisted prepArtifacts и сообщения с packType (без дублей). */
export function resolvePrepArtifacts(
  collected: Record<string, unknown>,
  messages: Message[]
): PrepArtifact[] {
  const merged = new Map<string, PrepArtifact>();
  for (const artifact of getArtifactsFromCollected(collected)) {
    merged.set(`${artifact.packType}:${artifact.id}`, artifact);
  }
  for (const artifact of getArtifactsFromMessages(messages)) {
    const key = `${artifact.packType}:${artifact.messageId ?? artifact.id}`;
    if (!merged.has(key)) {
      merged.set(key, artifact);
    }
  }
  return Array.from(merged.values()).sort((a, b) => {
    const typeDelta = PACK_TYPE_ORDER.indexOf(a.packType) - PACK_TYPE_ORDER.indexOf(b.packType);
    if (typeDelta !== 0) return typeDelta;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function packModeLabel(mode: InterviewPrepMode): string {
  return INTERVIEW_PREP_MODE_LABELS[mode];
}
