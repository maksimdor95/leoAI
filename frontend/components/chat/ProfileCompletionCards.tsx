'use client';

import { useState, useMemo, type ReactNode } from 'react';
import { Button, Input } from 'antd';
import type { InfoCardMessage } from '@/types/chat';

type ProfileCompletionCardsProps = {
  infoCard: InfoCardMessage;
  onGenerateResume: () => void;
  onSendResumeEmail: (email?: string) => void;
  onGenerateSummary?: () => void;
  resumeLoading?: boolean;
  emailLoading?: boolean;
  summaryLoading?: boolean;
  userEmail?: string;
};

function stripIconPrefix(title: string, icon?: string): string {
  if (!icon) return title;
  const t = title.trim();
  return t.startsWith(icon) ? t.slice(icon.length).trim() : title;
}

function normalizeCompletionCardTitle(title: string): string {
  const normalized = title.trim();
  if (normalized === 'Профессиональное саммари' || normalized === 'Саммари') {
    return 'Профессиональная оценка';
  }
  return normalized;
}

export function ProfileCompletionCards({
  infoCard,
  onGenerateResume,
  onSendResumeEmail,
  onGenerateSummary,
  resumeLoading = false,
  emailLoading = false,
  summaryLoading = false,
  userEmail = '',
}: ProfileCompletionCardsProps) {
  const [customEmail, setCustomEmail] = useState(userEmail);

  const meta = useMemo(() => {
    const cards = infoCard.cards || [];
    const pick = (i: number, fallbackIcon: string, fallbackTitle: string) => {
      const c = cards[i];
      return {
        icon: c?.icon || fallbackIcon,
        title: c
          ? normalizeCompletionCardTitle(stripIconPrefix(c.title, c.icon))
          : fallbackTitle,
      };
    };
    return {
      summary: pick(0, '🧾', 'Профессиональная оценка'),
      resume: pick(1, '📄', 'Резюме'),
      email: pick(2, '✉️', 'Email'),
      matching: pick(3, '🎯', 'Вакансии'),
    };
  }, [infoCard.cards]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      <div className="pl-3">
        <h2 className="text-base sm:text-lg font-bold text-white leading-tight flex items-center gap-2">
          <span className="text-base">✅</span> Профиль собран
        </h2>
        {infoCard.description ? (
          <p className="mt-1 text-xs text-slate-400 leading-relaxed">{infoCard.description}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <CompletionCard icon={meta.summary.icon} label={meta.summary.title}>
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Экспертная оценка по 10 критериям. После генерации — PDF или DOCX в чате.
            </p>
            <Button
              type="primary"
              size="small"
              onClick={onGenerateSummary}
              loading={summaryLoading}
              className="!h-7 !px-3 !rounded-full !border-0 !font-medium !shadow-md !shadow-green-500/15 !bg-gradient-to-r !from-green-500 !to-emerald-600 hover:!from-green-400 hover:!to-emerald-500 !text-white !text-xs"
            >
              Сформировать
            </Button>
          </div>
        </CompletionCard>

        <CompletionCard icon={meta.resume.icon} label={meta.resume.title}>
          <div className="space-y-2">
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Черновик в формате HH: опыт, навыки, образование.
            </p>
            <Button
              type="primary"
              size="small"
              onClick={onGenerateResume}
              loading={resumeLoading}
              className="!h-7 !px-3 !rounded-full !border-0 !font-medium !shadow-md !shadow-green-500/15 !bg-gradient-to-r !from-green-500 !to-emerald-600 hover:!from-green-400 hover:!to-emerald-500 !text-white !text-xs"
            >
              Сформировать
            </Button>
          </div>
        </CompletionCard>

        <CompletionCard icon={meta.email.icon} label={meta.email.title}>
          <div className="space-y-2">
            <Input
              size="small"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              placeholder="your@email.com"
              className="!bg-white/[0.06] !border-white/15 !text-slate-100 !rounded-full !h-7 !text-xs placeholder:!text-slate-500 focus:!border-green-400/50"
            />
            <Button
              size="small"
              onClick={() => onSendResumeEmail(customEmail || undefined)}
              loading={emailLoading}
              disabled={!customEmail || !customEmail.includes('@')}
              className="!h-7 !px-3 !rounded-full !font-medium !border !border-white/15 !bg-white/[0.05] !text-slate-200 hover:!border-green-400/30 hover:!bg-white/[0.1] hover:!text-white !text-xs"
            >
              Отправить
            </Button>
          </div>
        </CompletionCard>

        <CompletionCard icon={meta.matching.icon} label={meta.matching.title}>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            LEO обновляет подбор. Перейдите во вкладку{' '}
            <span className="text-green-400 font-medium">Вакансии</span>.
          </p>
        </CompletionCard>
      </div>
    </div>
  );
}

function CompletionCard(props: {
  icon: string;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  const { icon, label, children, className } = props;
  return (
    <article
      className={`rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 space-y-2 hover:border-white/[0.14] transition-colors ${className || ''}`}
    >
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-green-400/20 bg-green-500/[0.07] text-sm leading-none">
          {icon}
        </span>
        <h3 className="text-xs font-semibold text-white">{label}</h3>
      </div>
      <div>{children}</div>
    </article>
  );
}
