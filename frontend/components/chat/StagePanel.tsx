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
import { PrepPackStageCard } from '@/components/chat/PrepPackStageCard';
import type { PrepPackType } from '@/types/chat';

const VACANCY_PROFILE_CARD_TITLE = 'Профиль вакансии и план подготовки';

export type PrepModeStageContent = {
  modeLabel: string;
  content: string;
  badge?: 'rescue' | 'micro_rescue';
  mockBriefing?: boolean;
  mockQuestionLabel?: string;
  onMockStart?: () => void;
  packType?: PrepPackType;
  theoryLearnReady?: boolean;
  onTheoryReady?: () => void;
};

type StagePanelProps = {
  question?: QuestionMessage;
  /** Текст режима (теория, кейс, STAR…) на главной сцене */
  prepModeContent?: PrepModeStageContent;
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
  quickReplies?: Array<{ label: string; value: string; hint?: string; fullWidth?: boolean }>;
  onQuickReply?: (value: string) => void;
  /** Прогресс детального пути Jack: «Вопрос 12 из 36». */
  detailedProgressLabel?: string | null;
};

export function StagePanel({
  question,
  prepModeContent,
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
  detailedProgressLabel,
}: StagePanelProps) {
  const hasQuestion = Boolean(question);
  const hasPrepModeContent = Boolean(prepModeContent?.content);
  const hasInfoCard = Boolean(infoCard);
  const hasCommands = Boolean(commands && commands.length > 0);

  if (!hasQuestion && !hasPrepModeContent && !hasInfoCard && !hasCommands) {
    return null;
  }

  const showQuestion = hasQuestion;
  const showPrepModeContent = hasPrepModeContent && !showQuestion;
  const showInfoCard = hasInfoCard && !showQuestion && !showPrepModeContent;
  const isVacancyProfileCard = infoCard?.title === VACANCY_PROFILE_CARD_TITLE;

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
          hidePrepPlan={isVacancyProfileCard}
          onOpenPrepPlan={isVacancyProfileCard ? interviewPrepOnOpenOverview : undefined}
          commands={hasCommands ? commands : undefined}
          onCommandSelect={onCommandSelect}
          onContinue={onContinue}
        />
      ) : showQuestion && question ? (
        <Fragment>
          <div className="space-y-2 text-left w-full">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <div className="text-xs uppercase tracking-[0.4em] text-green-300/70">Вопрос</div>
              {detailedProgressLabel ? (
                <span className="text-[11px] font-medium text-slate-400">{detailedProgressLabel}</span>
              ) : null}
            </div>
            <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-white leading-tight break-words w-full text-left">
              {question.question}
            </h2>
            {question.placeholder && (
              <p className="text-xs sm:text-sm text-slate-300 w-full break-words text-left">
                {question.placeholder}
              </p>
            )}
            {quickReplies && quickReplies.length > 0 && onQuickReply ? (
              <div className="flex flex-wrap gap-2 pt-1 w-full">
                {quickReplies.map((reply) => (
                  <button
                    key={reply.value}
                    type="button"
                    onClick={() => onQuickReply(reply.value)}
                    className={[
                      'group/qr inline-flex flex-col items-start rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-left transition-all hover:border-green-500/40 hover:bg-white/[0.08] active:scale-[0.98]',
                      reply.fullWidth ? 'w-full basis-full' : '',
                    ].join(' ')}
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
      ) : showPrepModeContent && prepModeContent ? (
        <Fragment>
          <div className="space-y-2 text-left w-full max-h-[min(52vh,28rem)] overflow-y-auto chat-history-scroll pr-1">
            {prepModeContent.packType ? (
              <PrepPackStageCard
                packType={prepModeContent.packType}
                modeLabel={prepModeContent.modeLabel}
                content={prepModeContent.content}
              />
            ) : (
              <>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-xs uppercase tracking-[0.4em] text-green-300/70">
                {prepModeContent.modeLabel}
              </div>
              {prepModeContent.mockQuestionLabel ? (
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-medium text-slate-300">
                  {prepModeContent.mockQuestionLabel}
                </span>
              ) : null}
              {prepModeContent.badge === 'rescue' ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-200">
                  Разбор коуча
                </span>
              ) : prepModeContent.badge === 'micro_rescue' ? (
                <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-200/80">
                  Подсказка структуры
                </span>
              ) : null}
            </div>
            <div className="text-sm sm:text-base text-slate-100 leading-relaxed whitespace-pre-line break-words">
              {prepModeContent.content}
            </div>
              </>
            )}
            {prepModeContent.theoryLearnReady && prepModeContent.onTheoryReady ? (
              <div className="pt-1">
                <Button
                  type="primary"
                  size="middle"
                  onClick={prepModeContent.onTheoryReady}
                  className="!rounded-full !border-none !bg-gradient-to-r !from-violet-500 !to-violet-600 !text-sm !font-semibold !shadow-lg hover:!from-violet-400 hover:!to-violet-500"
                >
                  Готов к проверке
                </Button>
              </div>
            ) : null}
            {prepModeContent.mockBriefing && prepModeContent.onMockStart ? (
              <div className="pt-1">
                <Button
                  type="primary"
                  size="middle"
                  onClick={prepModeContent.onMockStart}
                  className="!rounded-full !border-none !bg-gradient-to-r !from-green-500 !to-green-600 !text-sm !font-semibold !shadow-lg hover:!from-green-400 hover:!to-green-500"
                >
                  Начать мок
                </Button>
              </div>
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
