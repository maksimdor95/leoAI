import { Fragment } from 'react';
import { Button } from 'antd';
import { CommandItem, InfoCardMessage, QuestionMessage } from '@/types/chat';
import { CommandBar } from '@/components/chat/CommandBar';
import { ResumeUploadDropzone } from '@/components/chat/ResumeUploadDropzone';
import {
  InterviewReportCards,
  type InterviewReportPreview,
} from '@/components/chat/InterviewReportCards';
import { ProfileCompletionCards } from '@/components/chat/ProfileCompletionCards';

function stripIconPrefix(title: string, icon?: string): string {
  if (!icon) return title;
  const t = title.trim();
  return t.startsWith(icon) ? t.slice(icon.length).trim() : title;
}

type StagePanelProps = {
  question?: QuestionMessage;
  infoCard?: InfoCardMessage;
  commands?: CommandItem[];
  onCommandSelect: (command: CommandItem) => void;
  onContinue?: () => void;
  /** Экран завершения wannanew: карточки с разбором из report-service, без отдельного CommandBar */
  interviewReport?: {
    loading: boolean;
    error: string | null;
    data: InterviewReportPreview | null;
    onDownloadPdf: () => void;
    onRestart: () => void;
  };
  profileCompletion?: {
    resumeLoading: boolean;
    emailLoading: boolean;
    onGenerateResume: () => void;
    onSendResumeEmail: () => void;
  };
  /** Зона загрузки резюме под текстом вопроса (не в строке ввода) */
  resumeUpload?: {
    onFile: (file: File) => void | Promise<void>;
    loading?: boolean;
    disabled?: boolean;
  };
};

export function StagePanel({
  question,
  infoCard,
  commands,
  onCommandSelect,
  onContinue,
  interviewReport,
  profileCompletion,
  resumeUpload,
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

  const showInterviewReport =
    Boolean(showInfoCard && infoCard && interviewReport) &&
    infoCard?.title === 'Интервью завершено!';
  const showJackCompletion =
    Boolean(showInfoCard && infoCard && profileCompletion) &&
    infoCard?.title === '✅ Профиль успешно собран!';

  return (
    <div className="flex flex-col items-start gap-4 sm:gap-6 w-full overflow-visible">
      {/* Show infoCard only if it's newer than question, or if there's no question */}
      {/* Profile snapshot is now shown in modal from history, not here */}
      {showInterviewReport && infoCard && interviewReport ? (
        <InterviewReportCards
          infoCard={infoCard}
          preview={interviewReport.data}
          loading={interviewReport.loading}
          error={interviewReport.error}
          onDownloadPdf={interviewReport.onDownloadPdf}
          onRestart={interviewReport.onRestart}
        />
      ) : showJackCompletion && infoCard && profileCompletion ? (
        <ProfileCompletionCards
          infoCard={infoCard}
          resumeLoading={profileCompletion.resumeLoading}
          emailLoading={profileCompletion.emailLoading}
          onGenerateResume={profileCompletion.onGenerateResume}
          onSendResumeEmail={profileCompletion.onSendResumeEmail}
        />
      ) : showInfoCard && infoCard ? (
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
            {infoCard.cards.map((card) => {
              const titleText = stripIconPrefix(card.title, card.icon);
              return (
                <div
                  key={card.title}
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
                  <p className="text-[10px] sm:text-xs text-slate-300 leading-snug line-clamp-4 break-words">
                    {card.content}
                  </p>
                </div>
              );
            })}
          </div>

          {hasCommands && commands ? (
            <div className="mt-4 sm:mt-5 w-full flex flex-wrap gap-3">
              <CommandBar commands={commands} onSelect={onCommandSelect} />
            </div>
          ) : null}

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
            {resumeUpload ? (
              <ResumeUploadDropzone
                onFile={resumeUpload.onFile}
                loading={resumeUpload.loading}
                disabled={resumeUpload.disabled}
              />
            ) : null}
          </div>
        </Fragment>
      ) : null}

      {/* Команды без центрального info_card (например только COMMAND в истории) */}
      {hasCommands && commands && !showInfoCard && !showInterviewReport && !showJackCompletion ? (
        <CommandBar commands={commands} onSelect={onCommandSelect} />
      ) : null}
    </div>
  );
}
