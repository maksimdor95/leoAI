'use client';

import { Button } from 'antd';
import type { CommandItem, InfoCardMessage, InterviewPrepMode } from '@/types/chat';
import { CommandBar } from '@/components/chat/CommandBar';
import { PrepPlanCard } from '@/components/chat/PrepPlanCard';
import { PrepTodayPanel } from '@/components/chat/PrepTodayPanel';
import { PrepArtifactsPanel } from '@/components/chat/PrepArtifactsPanel';
import { PrepRetentionPanel } from '@/components/chat/PrepRetentionPanel';
import type { PrepProgress } from '@/lib/prepActivities';
import type { PrepArtifact } from '@/lib/prepArtifacts';
import { useHumeTheme } from '@/lib/useHumeTheme';

const PREP_PLAN_TITLE = 'План подготовки';

function stripIconPrefix(title: string, icon?: string): string {
  if (!icon) return title;
  const t = title.trim();
  return t.startsWith(icon) ? t.slice(icon.length).trim() : title;
}

export type InterviewPrepInfoOverviewProps = {
  infoCard: InfoCardMessage;
  commands?: CommandItem[];
  onCommandSelect?: (command: CommandItem) => void;
  onContinue?: () => void;
  /** Узкая колонка (вкладка «Подготовка») */
  compact?: boolean;
  /** Скрыть блок «План подготовки» (на главной — план только в боковой вкладке). */
  hidePrepPlan?: boolean;
  onOpenPrepPlan?: () => void;
  onPrepModeSelect?: (mode: InterviewPrepMode) => void;
  prepProgress?: PrepProgress | null;
  collectedData?: Record<string, unknown>;
  onActivityStart?: (mode: InterviewPrepMode, startMessage: string) => void;
  mockGateBlockers?: string[];
  onDownloadReport?: () => void;
  prepArtifacts?: PrepArtifact[];
  onOpenArtifactInChat?: (artifact: PrepArtifact) => void;
};

export function InterviewPrepInfoOverview({
  infoCard,
  commands,
  onCommandSelect,
  onContinue,
  compact,
  hidePrepPlan = false,
  onOpenPrepPlan,
  onPrepModeSelect,
  prepProgress,
  collectedData,
  onActivityStart,
  mockGateBlockers = [],
  onDownloadReport,
  prepArtifacts = [],
  onOpenArtifactInChat,
}: InterviewPrepInfoOverviewProps) {
  const isHume = useHumeTheme();
  const hasCommands = Boolean(commands?.length && onCommandSelect);
  const gridClass = compact
    ? 'grid grid-cols-1 gap-2.5 sm:gap-3'
    : hidePrepPlan
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5';

  const overviewCardClass = isHume
    ? 'prep-info-card rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-bone)] px-3 py-2.5 sm:px-3.5 sm:py-3 shadow-[0_1px_3px_rgba(34,34,34,0.06)]'
    : 'rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm shadow-sm hover:bg-white/10 transition-all duration-200 px-2.5 sm:px-3 py-2 sm:py-2.5';

  const prepPlanCard = infoCard.cards.find(
    (card) => card.title === PREP_PLAN_TITLE || (card.planDays && card.planDays.length > 0)
  );
  const overviewCards = infoCard.cards.filter((card) => card !== prepPlanCard);

  return (
    <div className={`prep-info-overview w-full space-y-2 sm:space-y-3 ${isHume ? 'prep-info-overview--hume' : ''}`.trim()}>
      <div>
        <div
          className={
            isHume
              ? 'hume-label-sm mb-1.5'
              : 'mb-1.5 text-[10px] font-medium uppercase tracking-wider text-green-400/80 sm:text-xs'
          }
        >
          Информация
        </div>
        <h2
          className={
            isHume
              ? 'hume-stage-heading mb-1.5 break-words text-left leading-tight'
              : 'mb-1.5 break-words text-base font-bold leading-tight text-white sm:text-lg lg:text-xl'
          }
        >
          {infoCard.title}
        </h2>
        {infoCard.description ? (
          <p
            className={
              isHume
                ? 'hume-body-sm mt-1 max-w-2xl break-words leading-relaxed text-[var(--color-slate-plum)]'
                : 'mt-1 max-w-2xl break-words text-xs leading-relaxed text-slate-300 sm:text-sm'
            }
          >
            {infoCard.description}
          </p>
        ) : null}
      </div>

      <div className={gridClass}>
        {overviewCards.map((card) => {
          const titleText = stripIconPrefix(card.title, card.icon);
          return (
            <div key={`${card.title}-${titleText}`} className={overviewCardClass}>
              <h3
                className={
                  isHume
                    ? 'mb-1 flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--color-ink)] sm:mb-1.5 sm:text-xs'
                    : 'mb-1 flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-white sm:mb-1.5 sm:text-xs'
                }
              >
                {card.icon ? (
                  <span
                    className={`shrink-0 text-xs sm:text-sm ${isHume ? 'text-[var(--color-iris)]' : 'text-green-400'}`}
                    aria-hidden
                  >
                    {card.icon}
                  </span>
                ) : null}
                <span className="truncate leading-tight">{titleText}</span>
              </h3>
              <p
                className={`break-words whitespace-pre-line text-[10px] leading-snug sm:text-xs ${
                  isHume ? 'text-[var(--color-slate-plum)]' : 'text-slate-300'
                } ${compact || hidePrepPlan ? '' : 'line-clamp-4'}`}
              >
                {card.content}
              </p>
            </div>
          );
        })}
      </div>

      {hidePrepPlan && prepPlanCard && onOpenPrepPlan ? (
        <Button
          type="link"
          size="small"
          onClick={onOpenPrepPlan}
          className={
            isHume
              ? '!h-auto !p-0 !text-xs !text-[var(--color-iris)] hover:!text-[var(--color-ink)] sm:!text-sm'
              : '!h-auto !p-0 !text-xs !text-amber-300/95 hover:!text-amber-200 sm:!text-sm'
          }
        >
          План подготовки по дням →
        </Button>
      ) : null}

      {collectedData ? <PrepRetentionPanel collectedData={collectedData} compact={compact} /> : null}

      {!hidePrepPlan && prepProgress && collectedData && onActivityStart ? (
        <PrepTodayPanel
          progress={prepProgress}
          collectedData={collectedData}
          onActivityStart={onActivityStart}
          onDownloadReport={onDownloadReport}
        />
      ) : null}

      {!hidePrepPlan ? (
        <PrepArtifactsPanel
          artifacts={prepArtifacts}
          compact={compact}
          onOpenInChat={onOpenArtifactInChat}
        />
      ) : null}

      {!hidePrepPlan && prepPlanCard?.planDays && prepPlanCard.planDays.length > 0 ? (
        <PrepPlanCard
          title={prepPlanCard.title}
          planDays={prepPlanCard.planDays}
          compact={compact}
          onModeSelect={onPrepModeSelect}
          mockGateBlockers={mockGateBlockers}
        />
      ) : !hidePrepPlan && prepPlanCard ? (
        <div className={overviewCardClass}>
          <h3
            className={
              isHume
                ? 'mb-1.5 text-[11px] font-semibold text-[var(--color-ink)] sm:text-xs'
                : 'mb-1.5 text-[10px] font-semibold text-white sm:text-xs'
            }
          >
            {prepPlanCard.title}
          </h3>
          <p
            className={`break-words whitespace-pre-line text-[10px] leading-relaxed sm:text-xs ${
              isHume ? 'text-[var(--color-slate-plum)]' : 'text-slate-300'
            }`}
          >
            {prepPlanCard.content}
          </p>
        </div>
      ) : null}

      {hasCommands && commands && onCommandSelect ? (
        <div className="mt-4 sm:mt-5 w-full flex flex-wrap gap-3">
          <CommandBar commands={commands} onSelect={onCommandSelect} />
        </div>
      ) : null}

      {infoCard.title === 'Ваш профиль' && onContinue ? (
        <div className="flex justify-center mt-3 sm:mt-4">
          <Button
            type="primary"
            size="large"
            onClick={onContinue}
            className="h-9 sm:h-10 rounded-full border-none bg-gradient-to-r from-green-500 to-green-600 px-5 sm:px-6 text-xs sm:text-sm font-semibold text-white shadow-lg hover:shadow-xl hover:from-green-400 hover:to-green-500 transition-all duration-200"
          >
            Продолжить
          </Button>
        </div>
      ) : null}
    </div>
  );
}
