'use client';

import { useState } from 'react';
import { Button } from 'antd';
import type { CommandItem, InfoCardMessage, InterviewPrepMode } from '@/types/chat';
import { CommandBar } from '@/components/chat/CommandBar';
import { PrepPlanCard } from '@/components/chat/PrepPlanCard';
import { PrepNextStepPanel } from '@/components/chat/PrepNextStepPanel';
import { PrepArtifactsPanel } from '@/components/chat/PrepArtifactsPanel';
import { PrepRetentionPanel } from '@/components/chat/PrepRetentionPanel';
import type { PrepProgress } from '@/lib/prepActivities';
import type { PrepArtifact } from '@/lib/prepArtifacts';
import { derivePrepRoute } from '@/lib/derivePrepRoute';
import { resolvePrepRetention } from '@/lib/prepRetention';
import { useHumeTheme } from '@/lib/useHumeTheme';

const PREP_PLAN_TITLE = 'План подготовки';
const ROLE_CARD_TITLE = 'Должность / уровень';

function stripIconPrefix(title: string, icon?: string): string {
  if (!icon) return title;
  const t = title.trim();
  return t.startsWith(icon) ? t.slice(icon.length).trim() : title;
}

function SectionToggle({
  label,
  expanded,
  onToggle,
  isHume,
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  isHume: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={
        isHume
          ? 'flex w-full items-center justify-between rounded-lg border border-[var(--color-border-hairline)] bg-[var(--color-bone)] px-3 py-2 text-left text-xs font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-paper)]'
          : 'flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-left text-xs font-medium text-slate-100 transition-colors hover:bg-white/[0.07]'
      }
    >
      <span>{label}</span>
      <span className={isHume ? 'text-[var(--color-smoke)]' : 'text-slate-400'} aria-hidden>
        {expanded ? '▾' : '▸'}
      </span>
    </button>
  );
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

/**
 * IA v1.4 (модель B): один «Следующий шаг» — primary.
 * Разбор вакансии, полный план, режимы — справочно / свёрнуто.
 */
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
  const isPrepWorkspace = Boolean(compact && !hidePrepPlan);
  const isStageSnapshot = Boolean(hidePrepPlan);

  const [profileExpanded, setProfileExpanded] = useState(false);
  const [planExpanded, setPlanExpanded] = useState(false);
  const [modesExpanded, setModesExpanded] = useState(false);

  const hasCommands = Boolean(commands?.length && onCommandSelect);
  const showNextStep = Boolean(!hidePrepPlan && prepProgress && collectedData && onActivityStart);
  const route =
    prepProgress && collectedData ? derivePrepRoute(prepProgress, collectedData) : null;

  const prepPlanCard = infoCard.cards.find(
    (card) => card.title === PREP_PLAN_TITLE || (card.planDays && card.planDays.length > 0)
  );
  const overviewCards = infoCard.cards.filter((card) => card !== prepPlanCard);
  const roleCard = overviewCards.find((card) => card.title === ROLE_CARD_TITLE);

  const retention = collectedData ? resolvePrepRetention(collectedData) : null;
  const showRetention = Boolean(retention && retention.prepSessionNumber > 1);
  const artifacts = prepArtifacts ?? [];
  const showArtifacts = isPrepWorkspace && artifacts.length > 0;
  const showRetentionBlock = isPrepWorkspace && showRetention;

  const overviewCardClass = isHume
    ? 'prep-info-card rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-bone)] px-3 py-2.5 sm:px-3.5 sm:py-3 shadow-[0_1px_3px_rgba(34,34,34,0.06)]'
    : 'rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm shadow-sm px-2.5 sm:px-3 py-2 sm:py-2.5';

  // Сетка карточек: на сцене Jack/общего info — 2–4 колонки; в узкой вкладке — 1 колонка.
  // Не grid-cols-1 на всю ширину на десктопе — иначе «растянутые» полосы и лишний скролл.
  const cardsGridClass = compact
    ? 'grid grid-cols-1 gap-2.5 sm:gap-3'
    : hidePrepPlan
      ? 'grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3'
      : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5';

  const clampCardBody = !compact && !isPrepWorkspace;

  const profileCardsBlock = (
    <div className={cardsGridClass}>
      {overviewCards.map((card) => {
        const titleText = stripIconPrefix(card.title, card.icon);
        return (
          <div key={`${card.title}-${titleText}`} className={overviewCardClass}>
            <h3
              className={
                isHume
                  ? 'mb-1 flex min-w-0 items-center gap-1.5 text-[11px] font-semibold text-[var(--color-ink)] sm:text-xs'
                  : 'mb-1 flex min-w-0 items-center gap-1.5 text-[10px] font-semibold text-white sm:text-xs'
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
              } ${clampCardBody ? 'line-clamp-4' : ''}`}
            >
              {card.content}
            </p>
          </div>
        );
      })}
    </div>
  );

  const hoursHint = route?.totalHoursHint ?? 3;
  const stepsHint = route?.stepTotal ?? 6;
  const nextTitle = route?.next?.activity.title;

  return (
    <div
      className={`prep-info-overview w-full space-y-2.5 sm:space-y-3 ${isHume ? 'prep-info-overview--hume' : ''}`.trim()}
    >
      {/* Header — короткий контракт, не простыня */}
      <div>
        {!isPrepWorkspace && !isStageSnapshot ? (
          <div
            className={
              isHume
                ? 'hume-label-sm mb-1.5'
                : 'mb-1.5 text-[10px] font-medium uppercase tracking-wider text-green-400/80 sm:text-xs'
            }
          >
            Информация
          </div>
        ) : null}
        <h2
          className={
            isHume
              ? 'hume-stage-heading mb-1 break-words text-left leading-tight'
              : 'mb-1 break-words text-base font-bold leading-tight text-white sm:text-lg lg:text-xl'
          }
        >
          {isPrepWorkspace || isStageSnapshot
            ? roleCard?.content ?? 'Подготовка к вакансии'
            : infoCard.title}
        </h2>
        {(isPrepWorkspace || isStageSnapshot) && (
          <p
            className={`text-xs leading-relaxed ${
              isHume ? 'text-[var(--color-smoke)]' : 'text-slate-400'
            }`}
          >
            {stepsHint} шагов · ~{hoursHint} ч в чате
            {showRetention && retention?.priorRole
              ? ` · ранее: ${retention.priorRole}`
              : ''}
          </p>
        )}
        {!isPrepWorkspace && !isStageSnapshot && infoCard.description ? (
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

      {/* Как работать — только на сцене / в prep */}
      {(isPrepWorkspace || isStageSnapshot) && (
        <div
          className={
            isHume
              ? 'rounded-xl border border-[var(--color-border-hairline)] bg-[var(--color-paper)] px-3 py-2.5'
              : 'rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5'
          }
        >
          <p
            className={`text-xs font-medium leading-snug ${
              isHume ? 'text-[var(--color-ink)]' : 'text-slate-100'
            }`}
          >
            {isStageSnapshot
              ? 'LEO разобрал вакансию. Дальше — один шаг в чате, не весь план сразу.'
              : 'Нажмите следующий шаг — LEO откроет нужный режим. Можно за вечер или по шагу.'}
          </p>
          {isStageSnapshot && nextTitle ? (
            <p
              className={`mt-1 text-[11px] leading-snug ${
                isHume ? 'text-[var(--color-slate-plum)]' : 'text-slate-400'
              }`}
            >
              Сейчас: {nextTitle}
            </p>
          ) : null}
        </div>
      )}

      {/* PRIMARY: следующий шаг (вкладка Подготовка) */}
      {showNextStep && prepProgress && collectedData && onActivityStart ? (
        <PrepNextStepPanel
          progress={prepProgress}
          collectedData={collectedData}
          onActivityStart={onActivityStart}
          onDownloadReport={onDownloadReport}
        />
      ) : null}

      {/* Разбор вакансии — свёрнут (на сцене выше CTA) */}
      {isPrepWorkspace || isStageSnapshot ? (
        <div className="space-y-2">
          <SectionToggle
            label="Разбор вакансии"
            expanded={profileExpanded}
            onToggle={() => setProfileExpanded((v) => !v)}
            isHume={isHume}
          />
          {profileExpanded ? profileCardsBlock : null}
        </div>
      ) : (
        profileCardsBlock
      )}

      {/* Primary CTA на сцене — под разбором */}
      {isStageSnapshot && onOpenPrepPlan ? (
        <Button
          type="primary"
          size="middle"
          onClick={onOpenPrepPlan}
          className={
            isHume
              ? '!h-10 !w-full !rounded-full !border-none !bg-[var(--color-ink)] !text-sm !font-medium !text-[var(--color-paper)] hover:!opacity-90 sm:!w-auto sm:!px-5'
              : '!h-10 !w-full !rounded-full !border-none !bg-green-500 !text-sm !font-medium hover:!bg-green-400 sm:!w-auto sm:!px-5'
          }
        >
          Начать подготовку →
        </Button>
      ) : null}
      {showRetentionBlock ? (
        <PrepRetentionPanel collectedData={collectedData!} compact={compact} />
      ) : null}

      {showArtifacts ? (
        <PrepArtifactsPanel
          artifacts={artifacts}
          compact={compact}
          onOpenInChat={onOpenArtifactInChat}
        />
      ) : null}

      {/* Полный план — свёрнут */}
      {!hidePrepPlan && prepPlanCard?.planDays && prepPlanCard.planDays.length > 0 ? (
        <div className="space-y-2">
          <SectionToggle
            label={`Все шаги маршрута (${prepPlanCard.planDays.length} блоков)`}
            expanded={planExpanded}
            onToggle={() => setPlanExpanded((v) => !v)}
            isHume={isHume}
          />
          {planExpanded ? (
            <PrepPlanCard
              title="Маршрут"
              planDays={prepPlanCard.planDays}
              compact={compact}
              onModeSelect={onPrepModeSelect}
              mockGateBlockers={mockGateBlockers}
            />
          ) : null}
        </div>
      ) : null}

      {/* Режимы вручную — не на сцене (там только CTA в Подготовку); в prep — свёрнуто */}
      {hasCommands && commands && onCommandSelect && !isStageSnapshot ? (
        showNextStep && route && !route.complete ? (
          <div className="space-y-2">
            <SectionToggle
              label="Режимы вручную"
              expanded={modesExpanded}
              onToggle={() => setModesExpanded((v) => !v)}
              isHume={isHume}
            />
            {modesExpanded ? (
              <div>
                <p
                  className={`mb-2 text-[10px] ${
                    isHume ? 'text-[var(--color-smoke)]' : 'text-slate-500'
                  }`}
                >
                  Обычно не нужно — LEO ведёт через «Следующий шаг».
                </p>
                <CommandBar commands={commands} onSelect={onCommandSelect} />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-1 w-full">
            <CommandBar commands={commands} onSelect={onCommandSelect} />
          </div>
        )
      ) : null}

      {infoCard.title === 'Ваш профиль' && onContinue ? (
        <div className="mt-3 flex justify-center sm:mt-4">
          <Button
            type="primary"
            size="large"
            onClick={onContinue}
            className="h-9 rounded-full border-none bg-gradient-to-r from-green-500 to-green-600 px-5 text-xs font-semibold text-white shadow-lg hover:from-green-400 hover:to-green-500 sm:h-10 sm:px-6 sm:text-sm"
          >
            Продолжить
          </Button>
        </div>
      ) : null}
    </div>
  );
}
