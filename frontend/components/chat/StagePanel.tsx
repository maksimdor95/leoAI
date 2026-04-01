import { Fragment } from 'react';
import { Button } from 'antd';
import { CommandItem, InfoCardMessage, QuestionMessage } from '@/types/chat';
import { CommandBar } from '@/components/chat/CommandBar';

type StagePanelProps = {
  question?: QuestionMessage;
  infoCard?: InfoCardMessage;
  commands?: CommandItem[];
  onCommandSelect: (command: CommandItem) => void;
  onContinue?: () => void;
};

export function StagePanel({
  question,
  infoCard,
  commands,
  onCommandSelect,
  onContinue,
}: StagePanelProps) {
  const hasQuestion = Boolean(question);
  const hasInfoCard = Boolean(infoCard);
  const hasCommands = Boolean(commands && commands.length > 0);

  if (!hasQuestion && !hasInfoCard && !hasCommands) {
    return null;
  }

  // Determine which message to show based on timestamp (newer message has priority)
  // Profile snapshot can be shown in main block if it's the current active step (no newer question)
  // Otherwise, it's available in history via modal
  const questionTime = question ? new Date(question.timestamp).getTime() : 0;
  const infoCardTime = infoCard ? new Date(infoCard.timestamp).getTime() : 0;
  const isProfileSnapshot = infoCard?.title === 'Ваш профиль';
  // Show profile snapshot in main block only if it's the current step (no newer question)
  // Otherwise, it's shown in history and can be opened via modal
  const showInfoCard = hasInfoCard && (!hasQuestion || infoCardTime > questionTime);

  return (
    <div className="flex flex-col items-start gap-4 sm:gap-6 w-full overflow-visible">
      {/* Show infoCard only if it's newer than question, or if there's no question */}
      {/* Profile snapshot is now shown in modal from history, not here */}
      {showInfoCard && infoCard ? (
        <div className="space-y-2 sm:space-y-3 w-full">
          <div>
            <div className="text-[10px] sm:text-xs uppercase tracking-wider text-green-400/80 font-medium mb-1.5">
              Информация
            </div>
            <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white leading-tight break-words mb-1.5">
              {infoCard.title}
            </h2>
            {infoCard.description && (
              <p className="text-xs sm:text-sm text-slate-300 max-w-2xl break-words mt-1 leading-relaxed">
                {infoCard.description}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-2.5">
            {infoCard.cards.map((card) => (
              <div
                key={card.title}
                className="rounded-lg border border-white/10 bg-white/5 backdrop-blur-sm shadow-sm hover:bg-white/10 transition-all duration-200 px-2.5 sm:px-3 py-2 sm:py-2.5"
              >
                <h3 className="text-[10px] sm:text-xs font-semibold text-white mb-1 sm:mb-1.5 flex items-center gap-1">
                  {card.icon && (
                    <span className="text-green-400 text-xs sm:text-sm">{card.icon}</span>
                  )}
                  <span className="truncate leading-tight">{card.title}</span>
                </h3>
                <p className="text-[10px] sm:text-xs text-slate-300 leading-snug line-clamp-4 break-words">
                  {card.content}
                </p>
              </div>
            ))}
          </div>

          {/* Continue button for profile_snapshot */}
          {infoCard.title === 'Ваш профиль' && onContinue && (
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
          )}
        </div>
      ) : hasQuestion && question ? (
        <Fragment>
          <div className="space-y-2 text-left w-full">
            <div className="text-xs uppercase tracking-[0.4em] text-green-300/70">Вопрос</div>
            <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-white leading-tight break-words w-full text-left">
              {question.question}
            </h2>
            {question.placeholder && (
              <p className="text-xs sm:text-sm text-slate-300 w-full break-words text-left">
                {question.placeholder}
              </p>
            )}
          </div>
        </Fragment>
      ) : null}

      {hasCommands && commands ? (
        <CommandBar commands={commands} onSelect={onCommandSelect} />
      ) : null}
    </div>
  );
}
