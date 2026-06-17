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
import { InterviewPrepInfoOverview } from '@/components/chat/InterviewPrepInfoOverview';

type StagePanelProps = {
  question?: QuestionMessage;
  infoCard?: InfoCardMessage;
  commands?: CommandItem[];
  onCommandSelect: (command: CommandItem) => void;
  onContinue?: () => void;
  /** Тренажёр интервью: во время вопроса открыть вкладку с карточкой профиля/плана */
  interviewPrepOnOpenOverview?: () => void;
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
    summaryLoading?: boolean;
    onGenerateResume: () => void;
    onSendResumeEmail: (email?: string) => void;
    onGenerateSummary?: () => void;
  };
  /** Зона загрузки резюме под текстом вопроса (не в строке ввода) */
  resumeUpload?: {
    onFile: (file: File) => void | Promise<void>;
    loading?: boolean;
    disabled?: boolean;
  };
  /** Быстрые ответы-чипы под вопросом (например, выбор сценария подбора). */
  quickReplies?: Array<{ label: string; value: string; hint?: string }>;
  onQuickReply?: (value: string) => void;
};

export function StagePanel({
  question,
  infoCard,
  commands,
  onCommandSelect,
  onContinue,
  interviewPrepOnOpenOverview,
  interviewReport,
  profileCompletion,
  resumeUpload,
  quickReplies,
  onQuickReply,
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
          summaryLoading={profileCompletion.summaryLoading}
          onGenerateResume={profileCompletion.onGenerateResume}
          onSendResumeEmail={profileCompletion.onSendResumeEmail}
          onGenerateSummary={profileCompletion.onGenerateSummary}
        />
      ) : showInfoCard && infoCard ? (
        <InterviewPrepInfoOverview
          infoCard={infoCard}
          commands={hasCommands ? commands : undefined}
          onCommandSelect={onCommandSelect}
          onContinue={onContinue}
        />
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
            {quickReplies && quickReplies.length > 0 && onQuickReply ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {quickReplies.map((reply) => (
                  <button
                    key={reply.value}
                    type="button"
                    onClick={() => onQuickReply(reply.value)}
                    className="group/qr inline-flex flex-col items-start rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-left transition-all hover:border-green-500/40 hover:bg-white/[0.08] active:scale-[0.98]"
                  >
                    <span className="text-sm font-semibold text-white">{reply.label}</span>
                    {reply.hint ? (
                      <span className="mt-0.5 text-xs text-slate-400">{reply.hint}</span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}
            {resumeUpload ? (
              <ResumeUploadDropzone
                onFile={resumeUpload.onFile}
                loading={resumeUpload.loading}
                disabled={resumeUpload.disabled}
              />
            ) : null}
            {interviewPrepOnOpenOverview ? (
              <div className="pt-2">
                <Button
                  type="link"
                  size="small"
                  onClick={interviewPrepOnOpenOverview}
                  className="!h-auto !p-0 !text-amber-300/95 hover:!text-amber-200 !text-xs sm:!text-sm"
                >
                  Профиль вакансии и план подготовки →
                </Button>
              </div>
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
