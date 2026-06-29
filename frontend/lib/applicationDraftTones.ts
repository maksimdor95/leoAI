import type { ApplicationDraftTone } from '@/types/jobs';

export const APPLICATION_DRAFT_TONE_OPTIONS: {
  tone: ApplicationDraftTone;
  label: string;
}[] = [
  { tone: 'concise', label: 'Короче' },
  { tone: 'detailed', label: 'Развернуть' },
  { tone: 'formal', label: 'Формальнее' },
  { tone: 'casual', label: 'Легче' },
  { tone: 'human', label: 'Человечнее' },
  { tone: 'warm', label: 'Теплее' },
  { tone: 'metrics', label: 'Про цифры' },
  { tone: 'job_fit', label: 'Под вакансию' },
];

export const APPLICATION_DRAFT_TONES: ApplicationDraftTone[] = [
  'neutral',
  'formal',
  'concise',
  'casual',
  'human',
  'warm',
  'metrics',
  'detailed',
  'job_fit',
];

export function isApplicationDraftTone(value: unknown): value is ApplicationDraftTone {
  return typeof value === 'string' && APPLICATION_DRAFT_TONES.includes(value as ApplicationDraftTone);
}
