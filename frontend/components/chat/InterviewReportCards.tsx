'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Button, Spin } from 'antd';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import type { InfoCardMessage } from '@/types/chat';

/** Ответ GET /api/chat/session/:id/report-preview (совпадает с ReportData в report-service). */
export type InterviewReportPreview = {
  targetRole: string;
  targetProductType?: string;
  evaluation: {
    overallScore: number;
    categoryScores: { category: string; score: number; comment: string }[];
    strengths: string[];
    areasForImprovement: string[];
  };
  recommendations: string[];
  typicalQuestions: string[];
  generatedAt: string;
};

type InterviewReportCardsProps = {
  infoCard: InfoCardMessage;
  preview: InterviewReportPreview | null;
  loading: boolean;
  error: string | null;
  onDownloadPdf: () => void;
  onRestart: () => void;
};

type SectionId = 'score' | 'recommendations' | 'questions' | 'pdf';

function cardTitleWithoutIcon(title: string, icon?: string): string {
  const t = title.trim();
  if (icon && t.startsWith(icon)) {
    return t.slice(icon.length).trim();
  }
  return t.replace(/^[\p{Extended_Pictographic}\uFE0F\u200d\s]+/u, '').trim() || title;
}

export function InterviewReportCards({
  infoCard,
  preview,
  loading,
  error,
  onDownloadPdf,
  onRestart,
}: InterviewReportCardsProps) {
  const [openId, setOpenId] = useState<SectionId | null>('score');

  const metaBySection = useMemo(() => {
    const cards = infoCard.cards || [];
    const pick = (i: number, fallbackIcon: string) => {
      const c = cards[i];
      return {
        icon: c?.icon || fallbackIcon,
        title: c ? cardTitleWithoutIcon(c.title, c.icon) : '',
      };
    };
    return {
      score: pick(0, '📊'),
      recommendations: pick(1, '📝'),
      questions: pick(2, '❓'),
      pdf: pick(3, '📄'),
    };
  }, [infoCard.cards]);

  const toggle = (id: SectionId) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 py-14 px-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-green-500/20 blur-xl scale-150" aria-hidden />
          <Spin size="large" className="[&_.ant-spin-dot-item]:!bg-green-400" />
        </div>
        <div className="text-center space-y-1.5 max-w-sm">
          <p className="text-sm font-medium text-slate-200">Формируем разбор</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Считаем оценки, рекомендации и подборку вопросов под твою цель…
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/[0.07] px-4 py-3.5 backdrop-blur-sm">
        <p className="text-sm text-amber-200/95 leading-relaxed">
          <span className="font-medium text-amber-100">Не удалось загрузить разбор.</span>{' '}
          <span className="text-amber-200/80">{error}</span>
        </p>
      </div>
    );
  }

  const ev = preview?.evaluation;
  const recs = preview?.recommendations ?? [];
  const questions = preview?.typicalQuestions ?? [];
  const roleLabel = preview?.targetRole ?? '—';

  const scoreTeaser = ev
    ? `Итог ${ev.overallScore}/10 · ${ev.strengths.slice(0, 2).join(', ')}`
    : 'Итоговый балл и комментарии по темам интервью.';

  const recTeaser =
    recs.length > 0 ? recs.slice(0, 2).join(' · ') : 'Советы по подготовке и следующим шагам.';

  const qTeaser =
    questions.length > 0
      ? `${questions.length} вопросов для уровня «${roleLabel}»`
      : 'Подборка вопросов под твой целевой грейд.';

  const pdfTeaser = 'Скачать PDF или пройти пробное интервью заново.';

  return (
    <div className="interview-report-scope w-full max-w-4xl mx-auto space-y-6 sm:space-y-8">
      {/* Заголовок экрана */}
      <header className="relative">
        <div
          className="absolute -left-px top-0 h-8 w-px rounded-full bg-gradient-to-b from-green-400/80 via-emerald-400/40 to-transparent"
          aria-hidden
        />
        <div className="pl-4 sm:pl-5">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.2em] text-green-400/90 mb-2">
            Информация
          </p>
          <h2 className="text-xl sm:text-2xl lg:text-[1.65rem] font-bold text-white tracking-tight leading-tight">
            {infoCard.title}
          </h2>
          {infoCard.description ? (
            <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-2xl">
              {infoCard.description}
            </p>
          ) : null}
        </div>
      </header>

      {/* Сетка карточек 2×2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 auto-rows-min">
        <ReportSection
          id="score"
          openId={openId}
          onToggle={toggle}
          icon={metaBySection.score.icon}
          label={metaBySection.score.title || 'Оценка'}
          teaser={scoreTeaser}
        >
          {ev ? (
            <div className="space-y-4 text-xs text-slate-200 leading-relaxed">
              <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
                <p>
                  <span className="text-slate-500">Целевая роль</span>
                  <span className="ml-2 text-sm font-semibold text-white">{roleLabel}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span className="text-slate-500">Общий балл</span>
                  <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-sm font-bold tabular-nums text-emerald-300 ring-1 ring-emerald-400/25">
                    {ev.overallScore} / 10
                  </span>
                </p>
              </div>
              <div>
                <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 mb-2">
                  По темам интервью
                </div>
                {ev.categoryScores.length > 0 ? (
                  <ul className="space-y-2.5 list-none pl-0">
                    {ev.categoryScores.map((row) => (
                      <li
                        key={row.category}
                        className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                      >
                        <div className="flex justify-between gap-3 text-[13px] text-slate-100">
                          <span className="font-medium">{row.category}</span>
                          <span className="shrink-0 tabular-nums text-emerald-300/95">{row.score}/10</span>
                        </div>
                        <ScoreBar score={row.score} />
                        <p className="text-slate-400 mt-2 text-[11px] leading-snug">{row.comment}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Нет сохранённых ответов на вопросы интервью в этой сессии — оценка опирается на
                    продуктовый кейс и общие данные.
                  </p>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2 text-[11px]">
                <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                  <span className="text-slate-500 block mb-0.5">Сильные стороны</span>
                  <span className="text-slate-200">{ev.strengths.join(', ')}</span>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                  <span className="text-slate-500 block mb-0.5">Зоны роста</span>
                  <span className="text-slate-200">{ev.areasForImprovement.join(', ')}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Нет данных для оценки.</p>
          )}
        </ReportSection>

        <ReportSection
          id="recommendations"
          openId={openId}
          onToggle={toggle}
          icon={metaBySection.recommendations.icon}
          label={metaBySection.recommendations.title || 'Рекомендации'}
          teaser={recTeaser}
        >
          {recs.length > 0 ? (
            <ul className="space-y-2.5 text-[13px] text-slate-200 leading-relaxed pl-0 list-none">
              {recs.map((line, i) => (
                <li
                  key={i}
                  className="flex gap-2.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                >
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-400/80 shadow-[0_0_8px_rgba(74,222,128,0.45)]"
                    aria-hidden
                  />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Рекомендации появятся после анализа ответов.</p>
          )}
        </ReportSection>

        <ReportSection
          id="questions"
          openId={openId}
          onToggle={toggle}
          icon={metaBySection.questions.icon}
          label={metaBySection.questions.title || 'Вопросы'}
          teaser={qTeaser}
        >
          {questions.length > 0 ? (
            <ol className="space-y-2.5 text-[13px] text-slate-200 leading-relaxed pl-0 list-none">
              {questions.map((q, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/[0.06] text-[11px] font-semibold text-green-300">
                    {i + 1}
                  </span>
                  <span className="pt-0.5">{q}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-xs text-slate-500">Список вопросов подготовится по твоему уровню.</p>
          )}
        </ReportSection>

        <ReportSection
          id="pdf"
          openId={openId}
          onToggle={toggle}
          icon={metaBySection.pdf.icon}
          label={metaBySection.pdf.title || 'PDF-отчёт'}
          teaser={pdfTeaser}
        >
          <div className="space-y-4">
            <p className="text-[13px] text-slate-400 leading-relaxed">
              В PDF — те же разделы, что выше, в удобном для печати виде. Сохрани файл и вернись к
              подготовке в любой момент.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              <Button
                type="primary"
                size="large"
                className="!h-11 !px-6 !rounded-full !border-0 !font-semibold !shadow-lg !shadow-green-500/20 !bg-gradient-to-r !from-green-500 !to-emerald-600 hover:!from-green-400 hover:!to-emerald-500 !text-white"
                onClick={(e) => {
                  e.stopPropagation();
                  onDownloadPdf();
                }}
              >
                Скачать PDF-отчёт
              </Button>
              <Button
                size="large"
                className="!h-11 !px-6 !rounded-full !font-medium !border !border-white/20 !bg-white/[0.06] !text-slate-100 hover:!border-green-400/40 hover:!bg-white/[0.1] hover:!text-white hover:!shadow-[0_0_24px_-8px_rgba(34,197,94,0.25)]"
                onClick={(e) => {
                  e.stopPropagation();
                  onRestart();
                }}
              >
                Пройти интервью ещё раз
              </Button>
            </div>
          </div>
        </ReportSection>
      </div>

      {preview?.generatedAt ? (
        <footer className="flex items-center gap-2 pt-2 border-t border-white/10">
          <span className="h-px flex-1 max-w-[4rem] bg-gradient-to-r from-transparent via-green-500/30 to-transparent" />
          <p className="text-[11px] text-slate-500 tabular-nums">
            Разбор актуален на{' '}
            <time dateTime={preview.generatedAt}>
              {new Date(preview.generatedAt).toLocaleString('ru-RU')}
            </time>
          </p>
        </footer>
      ) : null}
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, (score / 10) * 100));
  return (
    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08] ring-1 ring-inset ring-white/[0.08]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-600/90 to-green-400/90 transition-[width] duration-300"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function ReportSection({
  id,
  openId,
  onToggle,
  icon,
  label,
  teaser,
  children,
}: {
  id: SectionId;
  openId: SectionId | null;
  onToggle: (id: SectionId) => void;
  icon: string;
  label: string;
  teaser: string;
  children: ReactNode;
}) {
  const open = openId === id;
  return (
    <div
      className={`interview-report-card group rounded-2xl border transition-all duration-200 ease-out ${
        open ? 'interview-report-card--open' : ''
      }`}
    >
      <button
        type="button"
        onClick={() => onToggle(id)}
        aria-expanded={open}
        className="interview-report-card-trigger w-full text-left rounded-2xl px-3.5 py-3 sm:px-4 sm:py-3.5 flex gap-3"
      >
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl leading-none transition-colors ${
            open
              ? 'border border-green-400/35 bg-gradient-to-br from-green-500/15 to-emerald-600/10 text-[1.15rem]'
              : 'border border-white/12 bg-white/[0.06] text-[1.15rem] group-hover:border-green-400/30 group-hover:bg-white/[0.09]'
          }`}
          aria-hidden
        >
          {icon}
        </span>
        <span className="min-w-0 flex-1 pt-0.5">
          <span className="flex items-start justify-between gap-2">
            <span className="text-sm font-semibold text-white tracking-tight">{label}</span>
            <span
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                open
                  ? 'border-green-400/35 bg-green-500/15 text-green-300'
                  : 'border-white/12 bg-white/[0.06] text-slate-400 group-hover:border-green-400/28 group-hover:text-green-200/90'
              }`}
            >
              {open ? <UpOutlined className="text-[11px]" /> : <DownOutlined className="text-[11px]" />}
            </span>
          </span>
          {!open ? (
            <span className="mt-1.5 block text-xs text-slate-400 line-clamp-2 leading-snug">{teaser}</span>
          ) : null}
        </span>
      </button>
      {open ? (
        <div className="px-3.5 pb-3.5 sm:px-4 sm:pb-4 pt-0">
          <div className="border-t border-white/10 pt-4">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
