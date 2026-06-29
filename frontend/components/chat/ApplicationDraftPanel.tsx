'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Select, Spin, message } from 'antd';
import { CopyOutlined } from '@ant-design/icons';
import {
  generateApplicationDraft,
  recordJobInteraction,
} from '@/lib/jobApi';
import { APPLICATION_DRAFT_TONE_OPTIONS } from '@/lib/applicationDraftTones';
import { humanizeMatchReasons } from '@/lib/humanizeMatchReasons';
import type { ApplicationDraftResponse, ApplicationDraftTone } from '@/types/jobs';
import { useHumeTheme } from '@/lib/useHumeTheme';

type ApplicationDraftPanelProps = {
  jobId: string;
  sessionId?: string | null;
  matchReasons?: string[];
  onCoverLetterChange?: (coverLetter: string) => void;
};

type DraftState = 'idle' | 'generating' | 'ready' | 'error';

const DARK_SECONDARY_BTN =
  '!rounded-lg !border !border-white/15 !bg-white/[0.05] !text-slate-200 hover:!border-white/25 hover:!bg-white/10 hover:!text-white !shadow-none';
const DARK_PRIMARY_BTN =
  '!h-10 !rounded-lg !bg-emerald-600 !border-emerald-600 hover:!bg-emerald-500 hover:!border-emerald-500 !text-white !shadow-none';

export function ApplicationDraftPanel({
  jobId,
  sessionId,
  matchReasons,
  onCoverLetterChange,
}: ApplicationDraftPanelProps) {
  const isHume = useHumeTheme();
  const [state, setState] = useState<DraftState>('idle');
  const [draft, setDraft] = useState<ApplicationDraftResponse | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tone, setTone] = useState<ApplicationDraftTone>('neutral');

  useEffect(() => {
    onCoverLetterChange?.(coverLetter);
  }, [coverLetter, onCoverLetterChange]);

  const matchHighlights = humanizeMatchReasons(matchReasons)
    .filter((item) => item.tone !== 'negative')
    .map((item) => item.text)
    .slice(0, 5);

  const loadDraft = useCallback(
    async (options?: { regenerate?: boolean; nextTone?: ApplicationDraftTone }) => {
      setState('generating');
      setErrorMessage(null);
      const effectiveTone = options?.nextTone ?? tone;

      try {
        const result = await generateApplicationDraft(jobId, {
          sessionId: sessionId ?? undefined,
          tone: effectiveTone,
          regenerate: options?.regenerate,
          matchHighlights,
        });
        setDraft(result);
        setCoverLetter(result.coverLetter);
        setTone(effectiveTone);
        setState('ready');
        void recordJobInteraction(jobId, 'draft_generated');
      } catch (error: unknown) {
        setState('error');
        setErrorMessage(
          error instanceof Error ? error.message : 'Не удалось подготовить отклик'
        );
      }
    },
    [jobId, matchHighlights, sessionId, tone]
  );

  const handleCopy = async () => {
    if (!coverLetter.trim()) return;
    try {
      await navigator.clipboard.writeText(coverLetter);
      message.success('Сопроводительное скопировано');
    } catch {
      message.error('Не удалось скопировать текст');
    }
  };

  return (
    <div
      className={
        isHume
          ? 'rounded-2xl border border-[rgba(34,34,34,0.08)] bg-[var(--color-bone)] p-4 space-y-3'
          : 'rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 space-y-3'
      }
    >
      {state === 'idle' ? (
        <>
          <p className={isHume ? 'hume-body-sm leading-relaxed' : 'text-xs text-slate-400 leading-relaxed'}>
            Сопроводительное по вашему профилю из чата — можно отредактировать перед откликом.
          </p>
          <Button
            type="primary"
            onClick={() => void loadDraft()}
            className={isHume ? 'vacancy-primary-btn !w-full sm:!w-auto' : `${DARK_PRIMARY_BTN} !w-full sm:!w-auto`}
          >
            Сгенерировать
          </Button>
        </>
      ) : null}

      {state === 'generating' ? (
        <div className={`flex items-center gap-2 py-1 text-sm ${isHume ? 'vacancy-muted-text' : 'text-slate-300'}`}>
          <Spin size="small" />
          Пишем письмо…
        </div>
      ) : null}

      {state === 'error' ? (
        <div className="space-y-2">
          <p className={isHume ? 'text-sm text-red-600' : 'text-sm text-red-300'}>{errorMessage}</p>
          <Button
            onClick={() => void loadDraft({ regenerate: true })}
            className={isHume ? 'vacancy-secondary-btn' : DARK_SECONDARY_BTN}
          >
            Повторить
          </Button>
        </div>
      ) : null}

      {state === 'ready' && draft ? (
        <div className="space-y-3">
          <Input.TextArea
            value={coverLetter}
            onChange={(event) => setCoverLetter(event.target.value)}
            autoSize={{ minRows: 6, maxRows: 12 }}
            className={
              isHume
                ? '!bg-[var(--color-paper)] !text-[var(--color-ink)] !border-[rgba(34,34,34,0.12)] !rounded-xl'
                : '!bg-[#0a0f1e] !text-slate-200 !border-white/10'
            }
          />

          <div className="draft-tone-toolbar">
            <Select
              placeholder="Стиль письма"
              value={tone === 'neutral' ? undefined : tone}
              placement="bottomLeft"
              onChange={(nextTone: ApplicationDraftTone) => {
                void loadDraft({ regenerate: true, nextTone });
              }}
              options={APPLICATION_DRAFT_TONE_OPTIONS.map((option) => ({
                value: option.tone,
                label: option.label,
              }))}
              className="draft-tone-select"
              classNames={{ popup: { root: 'draft-tone-select-dropdown' } }}
              popupMatchSelectWidth
            />
            <Button
              icon={<CopyOutlined aria-hidden />}
              onClick={() => void handleCopy()}
              className={`draft-tone-copy ${isHume ? 'vacancy-secondary-btn' : DARK_SECONDARY_BTN}`}
            >
              Копировать
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
