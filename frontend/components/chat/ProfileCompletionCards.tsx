'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { DownOutlined, UpOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import type { InfoCardMessage } from '@/types/chat';

type CompletionSectionId = 'summary' | 'resume' | 'email' | 'matching';

type ProfileCompletionCardsProps = {
  infoCard: InfoCardMessage;
  onGenerateResume: () => void;
  onSendResumeEmail: () => void;
  resumeLoading?: boolean;
  emailLoading?: boolean;
};

function stripIconPrefix(title: string, icon?: string): string {
  if (!icon) return title;
  const t = title.trim();
  return t.startsWith(icon) ? t.slice(icon.length).trim() : title;
}

export function ProfileCompletionCards({
  infoCard,
  onGenerateResume,
  onSendResumeEmail,
  resumeLoading = false,
  emailLoading = false,
}: ProfileCompletionCardsProps) {
  const [openId, setOpenId] = useState<CompletionSectionId | null>('resume');

  const meta = useMemo(() => {
    const cards = infoCard.cards || [];
    const pick = (i: number, fallbackIcon: string, fallbackTitle: string, fallbackContent: string) => {
      const c = cards[i];
      return {
        icon: c?.icon || fallbackIcon,
        title: c ? stripIconPrefix(c.title, c.icon) : fallbackTitle,
        teaser: c?.content || fallbackContent,
      };
    };
    return {
      summary: pick(
        0,
        '🧾',
        'Профессиональное саммари',
        'Собираем ключевой опыт и достижения для сильного позиционирования.'
      ),
      resume: pick(
        1,
        '📄',
        'Резюме',
        'Сформируйте резюме, чтобы быстро откликаться на релевантные вакансии.'
      ),
      email: pick(
        2,
        '✉️',
        'Email + сопроводительное',
        'Отправьте резюме и сопроводительное письмо на вашу почту.'
      ),
      matching: pick(
        3,
        '🎯',
        'Подбор вакансий',
        'LEO актуализирует рекомендации с учетом собранного профиля.'
      ),
    };
  }, [infoCard.cards]);

  const toggle = (id: CompletionSectionId) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="interview-report-scope w-full max-w-4xl mx-auto space-y-6 sm:space-y-8">
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
            <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-2xl">{infoCard.description}</p>
          ) : null}
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 auto-rows-min">
        <CompletionCard
          id="summary"
          openId={openId}
          onToggle={toggle}
          icon={meta.summary.icon}
          label={meta.summary.title}
          teaser={meta.summary.teaser}
        >
          <p className="text-xs text-slate-200 leading-relaxed">
            Сводка собирается на основе текущего профиля и помогает быстро адаптировать отклик под вакансию.
          </p>
        </CompletionCard>

        <CompletionCard
          id="resume"
          openId={openId}
          onToggle={toggle}
          icon={meta.resume.icon}
          label={meta.resume.title}
          teaser={meta.resume.teaser}
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-200 leading-relaxed">
              Сгенерируем черновик резюме в формате Markdown на основе вашего профиля.
            </p>
            <Button
              type="primary"
              size="large"
              onClick={onGenerateResume}
              loading={resumeLoading}
              className="!h-11 !px-6 !rounded-full !border-0 !font-semibold !shadow-lg !shadow-green-500/20 !bg-gradient-to-r !from-green-500 !to-emerald-600 hover:!from-green-400 hover:!to-emerald-500 !text-white"
            >
              Сформировать резюме
            </Button>
          </div>
        </CompletionCard>

        <CompletionCard
          id="email"
          openId={openId}
          onToggle={toggle}
          icon={meta.email.icon}
          label={meta.email.title}
          teaser={meta.email.teaser}
        >
          <div className="space-y-3">
            <p className="text-xs text-slate-200 leading-relaxed">
              Отправим на вашу почту резюме и короткое сопроводительное письмо для первого отклика.
            </p>
            <Button
              size="large"
              onClick={onSendResumeEmail}
              loading={emailLoading}
              className="!h-11 !px-6 !rounded-full !font-medium !border !border-white/20 !bg-white/[0.06] !text-slate-100 hover:!border-green-400/40 hover:!bg-white/[0.1] hover:!text-white hover:!shadow-[0_0_24px_-8px_rgba(34,197,94,0.25)]"
            >
              Отправить на почту
            </Button>
          </div>
        </CompletionCard>

        <CompletionCard
          id="matching"
          openId={openId}
          onToggle={toggle}
          icon={meta.matching.icon}
          label={meta.matching.title}
          teaser={meta.matching.teaser}
        >
          <p className="text-xs text-slate-200 leading-relaxed">
            Перейдите во вкладку вакансий, чтобы увидеть обновлённые рекомендации и отобранные позиции.
          </p>
        </CompletionCard>
      </div>
    </div>
  );
}

function CompletionCard(props: {
  id: CompletionSectionId;
  openId: CompletionSectionId | null;
  onToggle: (id: CompletionSectionId) => void;
  icon: string;
  label: string;
  teaser: string;
  children: ReactNode;
}) {
  const { id, openId, onToggle, icon, label, teaser, children } = props;
  const open = openId === id;
  return (
    <article
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
          <div className="border-t border-white/10 pt-4 text-left">{children}</div>
        </div>
      ) : null}
    </article>
  );
}
