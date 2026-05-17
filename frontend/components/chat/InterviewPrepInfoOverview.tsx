'use client';

import { Button } from 'antd';
import { CommandItem, InfoCardMessage } from '@/types/chat';
import { CommandBar } from '@/components/chat/CommandBar';

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
};

export function InterviewPrepInfoOverview({
  infoCard,
  commands,
  onCommandSelect,
  onContinue,
  compact,
}: InterviewPrepInfoOverviewProps) {
  const hasCommands = Boolean(commands?.length && onCommandSelect);
  const gridClass = compact
    ? 'grid grid-cols-1 gap-2 sm:gap-2.5'
    : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5';

  return (
    <div className="space-y-2 sm:space-y-3 w-full">
      <div>
        <div className="text-[10px] sm:text-xs uppercase tracking-wider text-green-400/80 font-medium mb-1.5">
          Информация
        </div>
        <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white leading-tight break-words mb-1.5">
          {infoCard.title}
        </h2>
        {infoCard.description ? (
          <p className="text-xs sm:text-sm text-slate-300 max-w-2xl break-words mt-1 leading-relaxed">
            {infoCard.description}
          </p>
        ) : null}
      </div>

      <div className={gridClass}>
        {infoCard.cards.map((card) => {
          const titleText = stripIconPrefix(card.title, card.icon);
          return (
            <div
              key={`${card.title}-${titleText}`}
              className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm shadow-sm hover:bg-white/10 transition-all duration-200 px-2.5 sm:px-3 py-2 sm:py-2.5"
            >
              <h3 className="text-[10px] sm:text-xs font-semibold text-white mb-1 sm:mb-1.5 flex items-center gap-1.5 min-w-0">
                {card.icon ? (
                  <span className="text-green-400 text-xs sm:text-sm shrink-0" aria-hidden>
                    {card.icon}
                  </span>
                ) : null}
                <span className="truncate leading-tight">{titleText}</span>
              </h3>
              <p
                className={`text-[10px] sm:text-xs text-slate-300 leading-snug break-words ${
                  compact ? '' : 'line-clamp-4'
                }`}
              >
                {card.content}
              </p>
            </div>
          );
        })}
      </div>

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
