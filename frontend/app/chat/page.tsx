'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { ChatAppHeaderNav } from '@/components/chat/ChatAppHeaderNav';
import {
  Button,
  Form,
  Input,
  Layout,
  Spin,
  Typography,
  message as antdMessage,
  Modal,
} from 'antd';
import {
  CommandItem,
  CommandMessage,
  InfoCardMessage,
  InterviewPrepMode,
  Message,
  MessageRole,
  MessageType,
  MessageTypeValue,
  QuestionMessage,
  TextMessage,
} from '@/types/chat';
import { createChatApi, ChatApi } from '@/lib/chatApi';
import { clearClientAuthState, getAuthenticatedUserId, isAuthenticated } from '@/lib/auth';
import { captureEvent } from '@/lib/analytics';
import { userAPI } from '@/lib/api';
import { jackCollectedDataReadyForJobMatch } from '@/lib/jackProfileGating';
import { buildJobsMatchInfoTooltip, jobsRefreshStatusLabel } from '@/lib/jobsFunnelSummary';
import { getJackDetailedProgress } from '@/lib/jackDetailedProgress';
import { buildVacancyPrepText, vacancyPrepDisplayLabel } from '@/lib/buildVacancyPrepText';
import { fetchViewedJobIds } from '@/lib/jobApi';
import {
  buildKnownJobIdSet,
  buildViewedJobIdSet,
  collectVacancyIds,
  detectNewVacancyIds,
  filterJobsByFavorite,
  filterJobsByNew,
  loadVacancyFeedState,
  markVacancyViewed,
  saveVacancyFeedState,
  sanitizeRestoredNewJobIds,
  hasEstablishedVacancyFeedHistory,
  syncVacancyListsFromApi,
  toPersistedFeedState,
  toggleVacancyFavorite,
  applyVacancyNewBadges,
  shouldBaselineVacancyFeedLoad,
  type VacanciesFilter,
} from '@/lib/vacancyFeedState';
import { getPublicJobMatchingBaseUrl } from '@/lib/publicJobMatchingUrl';
import {
  formatCollectedValue,
  getJackProfileSidebarRows,
} from '@/lib/jackProfileFieldCatalog';
import { MessageList } from '@/components/chat/MessageList';
import {
  filterMessagesByPrepHistory,
  INTERVIEW_PREP_MODES,
  INTERVIEW_PREP_MODE_LABELS,
  INTERVIEW_PREP_MODE_TAB_LABELS,
  buildInterviewPrepModeStartMessage,
  getInterviewPrepStageModeLabel,
  interviewModeCommandItem,
  isInterviewPrepStageAssistantMessage,
  parseInterviewModeFromAction,
  type PrepHistoryFilter,
} from '@/lib/interviewPrepModes';
import { computePrepProgress, evaluateMockGate } from '@/lib/prepActivities';
import { resolvePrepArtifacts } from '@/lib/prepArtifacts';
import { VoiceIndicator, type VoiceIndicatorMode } from '@/components/chat/VoiceIndicator';
import { StagePanel, type PrepModeStageContent } from '@/components/chat/StagePanel';
import { InterviewPrepInfoOverview } from '@/components/chat/InterviewPrepInfoOverview';
import type { InterviewReportPreview } from '@/components/chat/InterviewReportCards';
import { TypingMessage } from '@/components/chat/TypingMessage';
import { ProfileModal } from '@/components/chat/ProfileModal';
import { MatchedJobCard } from '@/components/chat/MatchedJobCard';
import { VacancyPreviewDrawer } from '@/components/chat/VacancyPreviewDrawer';
import {
  VacanciesInsightPanel,
  shouldShowVacanciesInsight,
} from '@/components/chat/VacanciesInsightPanel';
import { ProductSelectionScreen, ProductType } from '@/components/chat/ProductSelectionScreen';
import { chatUi, inRecommendedSummary, newJobsBadgeWord, weakMatchSummary } from '@/lib/chatUiCopy';
import {
  catalogFamilyMismatchWarning,
  vacanciesUi,
} from '@/lib/vacanciesUiCopy';
import { SupportWidget } from '@/components/support/SupportWidget';
import { ChatHelpPopover } from '@/components/chat/ChatHelpPopover';
import { ChatHoverTooltip } from '@/components/chat/ChatHoverTooltip';
import {
  SoundOutlined,
  AudioMutedOutlined,
  SendOutlined,
  AudioOutlined,
  ReloadOutlined,
  HeartFilled,
  HeartOutlined,
} from '@ant-design/icons';
import {
  uploadResumeFile,
  extractProfileFromResumeText,
} from '@/lib/resumeProfileImport';

declare global {
  interface Window {
    webkitSpeechRecognition: any;
    SpeechRecognition: any;
  }
}

const { Title, Text } = Typography;
const { Content } = Layout;

type MessageFormValues = {
  message: string;
};

type ProfileEditFormValues = Record<string, string>;

type MatchedJobItem = {
  job: {
    id: string;
    title: string;
    company: string;
    source?: string;
    source_url?: string;
    location?: string[];
    description?: string;
    requirements?: string;
    skills?: string[];
    work_mode?: string | null;
    salary_min?: number | null;
    salary_max?: number | null;
  };
  score: number;
  reasons?: string[];
};

type JobsLoadState = 'idle' | 'scraping' | 'matching' | 'success' | 'error';

type SidePanelTab = 'chat' | 'vacancies' | 'profile';

type MobileMainTab = 'stage' | 'workspace';

/** Метаданные ответа /api/jobs/match — прозрачность порога и объёма каталога (см. IMPROVEMENT_PLAN P0.2) */
type JobsMatchMeta = {
  jobsInDb: number;
  jobsScanned: number;
  maxMatchScore: number;
  matchThreshold: number;
  totalMatched: number;
  /** P0.2B: сколько вакансий в ярусе «слабое совпадение» до обрезки API */
  weakTierTotal: number;
  weakMatchFloor: number;
  /** Семейство профессии пользователя, определённое матчером (product/analytics/...) */
  profileFamily?: string | null;
  profileFamilyLabel?: string | null;
  /** Доля вакансий в каталоге, попадающих в primary или смежные семейства */
  familyRelevanceShare?: number;
  /** Сколько вакансий в выборке относится к направлению пользователя */
  familyCatalogCount?: number;
  /** Предупреждение от API: 'catalog_family_mismatch' | 'no_matches' | 'empty_catalog' | null */
  catalogWarning?: 'catalog_family_mismatch' | 'no_matches' | 'empty_catalog' | null;
};


function extractLatest<T extends Message>(
  messages: Message[],
  type: MessageTypeValue
): T | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (msg.type === type) {
      return msg as T;
    }
  }
  return undefined;
}

function shouldAnimateMessage(message: Message, existingMessages: Message[]): boolean {
  if (message.role !== MessageRole.ASSISTANT) {
    return false;
  }

  if (existingMessages.some((existing) => existing.id === message.id)) {
    return false;
  }

  if (message.type === MessageType.QUESTION) {
    return true;
  }

  // Теория / кейс / STAR и др. — TEXT с interviewMode, как у диагностики
  if (message.type === MessageType.TEXT && message.interviewMode) {
    return true;
  }

  return false;
}

/** Текст для TTS (Яндекс на сервере + воспроизведение на клиенте). Согласовано с лимитом ~1100 символов в conversation/aiClient. */
function getAssistantSpeakableTextForTts(message: Message): string {
  if (message.role !== MessageRole.ASSISTANT) return '';
  if (message.type === MessageType.TEXT) {
    return String((message as TextMessage).content || '').trim();
  }
  if (message.type === MessageType.INFO_CARD) {
    const ic = message as InfoCardMessage;
    const parts: string[] = [];
    if (ic.title) parts.push(ic.title);
    if (ic.description) parts.push(ic.description);
    const full = parts.join('. ').replace(/\s+/g, ' ').trim();
    return full.length > 1100 ? `${full.slice(0, 1090).trim()}...` : full;
  }
  return '';
}

function dedupeAndSortMessages(messages: Message[]): Message[] {
  const map = new Map<string, Message>();

  for (const message of messages) {
    map.set(message.id, message);
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

function appendMessage(messages: Message[], message: Message): Message[] {
  if (messages.some((existing) => existing.id === message.id)) {
    return messages;
  }

  return dedupeAndSortMessages([...messages, message]);
}

function ChatPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { openAuthModal } = useAuth();
  const { settings, setSpeechEnabled } = useAppSettings();
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const isHume = settings.theme === 'hume-light';
  const isMuted = !settings.speechEnabled;
  const ui = (key: Parameters<typeof chatUi>[1]) => chatUi(settings.locale, key);
  const v = (key: Parameters<typeof vacanciesUi>[1]) => vacanciesUi(settings.locale, key);
  const [form] = Form.useForm<MessageFormValues>();
  const [profileEditForm] = Form.useForm<ProfileEditFormValues>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [messageApi, contextHolder] = antdMessage.useMessage();
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<ChatApi | null>(null);
  const chatInitializedRef = useRef(false);
  /** Пропускаем перезапуск init-эффекта, когда мы сами добавили sessionId в URL после подключения. */
  const skipParamsEffectRef = useRef(false);
  const [typingMessage, setTypingMessage] = useState<Message | null>(null);
  const [typingOptions, setTypingOptions] = useState<{ speed: number; delay: number }>({
    speed: 50,
    delay: 1200,
  });
  const [isTyping, setIsTyping] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileData, setProfileData] = useState<InfoCardMessage | null>(null);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  const [profileEditSaving, setProfileEditSaving] = useState(false);
  const profileModalOpenRef = useRef(false);
  const [inputText, setInputText] = useState('');
  const finalTranscriptRef = useRef('');
  const isListeningRef = useRef(false);
  const ttsBeatAtRef = useRef(0);
  const assistantVoiceLevelRef = useRef(0);
  const assistantAudioElRef = useRef<HTMLAudioElement | null>(null);
  const unlockAudioElRef = useRef<HTMLAudioElement | null>(null);
  const assistantAudioCtxRef = useRef<AudioContext | null>(null);
  const assistantAudioAnalyserRef = useRef<AnalyserNode | null>(null);
  const assistantAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const assistantAudioTimeDataRef = useRef<Float32Array | null>(null);
  const assistantAudioRafRef = useRef(0);
  const assistantAudioByMessageIdRef = useRef<
    Map<string, { audioBase64: string; mimeType?: string; format?: 'mp3' | 'oggopus' }>
  >(new Map());
  const typingMessageIdRef = useRef<string | null>(null);
  const typingMessageRef = useRef<Message | null>(null);
  const handledSpeechMessageIdsRef = useRef<Set<string>>(new Set());
  const speechChainRef = useRef(Promise.resolve());
  const speechEpochRef = useRef(0);
  /** Браузерный speechSynthesis только если явно включён — иначе только Яндекс TTS с сервера. */
  const enableBrowserTtsFallbackRef = useRef(
    process.env.NEXT_PUBLIC_ENABLE_BROWSER_TTS_FALLBACK === 'true'
  );
  const lastSpokenTextRef = useRef<string>('');
  const lastSpokenAtRef = useRef<number>(0);
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
  useEffect(() => {
    typingMessageIdRef.current = typingMessage?.id ?? null;
    typingMessageRef.current = typingMessage;
  }, [typingMessage]);

  const [currentProduct, setCurrentProduct] = useState<ProductType>('jack');
  const chatProductRef = useRef<ProductType>('jack');
  const firstUserMessageCapturedRef = useRef(false);
  const [pendingStarterMessage, setPendingStarterMessage] = useState<string | null>(null);
  const [pendingVacancyAnalyze, setPendingVacancyAnalyze] = useState<{
    text: string;
    label: string;
  } | null>(null);
  const pendingVacancyAnalyzeRef = useRef<{ text: string; label: string } | null>(null);
  const [vacancyAnalyzeFlowActive, setVacancyAnalyzeFlowActive] = useState(false);
  const autoStarterSentRef = useRef(false);
  const [productSelected, setProductSelected] = useState(false);
  const [isNewChatMode, setIsNewChatMode] = useState(false);
  const [matchedJobs, setMatchedJobs] = useState<MatchedJobItem[]>([]);
  const [weakMatchedJobs, setWeakMatchedJobs] = useState<MatchedJobItem[]>([]);
  const matchedJobsRef = useRef<MatchedJobItem[]>([]);
  const weakMatchedJobsRef = useRef<MatchedJobItem[]>([]);
  const [isJobsLoading, setIsJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('chat');
  const [mobileMainTab, setMobileMainTab] = useState<MobileMainTab>('stage');
  const [prepHistoryFilter, setPrepHistoryFilter] = useState<PrepHistoryFilter>('general');

  const focusMobileWorkspace = useCallback(() => {
    setMobileMainTab('workspace');
  }, []);

  useEffect(() => {
    if (productSelected) {
      setMobileMainTab('stage');
    }
  }, [productSelected, sessionId]);

  useEffect(() => {
    setPrepHistoryFilter('general');
  }, [sessionId]);
  const [jobsLoadState, setJobsLoadState] = useState<JobsLoadState>('idle');
  const [jobsLastUpdatedAt, setJobsLastUpdatedAt] = useState<string | null>(null);
  const [jobsMatchMeta, setJobsMatchMeta] = useState<JobsMatchMeta | null>(null);
  const [sessionCurrentStepId, setSessionCurrentStepId] = useState<string | null>(null);
  const [sessionCompletedSteps, setSessionCompletedSteps] = useState<string[]>([]);
  const [sessionCollectedData, setSessionCollectedData] = useState<Record<string, unknown>>({});
  const [vacancyPrepJobId, setVacancyPrepJobId] = useState<string | null>(null);
  const [vacancyPreview, setVacancyPreview] = useState<{
    item: MatchedJobItem;
    variant: 'recommended' | 'weak';
  } | null>(null);
  const [vacanciesFilter, setVacanciesFilter] = useState<VacanciesFilter>('all');
  const knownJobIdsRef = useRef<Set<string>>(new Set());
  const viewedJobIdsRef = useRef<Set<string>>(new Set());
  const vacancyFeedUserIdRef = useRef<string | null>(null);
  const viewedJobIdsLoadedRef = useRef(false);
  const vacancyFeedBaselinedRef = useRef(false);
  /** Список вакансий уже показывали — фоновый silent-refresh не прячет его под спиннер. */
  const jobsListHydratedRef = useRef(false);
  const autoRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundJobsPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobsScrapeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatConnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAutoTriggeredMessageIdRef = useRef<string | null>(null);
  const lastJobsFetchAtRef = useRef<number>(0);
  const [newJobBadgeIds, setNewJobBadgeIds] = useState<Set<string>>(() => new Set());
  const [favoriteJobIds, setFavoriteJobIds] = useState<Set<string>>(() => new Set());
  const favoriteJobIdsRef = useRef<Set<string>>(new Set());
  const newJobBadgeIdsRef = useRef<Set<string>>(new Set());
  const [resumeImportLoading, setResumeImportLoading] = useState(false);
  const [resumeDraftLoading, setResumeDraftLoading] = useState(false);
  const [resumeEmailLoading, setResumeEmailLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [interviewReportPreview, setInterviewReportPreview] = useState<InterviewReportPreview | null>(
    null
  );
  const [interviewReportLoading, setInterviewReportLoading] = useState(false);
  const [interviewReportError, setInterviewReportError] = useState<string | null>(null);

  const getUserIdFromToken = useCallback((token: string): string | null => {
    try {
      const payloadPart = token.split('.')[1];
      if (!payloadPart) return null;
      const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4 || 4)) % 4);
      const payload = JSON.parse(atob(padded));
      return payload?.userId || payload?.id || null;
    } catch {
      return null;
    }
  }, []);

  const getJobMatchingBaseUrl = useCallback(() => getPublicJobMatchingBaseUrl(), []);

  const syncSessionMetadata = useCallback(() => {
    const meta = chatRef.current?.metadata;
    if (!meta) return;
    setSessionCurrentStepId(
      typeof meta.currentStepId === 'string' ? meta.currentStepId : null
    );
    setSessionCompletedSteps(
      Array.isArray(meta.completedSteps) ? (meta.completedSteps as string[]) : []
    );
    const rawCollected = meta.collectedData;
    if (rawCollected && typeof rawCollected === 'object' && !Array.isArray(rawCollected)) {
      setSessionCollectedData({ ...(rawCollected as Record<string, unknown>) });
    } else {
      setSessionCollectedData({});
    }
  }, []);

  const jackDetailedProgressLabel = useMemo(() => {
    if (currentProduct !== 'jack') return null;
    return getJackDetailedProgress(sessionCurrentStepId, sessionCompletedSteps)?.label ?? null;
  }, [currentProduct, sessionCurrentStepId, sessionCompletedSteps]);

  const hydrateVacancyFeedState = useCallback(async (userId: string) => {
    if (vacancyFeedUserIdRef.current === userId && viewedJobIdsLoadedRef.current) {
      return;
    }

    const persisted = loadVacancyFeedState(userId);
    const serverViewedIds = await fetchViewedJobIds();
    const viewedIds = buildViewedJobIdSet(persisted, serverViewedIds);
    const knownIds = buildKnownJobIdSet(persisted, serverViewedIds);
    const favorites = new Set(persisted.favoriteJobIds);

    viewedJobIdsRef.current = viewedIds;
    knownJobIdsRef.current = knownIds;
    favoriteJobIdsRef.current = favorites;
    setFavoriteJobIds(favorites);
    vacancyFeedUserIdRef.current = userId;
    viewedJobIdsLoadedRef.current = true;
  }, []);

  const persistVacancyFeedState = useCallback((userId: string, newIds: Set<string>) => {
    saveVacancyFeedState(
      userId,
      toPersistedFeedState(
        newIds,
        viewedJobIdsRef.current,
        knownJobIdsRef.current,
        favoriteJobIdsRef.current
      )
    );
  }, []);

  const persistFavoriteJobIds = useCallback((userId: string, favoriteIds: Set<string>) => {
    saveVacancyFeedState(
      userId,
      toPersistedFeedState(
        newJobBadgeIdsRef.current,
        viewedJobIdsRef.current,
        knownJobIdsRef.current,
        favoriteIds
      )
    );
  }, []);

  const handleToggleVacancyFavorite = useCallback((jobId: string) => {
    setFavoriteJobIds((prev) => {
      const next = toggleVacancyFavorite(jobId, prev);
      favoriteJobIdsRef.current = next;
      const userId = vacancyFeedUserIdRef.current;
      if (userId) {
        persistFavoriteJobIds(userId, next);
      }
      return next;
    });
  }, [persistFavoriteJobIds]);

  const markVacancyAsViewed = useCallback((jobId: string) => {
    setNewJobBadgeIds((prev) => {
      const next = new Set(prev);
      markVacancyViewed(jobId, next, viewedJobIdsRef.current, knownJobIdsRef.current);
      const userId = vacancyFeedUserIdRef.current;
      if (userId) {
        saveVacancyFeedState(
          userId,
          toPersistedFeedState(
            next,
            viewedJobIdsRef.current,
            knownJobIdsRef.current,
            favoriteJobIdsRef.current
          )
        );
      }
      return next;
    });
  }, []);

  useEffect(() => {
    matchedJobsRef.current = matchedJobs;
  }, [matchedJobs]);

  useEffect(() => {
    weakMatchedJobsRef.current = weakMatchedJobs;
  }, [weakMatchedJobs]);

  useEffect(() => {
    newJobBadgeIdsRef.current = newJobBadgeIds;
  }, [newJobBadgeIds]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognitionInstance = new SpeechRecognition();
        recognitionInstance.continuous = false;
        recognitionInstance.interimResults = true;
        recognitionInstance.lang = 'ru-RU';
        recognitionInstance.maxAlternatives = 1;

        recognitionInstance.onresult = (event: any) => {
          if (!event?.results?.length) return;

          let interimTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const item = result?.[0];
            const raw = typeof item?.transcript === 'string' ? item.transcript : '';
            const transcript = raw.replace(/\s+/g, ' ').trim();
            if (!transcript) continue;

            if (result.isFinal) {
              finalTranscriptRef.current += transcript + ' ';
            } else {
              interimTranscript += transcript;
            }
          }

          const fullTranscript = (finalTranscriptRef.current + interimTranscript)
            .replace(/\s+/g, ' ')
            .trim();

          if (fullTranscript) {
            setInputText(fullTranscript);
            form.setFieldsValue({ message: fullTranscript });
          }
        };

        recognitionInstance.onend = () => {
          const finalText = finalTranscriptRef.current.replace(/\s+/g, ' ').trim();
          if (finalText) {
            setInputText(finalText);
            form.setFieldsValue({ message: finalText });
          }
          
          // Если пользователь все еще хочет слушать, перезапускаем распознавание
          if (isListeningRef.current && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (err) {
              // Если не удалось перезапустить, останавливаем
              console.error('Failed to restart recognition:', err);
              setIsListening(false);
              isListeningRef.current = false;
            }
          } else {
            setIsListening(false);
          }
        };

        recognitionInstance.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          setIsListening(false);
          isListeningRef.current = false;
          if (event.error !== 'no-speech' && event.error !== 'aborted') {
            messageApi.error(`Ошибка распознавания речи: ${event.error}`);
          }
        };

        recognitionInstance.onstart = () => {
          setIsListening(true);
          isListeningRef.current = true;
          // Сбрасываем накопленный текст при новом старте
          finalTranscriptRef.current = '';
        };

        recognitionRef.current = recognitionInstance;
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [form, messageApi]);

  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) {
      messageApi.warning('Ваш браузер не поддерживает распознавание речи');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      isListeningRef.current = false;
    } else {
      try {
        // Сбрасываем накопленный текст перед новым стартом
        finalTranscriptRef.current = '';
        recognitionRef.current.start();
        setIsListening(true);
        isListeningRef.current = true;
      } catch (err) {
        console.error('Failed to start recognition:', err);
        setIsListening(false);
        isListeningRef.current = false;
      }
    }
  }, [isListening, messageApi]);

  const stopAssistantAudio = useCallback(() => {
    const el = assistantAudioElRef.current;
    if (el) {
      el.pause();
      el.removeAttribute('src');
      el.load();
    }
    if (assistantAudioRafRef.current) {
      cancelAnimationFrame(assistantAudioRafRef.current);
      assistantAudioRafRef.current = 0;
    }
    assistantVoiceLevelRef.current = 0;
    setIsTtsSpeaking(false);
  }, []);

  const cancelActiveSpeech = useCallback(() => {
    speechEpochRef.current += 1;
    stopAssistantAudio();
    if (typeof window !== 'undefined') {
      window.speechSynthesis.cancel();
    }
    setIsTtsSpeaking(false);
  }, [stopAssistantAudio]);

  const canUseBrowserTtsFallback = useCallback(() => {
    return enableBrowserTtsFallbackRef.current;
  }, []);

  const isAssistantAudioPlaying = useCallback(() => {
    const el = assistantAudioElRef.current;
    return Boolean(el && !el.paused && !el.ended);
  }, []);

  const waitForAssistantAudioEnd = useCallback(
    () =>
      new Promise<void>((resolve) => {
        const el = assistantAudioElRef.current;
        if (!el || el.paused || el.ended) {
          resolve();
          return;
        }
        const done = () => {
          el.removeEventListener('ended', done);
          resolve();
        };
        el.addEventListener('ended', done);
      }),
    []
  );

  const runSpeechExclusive = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const next = speechChainRef.current.then(task, task);
    speechChainRef.current = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }, []);

  const ensureAssistantAudioChain = useCallback(() => {
    if (typeof window === 'undefined') return null;
    let el = assistantAudioElRef.current;
    if (!el) {
      el = new Audio();
      el.preload = 'auto';
      el.crossOrigin = 'anonymous';
      el.onplay = () => {
        setIsTtsSpeaking(true);
        ttsBeatAtRef.current = performance.now();
      };
      el.onended = () => {
        setIsTtsSpeaking(false);
        assistantVoiceLevelRef.current = 0;
      };
      el.onerror = () => {
        setIsTtsSpeaking(false);
        assistantVoiceLevelRef.current = 0;
      };
      assistantAudioElRef.current = el;
    }

    if (!assistantAudioCtxRef.current) {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return null;
      assistantAudioCtxRef.current = new AC();
    }

    if (!assistantAudioAnalyserRef.current) {
      const analyser = assistantAudioCtxRef.current.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.88;
      assistantAudioAnalyserRef.current = analyser;
      assistantAudioTimeDataRef.current = new Float32Array(analyser.fftSize);
    }

    if (!assistantAudioSourceRef.current) {
      assistantAudioSourceRef.current = assistantAudioCtxRef.current.createMediaElementSource(el);
      assistantAudioSourceRef.current.connect(assistantAudioAnalyserRef.current);
      assistantAudioAnalyserRef.current.connect(assistantAudioCtxRef.current.destination);
    }

    const analyser = assistantAudioAnalyserRef.current;
    const timeData = assistantAudioTimeDataRef.current;
    if (!analyser || !timeData) return el;

    const tick = () => {
      analyser.getFloatTimeDomainData(
        timeData as Parameters<AnalyserNode['getFloatTimeDomainData']>[0]
      );
      let sum = 0;
      for (let i = 0; i < timeData.length; i += 1) {
        const v = timeData[i] ?? 0;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / timeData.length);
      const level = Math.min(1, Math.pow(rms * 5.5, 0.78));
      assistantVoiceLevelRef.current = assistantVoiceLevelRef.current * 0.78 + level * 0.22;
      if (!el?.paused && !el?.ended) {
        ttsBeatAtRef.current = performance.now();
        assistantAudioRafRef.current = requestAnimationFrame(tick);
      } else {
        assistantAudioRafRef.current = 0;
      }
    };

    if (!assistantAudioRafRef.current) {
      assistantAudioRafRef.current = requestAnimationFrame(tick);
    }

    return el;
  }, []);

  const unlockAudio = useCallback(() => {
    if (typeof window === 'undefined') return;
    // Отдельный элемент — не трогаем assistantAudioElRef, иначе сбивается Яндекс TTS при отправке сообщения.
    let el = unlockAudioElRef.current;
    if (!el) {
      el = new Audio();
      unlockAudioElRef.current = el;
    }
    const silentSrc =
      'data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
    el.src = silentSrc;
    void el.play().catch(() => {});

    void ensureAssistantAudioChain();
    if (assistantAudioCtxRef.current?.state === 'suspended') {
      assistantAudioCtxRef.current.resume().catch(() => {});
    }
  }, [ensureAssistantAudioChain]);

  const speakFallback = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || isMuted || !text?.trim()) return;
      if (isAssistantAudioPlaying()) return;

      const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
      const now = Date.now();
      if (normalized && normalized === lastSpokenTextRef.current && now - lastSpokenAtRef.current < 4500) {
        return;
      }

      stopAssistantAudio();
      lastSpokenTextRef.current = normalized;
      lastSpokenAtRef.current = now;
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text.trim());
      utterance.lang = 'ru-RU';
      utterance.rate = 0.95;
      utterance.pitch = 0.9;
      utterance.onstart = () => {
        setIsTtsSpeaking(true);
        ttsBeatAtRef.current = performance.now();
      };
      utterance.onend = () => setIsTtsSpeaking(false);
      utterance.onerror = () => setIsTtsSpeaking(false);
      window.speechSynthesis.speak(utterance);
    },
    [isAssistantAudioPlaying, isMuted, stopAssistantAudio]
  );

  const playAssistantAudio = useCallback(
    async (payload: { audioBase64: string; mimeType?: string }) => {
      if (isMuted || !payload.audioBase64) return false;
      if (typeof window !== 'undefined') {
        window.speechSynthesis.cancel();
      }
      stopAssistantAudio();
      const el = ensureAssistantAudioChain();
      if (!el) return false;
      const mime = payload.mimeType || 'audio/mpeg';
      el.src = `data:${mime};base64,${payload.audioBase64}`;
      el.currentTime = 0;
      try {
        if (assistantAudioCtxRef.current?.state === 'suspended') {
          await assistantAudioCtxRef.current.resume();
        }
        await el.play();
        return true;
      } catch (error) {
        console.warn('Assistant audio playback failed', error);
        return false;
      }
    },
    [ensureAssistantAudioChain, isMuted, stopAssistantAudio]
  );

  const waitForAssistantAudio = useCallback(
    (messageId: string, timeoutMs = 8000) =>
      new Promise<{ audioBase64: string; mimeType?: string; format?: 'mp3' | 'oggopus' } | null>(
        (resolve) => {
          const startedAt = Date.now();
          const check = () => {
            const payload = assistantAudioByMessageIdRef.current.get(messageId);
            if (payload) {
              resolve(payload);
              return;
            }
            if (Date.now() - startedAt >= timeoutMs) {
              resolve(null);
              return;
            }
            setTimeout(check, 120);
          };
          check();
        }
      ),
    []
  );

  const speakQuestionWithPriority = useCallback(
    (message: QuestionMessage) => {
      cancelActiveSpeech();
      const epoch = speechEpochRef.current;
      return runSpeechExclusive(async () => {
        if (speechEpochRef.current !== epoch) return;

        const messageId = message?.id;
        if (!messageId || handledSpeechMessageIdsRef.current.has(messageId)) return;
        handledSpeechMessageIdsRef.current.add(messageId);
        if (handledSpeechMessageIdsRef.current.size > 300) {
          const first = handledSpeechMessageIdsRef.current.values().next().value;
          if (first) handledSpeechMessageIdsRef.current.delete(first);
        }

        let payload = assistantAudioByMessageIdRef.current.get(messageId) || null;
        if (!payload) {
          payload = await waitForAssistantAudio(messageId);
        }

        if (speechEpochRef.current !== epoch) return;

        if (payload) {
          assistantAudioByMessageIdRef.current.delete(messageId);
          const played = await playAssistantAudio(payload);
          if (speechEpochRef.current !== epoch) {
            stopAssistantAudio();
            return;
          }
          if (played) {
            lastSpokenTextRef.current = message.question.trim().toLowerCase().replace(/\s+/g, ' ');
            lastSpokenAtRef.current = Date.now();
            await waitForAssistantAudioEnd();
            return;
          }
          if (!canUseBrowserTtsFallback() || isAssistantAudioPlaying()) return;
          speakFallback(message.question);
          return;
        }

        if (!canUseBrowserTtsFallback() || isAssistantAudioPlaying()) return;
        speakFallback(message.question);
      });
    },
    [
      cancelActiveSpeech,
      canUseBrowserTtsFallback,
      isAssistantAudioPlaying,
      playAssistantAudio,
      runSpeechExclusive,
      speakFallback,
      stopAssistantAudio,
      waitForAssistantAudio,
      waitForAssistantAudioEnd,
    ]
  );

  /** Озвучка ответов text / info_card (план, карточка вакансии, диагностика и т.д.) — раньше в очередь попадали только question. */
  const speakAssistantMessageWithPriority = useCallback(
    (message: Message) => {
      cancelActiveSpeech();
      const epoch = speechEpochRef.current;
      return runSpeechExclusive(async () => {
        if (speechEpochRef.current !== epoch) return;
        if (message.role !== MessageRole.ASSISTANT) return;
        if (message.type === MessageType.QUESTION) return;

        const text = getAssistantSpeakableTextForTts(message);
        if (!text) return;

        const messageId = message.id;
        if (!messageId || handledSpeechMessageIdsRef.current.has(messageId)) return;
        handledSpeechMessageIdsRef.current.add(messageId);
        if (handledSpeechMessageIdsRef.current.size > 300) {
          const first = handledSpeechMessageIdsRef.current.values().next().value;
          if (first) handledSpeechMessageIdsRef.current.delete(first);
        }

        let payload = assistantAudioByMessageIdRef.current.get(messageId) || null;
        if (!payload) {
          payload = await waitForAssistantAudio(messageId);
        }

        if (speechEpochRef.current !== epoch) return;

        if (payload) {
          assistantAudioByMessageIdRef.current.delete(messageId);
          const played = await playAssistantAudio(payload);
          if (speechEpochRef.current !== epoch) {
            stopAssistantAudio();
            return;
          }
          if (played) {
            lastSpokenTextRef.current = text.trim().toLowerCase().replace(/\s+/g, ' ');
            lastSpokenAtRef.current = Date.now();
            await waitForAssistantAudioEnd();
            return;
          }
          if (!canUseBrowserTtsFallback() || isAssistantAudioPlaying()) return;
          speakFallback(text);
          return;
        }

        if (!canUseBrowserTtsFallback() || isAssistantAudioPlaying()) return;
        speakFallback(text);
      });
    },
    [
      cancelActiveSpeech,
      canUseBrowserTtsFallback,
      isAssistantAudioPlaying,
      playAssistantAudio,
      runSpeechExclusive,
      speakFallback,
      stopAssistantAudio,
      waitForAssistantAudio,
      waitForAssistantAudioEnd,
    ]
  );

  const voiceMode = useMemo((): VoiceIndicatorMode => {
    if (isListening) return 'listening';
    // Keep one visual style for assistant response (as in typing state).
    if (isTtsSpeaking) return 'typing';
    if (isTyping && typingMessage) return 'typing';
    return 'idle';
  }, [isListening, isTyping, typingMessage, isTtsSpeaking]);

  // Останавливаем звук при мьюте
  useEffect(() => {
    if (isMuted) {
      if (typeof window !== 'undefined') {
        window.speechSynthesis.cancel();
      }
      stopAssistantAudio();
    }
  }, [isMuted, stopAssistantAudio]);

  useEffect(() => {
    return () => {
      stopAssistantAudio();
      if (assistantAudioCtxRef.current) {
        void assistantAudioCtxRef.current.close();
      }
    };
  }, [stopAssistantAudio]);

  const handleShowProfile = useCallback((data: InfoCardMessage) => {
    // Open modal with data from history (may be outdated)
    setProfileData(data);
    setProfileModalOpen(true);
    profileModalOpenRef.current = true;

    // Request fresh profile data from backend
    if (chatRef.current) {
      chatRef.current.sendMessage('покажи мой профиль');
    }
  }, []);

  const handleCloseProfileModal = useCallback(() => {
    setProfileModalOpen(false);
    profileModalOpenRef.current = false;
    setProfileData(null);
  }, []);

  const trackChatFirstUserMessage = useCallback((inputType: string) => {
    if (firstUserMessageCapturedRef.current) return;
    firstUserMessageCapturedRef.current = true;
    captureEvent('chat_first_user_message', {
      product: chatProductRef.current,
      input_type: inputType,
    });
  }, []);

  // Function to initialize chat with a specific product
  const initializeChat = useCallback((
    product: ProductType,
    sessionIdParam?: string,
    isNew?: boolean,
    options?: { vacancyAnalyze?: { text: string; label: string } }
  ) => {
    // Disconnect previous chat if exists
    if (chatRef.current) {
      chatRef.current.disconnect();
      chatRef.current = null;
      chatInitializedRef.current = false;
    }

    setConnecting(true);
    setError(null);
    setMessages([]);
    setSessionCollectedData({});
    setSessionCurrentStepId(null);
    setSessionCompletedSteps([]);
    handledSpeechMessageIdsRef.current.clear();
    speechChainRef.current = Promise.resolve();
    setSessionId(null);
    setCurrentProduct(product);
    autoStarterSentRef.current = false;
    firstUserMessageCapturedRef.current = false;
    chatProductRef.current = product;
    setPendingStarterMessage(null);
    const vacancyAnalyze = options?.vacancyAnalyze ?? null;
    pendingVacancyAnalyzeRef.current = vacancyAnalyze;
    setPendingVacancyAnalyze(vacancyAnalyze);
    setVacancyAnalyzeFlowActive(Boolean(vacancyAnalyze));
    setProductSelected(true);
    setMatchedJobs([]);
    setWeakMatchedJobs([]);
    setJobsMatchMeta(null);
    setJobsLoadState('idle');
    setJobsLastUpdatedAt(null);
    setSidePanelTab('chat');
    setVacanciesFilter('all');
    setNewJobBadgeIds(new Set());
    knownJobIdsRef.current = new Set();
    viewedJobIdsRef.current = new Set();
    vacancyFeedUserIdRef.current = null;
    viewedJobIdsLoadedRef.current = false;
    vacancyFeedBaselinedRef.current = false;
    jobsListHydratedRef.current = false;

    try {
      if (chatConnectTimeoutRef.current) {
        clearTimeout(chatConnectTimeoutRef.current);
      }
      // Страховка от бесконечного "Подключаемся..."
      chatConnectTimeoutRef.current = setTimeout(() => {
        setConnecting(false);
        setConnected(false);
        setError('Не удалось подключиться к чату. Обновите страницу или войдите заново.');
      }, 12000);

      const chat = createChatApi({
        sessionId: sessionIdParam ?? undefined,
        createNew: isNew ?? true,
        product: isNew ? product : undefined,
        intent: vacancyAnalyze ? 'vacancy_analyze' : undefined,
        getClientPreferences: () => ({
          locale: settingsRef.current.locale,
          lang: settingsRef.current.ttsLang,
          voice: settingsRef.current.ttsVoice,
        }),
        onConnected: () => {
          if (chatConnectTimeoutRef.current) {
            clearTimeout(chatConnectTimeoutRef.current);
            chatConnectTimeoutRef.current = null;
          }
          setConnected(true);
          setConnecting(false);
          setError(null);
          captureEvent('chat_session_started', {
            product,
            is_new: isNew ?? true,
          });
        },
        onDisconnected: () => {
          setConnected(false);
          setConnecting(true);
        },
        onSessionJoined: (payload) => {
          setSessionId(payload.sessionId);
          if (payload.metadata?.product) {
            setCurrentProduct(payload.metadata.product);
          }
          if (payload.metadata) {
            setSessionCurrentStepId(
              typeof payload.metadata.currentStepId === 'string'
                ? payload.metadata.currentStepId
                : null
            );
            setSessionCompletedSteps(
              Array.isArray(payload.metadata.completedSteps)
                ? (payload.metadata.completedSteps as string[])
                : []
            );
            const rawCollected = payload.metadata.collectedData;
            if (rawCollected && typeof rawCollected === 'object' && !Array.isArray(rawCollected)) {
              setSessionCollectedData({ ...(rawCollected as Record<string, unknown>) });
            } else {
              setSessionCollectedData({});
            }
          }
          // Keep sessionId in URL to avoid re-triggering "new chat" mode.
          // Не дёргаем replace повторно, если в URL уже наш sessionId — иначе init-эффект
          // перезапустится и чат начнёт «моргать» (disconnect + reconnect).
          if (typeof window !== 'undefined') {
            const currentSessionId = new URLSearchParams(window.location.search).get('sessionId');
            if (currentSessionId === payload.sessionId) {
              return;
            }
          }
          skipParamsEffectRef.current = true;
          router.replace(`/chat?sessionId=${encodeURIComponent(payload.sessionId)}`, { scroll: false });
        },
        onHistory: (payload) => {
          const sortedMessages = dedupeAndSortMessages(payload.messages);

          const hasUserMessages = sortedMessages.some((msg) => msg.role === MessageRole.USER);

          if (!hasUserMessages) {
            const firstAssistantQuestion = sortedMessages.find(
              (msg) => msg.role === MessageRole.ASSISTANT && msg.type === MessageType.QUESTION
            );

            if (firstAssistantQuestion) {
              if (pendingVacancyAnalyzeRef.current) {
                setMessages(dedupeAndSortMessages(sortedMessages));
                syncSessionMetadata();
                return;
              }

              setTypingMessage(firstAssistantQuestion);
              setTypingOptions({ speed: 50, delay: 1200 });
              setIsTyping(true);
              void speakQuestionWithPriority(firstAssistantQuestion as QuestionMessage);

              const withoutIntro = sortedMessages.filter(
                (msg) => msg.id !== firstAssistantQuestion.id
              );
              setMessages(dedupeAndSortMessages(withoutIntro));
              return;
            }
          }

          setMessages(dedupeAndSortMessages(sortedMessages));
          syncSessionMetadata();
        },
        onMessage: (payload) => {
          if (
            payload.message.type === MessageType.INFO_CARD &&
            (payload.message as InfoCardMessage).title === 'Профиль вакансии и план подготовки'
          ) {
            messageApi.destroy('vacancy-prep');
            setVacancyPrepJobId(null);
            setVacancyAnalyzeFlowActive(false);
            pendingVacancyAnalyzeRef.current = null;
            setIsTyping(false);
            setTypingMessage(null);
            setSidePanelTab('profile');
          }

          if (
            profileModalOpenRef.current &&
            payload.message.type === MessageType.INFO_CARD &&
            (payload.message as InfoCardMessage).title === 'Ваш профиль'
          ) {
            setProfileData(payload.message as InfoCardMessage);
          }

          setMessages((prev) => {
            const skipAnimation = Boolean(payload.skipAnimation);

            if (!skipAnimation && shouldAnimateMessage(payload.message, prev)) {
              const pending = typingMessageRef.current;
              let base = prev;
              if (pending && pending.id !== payload.message.id) {
                base = appendMessage(base, pending);
              }

              if (typingMessageIdRef.current !== payload.message.id) {
                setTypingMessage(payload.message);
                setTypingOptions({ speed: 50, delay: 700 });
                setIsTyping(true);
              }

              if (payload.message.type === MessageType.QUESTION) {
                void speakQuestionWithPriority(payload.message as QuestionMessage);
              } else if (
                payload.message.type === MessageType.TEXT &&
                payload.message.interviewMode
              ) {
                void speakAssistantMessageWithPriority(payload.message);
              }

              return base;
            }

            const isNewAssistantMessage = !prev.some((existing) => existing.id === payload.message.id);

            if (
              isNewAssistantMessage &&
              payload.message.role === MessageRole.ASSISTANT &&
              payload.message.type === MessageType.QUESTION
            ) {
              void speakQuestionWithPriority(payload.message as QuestionMessage);
            } else if (
              isNewAssistantMessage &&
              payload.message.role === MessageRole.ASSISTANT &&
              (payload.message.type === MessageType.TEXT ||
                payload.message.type === MessageType.INFO_CARD)
            ) {
              void speakAssistantMessageWithPriority(payload.message);
            }

            return appendMessage(prev, payload.message);
          });
          syncSessionMetadata();
        },
        onError: (payload) => {
          if (chatConnectTimeoutRef.current) {
            clearTimeout(chatConnectTimeoutRef.current);
            chatConnectTimeoutRef.current = null;
          }
          setError(payload.message);
          setConnecting(false);

          const lower = String(payload.message || '').toLowerCase();
          if (
            lower.includes('401') ||
            lower.includes('403') ||
            lower.includes('unauthorized') ||
            lower.includes('forbidden') ||
            lower.includes('токен')
          ) {
            // Токен протух/невалиден: завершаем сессию и просим войти снова,
            // иначе пользователь видит бесконечное подключение.
            clearClientAuthState();
            openAuthModal('login', { source: 'chat_auth_required' });
            router.push('/');
          }
          messageApi.error(payload.message);
          messageApi.destroy('vacancy-prep');
          setVacancyPrepJobId(null);
          setVacancyAnalyzeFlowActive(false);
          pendingVacancyAnalyzeRef.current = null;
        },
        onSendStateChange: (state) => {
          setIsSendingMessage(state === 'sending');
        },
        onAssistantAudio: (payload) => {
          assistantAudioByMessageIdRef.current.set(payload.messageId, payload);
        },
        onMetadataChange: () => {
          syncSessionMetadata();
        },
      });

      chatRef.current = chat;
      void chat.connect().catch((err: unknown) => {
        if (chatConnectTimeoutRef.current) {
          clearTimeout(chatConnectTimeoutRef.current);
          chatConnectTimeoutRef.current = null;
        }
        const messageText =
          err instanceof Error ? err.message : 'Не удалось подключиться к чату';
        setError(messageText);
        setConnecting(false);
        messageApi.error(messageText);
      });
      chatInitializedRef.current = true;
    } catch (err) {
      if (chatConnectTimeoutRef.current) {
        clearTimeout(chatConnectTimeoutRef.current);
        chatConnectTimeoutRef.current = null;
      }
      const messageText = err instanceof Error ? err.message : 'Не удалось подключиться к чату';
      setError(messageText);
      setConnecting(false);
      messageApi.error(messageText);
    }
  }, [
    messageApi,
    openAuthModal,
    playAssistantAudio,
    router,
    speakAssistantMessageWithPriority,
    speakQuestionWithPriority,
  ]);

  // Держим актуальную ссылку на initializeChat, чтобы init-эффект не зависел от неё в deps
  // (иначе смена isMuted/TTS пересоздаёт initializeChat и перезапускает чат).
  const initializeChatRef = useRef(initializeChat);
  useEffect(() => {
    initializeChatRef.current = initializeChat;
  }, [initializeChat]);

  // Финальный teardown только при размонтировании страницы.
  useEffect(() => {
    return () => {
      if (chatConnectTimeoutRef.current) {
        clearTimeout(chatConnectTimeoutRef.current);
        chatConnectTimeoutRef.current = null;
      }
      chatRef.current?.disconnect();
      chatRef.current = null;
      chatInitializedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Перезапуск пришёл от нашего же router.replace(sessionId) — чат уже подключён, выходим.
    if (skipParamsEffectRef.current) {
      skipParamsEffectRef.current = false;
      return;
    }

    if (!isAuthenticated()) {
      messageApi.warning('Авторизуйтесь, чтобы продолжить диалог с LEO.');
      openAuthModal('login', { source: 'chat_auth_required' });
      router.push('/');
      return;
    }

    const isNewChat = searchParams.get('new') === 'true';
    const requestedSessionId = isNewChat ? null : searchParams.get('sessionId');
    const requestedProduct = searchParams.get('product') as ProductType | null;
    const starterFromUrl = searchParams.get('starter');

    // If it's a new chat without a pre-selected product, show product selection screen
    if (isNewChat && !requestedProduct) {
      setIsNewChatMode(true);
      setProductSelected(false);
      setConnecting(false);
      return;
    }

    // If resuming an existing session or product is pre-selected
    if (requestedSessionId || requestedProduct) {
      if (isNewChat && requestedProduct && starterFromUrl) {
        try {
          setPendingStarterMessage(decodeURIComponent(starterFromUrl));
        } catch {
          setPendingStarterMessage(starterFromUrl);
        }
      }
      const product = requestedProduct || 'jack';
      initializeChatRef.current(product, requestedSessionId ?? undefined, isNewChat);
    } else {
      // Default: show product selection for new users
      setIsNewChatMode(true);
      setProductSelected(false);
      setConnecting(false);
    }

    // Не отключаем чат в cleanup при смене searchParams: повторная инициализация
    // (genuine-навигация) сама вызовет disconnect старого чата внутри initializeChat,
    // а финальный teardown делает mount-only эффект выше.
    return () => {
      if (chatConnectTimeoutRef.current) {
        clearTimeout(chatConnectTimeoutRef.current);
        chatConnectTimeoutRef.current = null;
      }
    };
  }, [messageApi, router, searchParams, openAuthModal]);

  // Handler for product selection
  const handleProductScenarioSelect = useCallback((product: ProductType, starterMessage?: string) => {
    captureEvent('chat_product_selected', {
      product,
      has_starter: Boolean(starterMessage),
    });
    setIsNewChatMode(false);
    setPendingStarterMessage(starterMessage ?? null);
    initializeChat(product, undefined, true);
  }, [initializeChat]);

  useEffect(() => {
    if (!pendingStarterMessage || autoStarterSentRef.current) {
      return;
    }
    if (!connected || !chatRef.current || !sessionId) {
      return;
    }
    const hasUserMessages = messages.some((msg) => msg.role === MessageRole.USER);
    if (hasUserMessages) {
      autoStarterSentRef.current = true;
      setPendingStarterMessage(null);
      return;
    }

    trackChatFirstUserMessage('starter');
    chatRef.current.sendMessage(pendingStarterMessage);
    autoStarterSentRef.current = true;
    setPendingStarterMessage(null);
  }, [connected, messages, pendingStarterMessage, sessionId]);

  useEffect(() => {
    const pending = pendingVacancyAnalyzeRef.current ?? pendingVacancyAnalyze;
    if (!pending || autoStarterSentRef.current) {
      return;
    }
    if (!connected || !chatRef.current || !sessionId) {
      return;
    }
    const hasUserMessages = messages.some((msg) => msg.role === MessageRole.USER);
    if (hasUserMessages) {
      autoStarterSentRef.current = true;
      pendingVacancyAnalyzeRef.current = null;
      setPendingVacancyAnalyze(null);
      return;
    }

    autoStarterSentRef.current = true;
    pendingVacancyAnalyzeRef.current = null;
    setPendingVacancyAnalyze(null);
    void chatRef.current.analyzeVacancy(pending.text, pending.label);
  }, [connected, messages, pendingVacancyAnalyze, sessionId]);

  const handleTypingComplete = useCallback(() => {
    setTypingMessage((current) => {
      if (current) {
        setMessages((prev) => appendMessage(prev, current));
      }
      setIsTyping(false);
      return null;
    });
  }, []);

  const handleResumeFile = useCallback(
    async (file: File) => {
      if (!chatRef.current) {
        return;
      }

      setResumeImportLoading(true);
      messageApi.open({
        type: 'loading',
        content: 'Загрузка и разбор резюме…',
        key: 'resume-import',
        duration: 0,
      });

      try {
        const { extractedText, contentList } = await uploadResumeFile(file);
        if (!extractedText || extractedText.trim().length < 40) {
          throw new Error(
            'Не удалось прочитать файл. Попробуйте другой PDF/DOCX или выберите «Быстрый подбор».'
          );
        }

        const scenarioId =
          chatRef.current.metadata?.scenarioId ||
          (currentProduct === 'interview-prep'
            ? 'interview-prep-v1'
            : currentProduct === 'wannanew'
              ? 'wannanew-pm-v1'
              : 'jack-profile-v2');
        const { fields } = await extractProfileFromResumeText(extractedText, scenarioId);
        const hasSignal =
          fields.desired_role ||
          fields.desiredRole ||
          fields.careerSummary ||
          fields.skills_hard ||
          fields.skills ||
          fields.position_1_role;
        if (!hasSignal) {
          messageApi.destroy('resume-import');
          messageApi.warning(
            'Не удалось извлечь данные из резюме. Попробуйте другой файл или «Быстрый подбор».'
          );
          await chatRef.current.sendMessage('Быстрый подбор');
          return;
        }

        const imported = contentList
          ? { ...fields, __resumeContentList: contentList }
          : fields;
        await chatRef.current.mergeCollectedData(imported);
        syncSessionMetadata();
        messageApi.destroy('resume-import');
        messageApi.success('Данные из резюме добавлены в профиль диалога');
      } catch (err) {
        messageApi.destroy('resume-import');
        messageApi.error(err instanceof Error ? err.message : 'Не удалось обработать файл');
      } finally {
        setResumeImportLoading(false);
      }
    },
    [currentProduct, messageApi, syncSessionMetadata]
  );

  const handleResumeTextImport = useCallback(
    async (resumeText: string) => {
      if (!chatRef.current) {
        return;
      }

      const trimmed = resumeText.trim();
      if (trimmed.length < 40) {
        return false;
      }

      setResumeImportLoading(true);
      messageApi.open({
        type: 'loading',
        content: 'Разбор текста резюме…',
        key: 'resume-import',
        duration: 0,
      });

      try {
        const scenarioId =
          chatRef.current.metadata?.scenarioId ||
          (currentProduct === 'interview-prep'
            ? 'interview-prep-v1'
            : currentProduct === 'wannanew'
              ? 'wannanew-pm-v1'
              : 'jack-profile-v2');
        const { fields } = await extractProfileFromResumeText(trimmed, scenarioId);
        const hasSignal =
          fields.desired_role ||
          fields.desiredRole ||
          fields.careerSummary ||
          fields.skills_hard ||
          fields.skills ||
          fields.position_1_role;
        if (!hasSignal) {
          messageApi.destroy('resume-import');
          messageApi.warning(
            'Не удалось извлечь данные из текста. Попробуйте загрузить файл или «Быстрый подбор».'
          );
          await chatRef.current.sendMessage('Быстрый подбор');
          return true;
        }

        await chatRef.current.mergeCollectedData(fields);
        syncSessionMetadata();
        messageApi.destroy('resume-import');
        messageApi.success('Данные из резюме добавлены в профиль диалога');
        return true;
      } catch (err) {
        messageApi.destroy('resume-import');
        messageApi.error(err instanceof Error ? err.message : 'Не удалось обработать текст');
        return true;
      } finally {
        setResumeImportLoading(false);
      }
    },
    [currentProduct, messageApi, syncSessionMetadata]
  );

  const runReportDownload = useCallback(async () => {
    if (!chatRef.current) {
      return;
    }
    try {
      messageApi.loading({ content: 'Генерируем отчёт...', key: 'report', duration: 0 });
      const result = await chatRef.current.requestReport();
      if (result.url) {
        messageApi.success({ content: 'Отчёт готов! Скачивание...', key: 'report' });
        window.open(result.url, '_blank');
      } else {
        messageApi.error({ content: 'Отчёт ещё не готов. Попробуйте позже.', key: 'report' });
      }
    } catch (error) {
      messageApi.error({
        content: error instanceof Error ? error.message : 'Ошибка генерации отчёта',
        key: 'report',
      });
    }
  }, [messageApi]);

  const handleInterviewRestart = useCallback(() => {
    router.push('/chat?new=true&product=interview-prep');
  }, [router]);

  const handleVacancyPrepFromJob = useCallback(
    async (item: MatchedJobItem) => {
      if (!isAuthenticated()) {
        messageApi.warning('Нужна авторизация для разбора вакансии');
        return;
      }

      setVacancyPrepJobId(item.job.id);
      messageApi.loading({
        content: 'Собираем план подготовки по вакансии…',
        key: 'vacancy-prep',
        duration: 0,
      });

      let job = item.job;
      if (!job.description?.trim() && !job.requirements?.trim()) {
        try {
          const response = await fetch(`${getJobMatchingBaseUrl()}/api/jobs/${job.id}`, {
            credentials: 'include',
          });
          if (response.ok) {
            const data = await response.json();
            if (data?.job && typeof data.job === 'object') {
              job = { ...job, ...data.job };
            }
          }
        } catch {
          // используем то, что уже есть в карточке
        }
      }

      const vacancyText = buildVacancyPrepText(job);
      initializeChat('interview-prep', undefined, true, {
        vacancyAnalyze: {
          text: vacancyText,
          label: vacancyPrepDisplayLabel(job.title, job.company),
        },
      });
    },
    [getJobMatchingBaseUrl, initializeChat, messageApi]
  );

  const handleOpenVacancyFromJob = useCallback(
    (item: MatchedJobItem, variant: 'recommended' | 'weak') => {
      if (!isAuthenticated()) {
        messageApi.warning('Нужна авторизация для просмотра вакансии');
        return;
      }
      markVacancyAsViewed(item.job.id);
      setVacancyPreview({ item, variant });
    },
    [markVacancyAsViewed, messageApi]
  );

  const handleCloseVacancyPreview = useCallback(() => {
    setVacancyPreview(null);
  }, []);

  const handleVacancyPrepFromPreview = useCallback(() => {
    if (!vacancyPreview) return;
    setVacancyPreview(null);
    void handleVacancyPrepFromJob(vacancyPreview.item);
  }, [handleVacancyPrepFromJob, vacancyPreview]);

  const vacancyPreviewContext = useMemo(
    () =>
      vacancyPreview
        ? {
            jobId: vacancyPreview.item.job.id,
            title: vacancyPreview.item.job.title,
            company: vacancyPreview.item.job.company,
            score: vacancyPreview.item.score,
            source: vacancyPreview.item.job.source,
            sourceUrl: vacancyPreview.item.job.source_url,
            reasons: vacancyPreview.item.reasons,
            variant: vacancyPreview.variant,
          }
        : null,
    [vacancyPreview]
  );

  useEffect(() => {
    if (searchParams.get('hhConnected') !== '1') {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete('hhConnected');
    const query = params.toString();
    router.replace(query ? `/chat?${query}` : '/chat');
  }, [router, searchParams]);

  const handleGenerateResumeDraft = useCallback(async () => {
    if (!chatRef.current) return;
    try {
      setResumeDraftLoading(true);
      messageApi.loading({ content: 'Формируем черновик резюме...', key: 'resume-draft', duration: 0 });
      await chatRef.current.generateResume();
      messageApi.success({ content: 'Резюме сгенерировано и добавлено в чат', key: 'resume-draft' });
    } catch (error) {
      messageApi.error({
        content: error instanceof Error ? error.message : 'Не удалось сформировать резюме',
        key: 'resume-draft',
      });
    } finally {
      setResumeDraftLoading(false);
    }
  }, [messageApi]);

  const handleGenerateSummary = useCallback(async () => {
    if (!chatRef.current) return;
    try {
      setSummaryLoading(true);
      messageApi.loading({ content: 'Анализируем профиль и формируем саммари...', key: 'summary', duration: 0 });
      const result = await chatRef.current.generateSummary();
      if (!result?.professionalSummary) {
        throw new Error('Сервер вернул пустое саммари');
      }
      messageApi.success({
        content:
          result.score != null
            ? `Саммари готово · оценка ${result.score}/10. Скачайте PDF или DOCX в чате.`
            : 'Саммари готово. Скачайте PDF или DOCX в чате.',
        key: 'summary',
      });
    } catch (error) {
      messageApi.error({
        content: error instanceof Error ? error.message : 'Не удалось сгенерировать саммари',
        key: 'summary',
      });
    } finally {
      setSummaryLoading(false);
    }
  }, [messageApi]);

  const handleSendResumeByEmail = useCallback(async (email?: string) => {
    if (!chatRef.current) return;
    try {
      setResumeEmailLoading(true);
      messageApi.loading({ content: 'Отправляем резюме на почту...', key: 'resume-email', duration: 0 });
      const result = await chatRef.current.sendResumeEmail(email);
      messageApi.success({
        content: `Резюме и сопроводительное отправлены на ${result.email}`,
        key: 'resume-email',
      });
    } catch (error) {
      messageApi.error({
        content: error instanceof Error ? error.message : 'Не удалось отправить резюме на почту',
        key: 'resume-email',
      });
    } finally {
      setResumeEmailLoading(false);
    }
  }, [messageApi]);

  const handleSend = (values: MessageFormValues) => {
    unlockAudio();
    cancelActiveSpeech();
    if (!chatRef.current) {
      return;
    }

    const messageText = values.message || inputText;
    if (!messageText.trim()) {
      return;
    }

    // Останавливаем распознавание, если оно активно
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
      isListeningRef.current = false;
    }

    if (
      currentProduct === 'jack' &&
      sessionCurrentStepId === 'resume_upload' &&
      messageText.trim().length >= 40
    ) {
      form.resetFields();
      setInputText('');
      finalTranscriptRef.current = '';
      void handleResumeTextImport(messageText);
      return;
    }

    trackChatFirstUserMessage('text');
    chatRef.current.sendMessage(messageText);
    form.resetFields();
    setInputText('');
    finalTranscriptRef.current = '';
  };

  const handleCommandSelect = async (command: CommandItem) => {
    unlockAudio();
    if (!chatRef.current) {
      return;
    }

    if (command.action === 'download_resume_pdf' || command.action === 'download_resume_docx') {
      try {
        const format = command.action === 'download_resume_pdf' ? 'pdf' : 'docx';
        const { blob, fileName } = await chatRef.current.downloadResumeFile(format);
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
        messageApi.success(`Файл ${fileName} скачан`);
      } catch (error) {
        messageApi.error(
          error instanceof Error ? error.message : 'Не удалось скачать файл резюме'
        );
      }
      return;
    }

    if (command.action === 'download_summary_pdf' || command.action === 'download_summary_docx') {
      try {
        const format = command.action === 'download_summary_pdf' ? 'pdf' : 'docx';
        const { blob, fileName } = await chatRef.current.downloadSummaryFile(format);
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = fileName;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
        messageApi.success(`Файл ${fileName} скачан`);
      } catch (error) {
        messageApi.error(
          error instanceof Error ? error.message : 'Не удалось скачать файл саммари'
        );
      }
      return;
    }

    if (command.action === 'download_report' || command.action === 'download_prep_report') {
      await runReportDownload();
      return;
    }

    if (command.action === 'new_vacancy') {
      handleInterviewRestart();
      return;
    }

    if (command.action === 'open_vacancies' || command.action === 'show_recommendations') {
      focusMobileWorkspace();
      setSidePanelTab('vacancies');
      await fetchMatchedJobs({ revealPanel: true, triggerWeakMatchGate: true });
      return;
    }

    if (command.action === 'resume_start_quick') {
      await chatRef.current.executeCommand(command.id, command.action);
      syncSessionMetadata();
      return;
    }

    const modeFromAction = parseInterviewModeFromAction(command.action);
    if (modeFromAction) {
      focusMobileWorkspace();
      setPrepHistoryFilter(modeFromAction);
      setSidePanelTab('chat');
      if (modeFromAction === 'mock') {
        const gate = evaluateMockGate(interviewPrepCollectedSnapshot);
        if (!gate.allowed) {
          return;
        }
      }
      await chatRef.current.sendMessage(buildInterviewPrepModeStartMessage(modeFromAction));
      return;
    }

    await chatRef.current.executeCommand(command.id, command.action);
    syncSessionMetadata();
  };

  const jackCollectedSnapshot = sessionCollectedData;

  const interviewPrepCollectedSnapshot = useMemo((): Record<string, unknown> => {
    if (currentProduct !== 'interview-prep') {
      return {};
    }
    return jackCollectedSnapshot;
  }, [currentProduct, jackCollectedSnapshot]);

  const interviewPrepPlanDays = useMemo(() => {
    const raw = interviewPrepCollectedSnapshot.prepPlan;
    if (!Array.isArray(raw)) {
      return [];
    }
    return raw.filter(
      (day): day is { day: number; focus: string; tasks: string[] } =>
        day != null &&
        typeof day === 'object' &&
        typeof (day as { day?: unknown }).day === 'number' &&
        typeof (day as { focus?: unknown }).focus === 'string' &&
        Array.isArray((day as { tasks?: unknown }).tasks)
    );
  }, [interviewPrepCollectedSnapshot.prepPlan]);

  const interviewPrepProgress = useMemo(() => {
    if (interviewPrepPlanDays.length === 0) {
      return null;
    }
    return (
      (interviewPrepCollectedSnapshot.prepProgress as ReturnType<typeof computePrepProgress>) ??
      computePrepProgress(interviewPrepPlanDays, interviewPrepCollectedSnapshot)
    );
  }, [interviewPrepPlanDays, interviewPrepCollectedSnapshot]);

  const mockGateBlockers = useMemo(() => {
    if (currentProduct !== 'interview-prep') {
      return [];
    }
    return evaluateMockGate(interviewPrepCollectedSnapshot).blockers;
  }, [currentProduct, interviewPrepCollectedSnapshot]);

  const interviewPrepArtifacts = useMemo(() => {
    if (currentProduct !== 'interview-prep') {
      return [];
    }
    return resolvePrepArtifacts(interviewPrepCollectedSnapshot, messages);
  }, [currentProduct, interviewPrepCollectedSnapshot, messages]);

  const handleOpenArtifactInChat = useCallback((artifact: { mode: InterviewPrepMode }) => {
    setPrepHistoryFilter(artifact.mode);
    setSidePanelTab('chat');
  }, []);

  const handlePrepActivityStart = useCallback(
    async (mode: InterviewPrepMode, startMessage: string) => {
      unlockAudio();
      if (!chatRef.current) {
        return;
      }
      if (mode === 'mock') {
        const gate = evaluateMockGate(interviewPrepCollectedSnapshot);
        if (!gate.allowed) {
          return;
        }
        await handleCommandSelect(interviewModeCommandItem('mock'));
        return;
      }
      setPrepHistoryFilter(mode);
      setSidePanelTab('chat');
      // Один round-trip: executeCommand + sendMessage давали два ответа LEO и «ребит» печати на сцене.
      await chatRef.current.sendMessage(startMessage);
    },
    [handleCommandSelect, interviewPrepCollectedSnapshot]
  );

  const handleMockStart = useCallback(() => {
    unlockAudio();
    chatRef.current?.sendMessage('готов');
  }, []);

  const latestQuestion = useMemo(
    () => extractLatest<QuestionMessage>(messages, MessageType.QUESTION),
    [messages]
  );

  const latestInfoCard = useMemo(
    () => extractLatest<InfoCardMessage>(messages, MessageType.INFO_CARD),
    [messages]
  );

  const centerStageQuestion = useMemo(() => {
    if (currentProduct === 'jack') {
      // После разбора резюме показываем info_card (профиль + кнопки), а не старый вопрос upload.
      if (sessionCurrentStepId === 'resume_ready') {
        return undefined;
      }
      return latestQuestion;
    }
    if (currentProduct !== 'interview-prep') {
      return latestQuestion;
    }
    if (vacancyAnalyzeFlowActive || !latestQuestion) {
      return undefined;
    }
    if (interviewPrepCollectedSnapshot.lesson_phase === 'learn') {
      return undefined;
    }

    // Показываем вопрос на сцене только если он ещё актуален: после него не пришёл
    // ответ LEO текстом (теория/кейс). Иначе StagePanel оставит карточку вакансии.
    const latestAssistantPrompt = [...messages]
      .reverse()
      .find(
        (m) =>
          m.role === MessageRole.ASSISTANT &&
          (m.type === MessageType.QUESTION || m.type === MessageType.TEXT)
      );

    if (
      latestAssistantPrompt?.type === MessageType.QUESTION &&
      latestAssistantPrompt.id === latestQuestion.id
    ) {
      return latestQuestion;
    }

    return undefined;
  }, [
    currentProduct,
    vacancyAnalyzeFlowActive,
    latestQuestion,
    messages,
    interviewPrepCollectedSnapshot.lesson_phase,
    sessionCurrentStepId,
  ]);

  const handleTheoryReady = useCallback(() => {
    unlockAudio();
    chatRef.current?.sendMessage('готов');
  }, []);

  const VACANCY_PROFILE_CARD_TITLE = 'Профиль вакансии и план подготовки';

const PREP_COMPLETE_CARD_TITLE = 'Подготовка завершена!';

  const centerStagePrepContent = useMemo((): PrepModeStageContent | undefined => {
    if (currentProduct !== 'interview-prep' || vacancyAnalyzeFlowActive || centerStageQuestion) {
      return undefined;
    }

    if (latestInfoCard?.title === PREP_COMPLETE_CARD_TITLE) {
      return undefined;
    }

    const latestAssistantText = [...messages]
      .reverse()
      .find(
        (m) =>
          m.role === MessageRole.ASSISTANT &&
          m.type === MessageType.TEXT &&
          Boolean(m.interviewMode)
      ) as TextMessage | undefined;

    if (!latestAssistantText?.interviewMode) {
      return undefined;
    }

    if (latestInfoCard?.title === VACANCY_PROFILE_CARD_TITLE) {
      const textTime = new Date(latestAssistantText.timestamp).getTime();
      const cardTime = new Date(latestInfoCard.timestamp).getTime();
      if (textTime <= cardTime) {
        return undefined;
      }
    }

    return {
      modeLabel: INTERVIEW_PREP_MODE_LABELS[latestAssistantText.interviewMode],
      content: latestAssistantText.content,
      packType: latestAssistantText.packType,
      badge:
        interviewPrepCollectedSnapshot.lastResponsePhase === 'rescue'
          ? 'rescue'
          : interviewPrepCollectedSnapshot.lastResponsePhase === 'mock_micro_rescue'
            ? 'micro_rescue'
            : latestAssistantText.packType === 'rescue_cheatsheet'
              ? 'rescue'
              : undefined,
      theoryLearnReady:
        latestAssistantText.interviewMode === 'theory' &&
        interviewPrepCollectedSnapshot.lesson_phase === 'learn' &&
        !latestAssistantText.packType,
      onTheoryReady: handleTheoryReady,
      mockBriefing:
        latestAssistantText.interviewMode === 'mock' &&
        interviewPrepCollectedSnapshot.mockPhase === 'briefing',
      mockQuestionLabel:
        latestAssistantText.interviewMode === 'mock' &&
        interviewPrepCollectedSnapshot.mockPhase === 'active'
          ? (() => {
              const mockInterview = interviewPrepCollectedSnapshot.mockInterview as
                | { currentQuestionIndex?: number }
                | undefined;
              const index = mockInterview?.currentQuestionIndex ?? 1;
              return `Вопрос ${Math.min(index, 3)}/3`;
            })()
          : undefined,
      onMockStart: handleMockStart,
    };
  }, [
    currentProduct,
    vacancyAnalyzeFlowActive,
    centerStageQuestion,
    messages,
    latestInfoCard,
    interviewPrepCollectedSnapshot,
    handleMockStart,
    handleTheoryReady,
  ]);

  const interviewPrepThreadsEnabled = useMemo(
    () =>
      currentProduct === 'interview-prep' &&
      (latestInfoCard?.title === 'Профиль вакансии и план подготовки' ||
        messages.some((m) => Boolean(m.interviewMode))),
    [currentProduct, latestInfoCard?.title, messages]
  );

  const chatHistoryMessages = useMemo(() => {
    if (!interviewPrepThreadsEnabled) {
      return messages;
    }
    return filterMessagesByPrepHistory(messages, prepHistoryFilter);
  }, [messages, interviewPrepThreadsEnabled, prepHistoryFilter]);

  const latestCommand = useMemo(
    () => extractLatest<CommandMessage>(messages, MessageType.COMMAND),
    [messages]
  );

  /** Кнопки сценария (не показываем для экрана «Интервью завершено!» — там действия внутри карточек) */
  const stagePanelCommands = useMemo(() => {
    if (
      (currentProduct === 'wannanew' || currentProduct === 'interview-prep') &&
      latestInfoCard?.title === 'Интервью завершено!'
    ) {
      return undefined;
    }
    if (currentProduct === 'interview-prep' && latestInfoCard?.title === PREP_COMPLETE_CARD_TITLE) {
      return latestInfoCard.commands;
    }
    const fromCard = latestInfoCard?.commands;
    if (fromCard && fromCard.length > 0) {
      return fromCard;
    }
    if (latestCommand?.commands && latestCommand.commands.length > 0) {
      return latestCommand.commands;
    }
    return undefined;
  }, [latestInfoCard, latestCommand, currentProduct]);

  useEffect(() => {
    if (!connected || !sessionId) {
      return;
    }
    if (currentProduct !== 'wannanew' && currentProduct !== 'interview-prep') {
      setInterviewReportPreview(null);
      setInterviewReportError(null);
      return;
    }
    if (latestInfoCard?.title !== 'Интервью завершено!') {
      setInterviewReportPreview(null);
      setInterviewReportError(null);
      return;
    }

    let cancelled = false;
    setInterviewReportLoading(true);
    setInterviewReportError(null);

    const api = chatRef.current;
    if (!api?.fetchReportPreview) {
      setInterviewReportLoading(false);
      return;
    }

    void api
      .fetchReportPreview()
      .then((data) => {
        if (!cancelled) {
          setInterviewReportPreview(data as InterviewReportPreview);
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setInterviewReportError(e.message);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setInterviewReportLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connected, sessionId, currentProduct, latestInfoCard?.title, latestInfoCard?.id]);

  /** Блок загрузки резюме — только на шаге resume_upload, не на greeting */
  const showResumeUploadInQuestion = useMemo(() => {
    if (!connected) return false;
    if (currentProduct === 'jack') {
      return sessionCurrentStepId === 'resume_upload';
    }
    const q = latestQuestion;
    if (!q) return false;
    const t = `${q.question} ${q.placeholder || ''}`.toLowerCase();
    if (currentProduct === 'wannanew') {
      return /резюме|pdf|docx/.test(t);
    }
    return /резюме|pdf|docx|cv\b/.test(t);
  }, [connected, latestQuestion, currentProduct, sessionCurrentStepId]);

  /** Чипы выбора сценария под первым вопросом (jack — подбор; interview-prep — собеседование). */
  const scenarioQuickReplies = useMemo(() => {
    if (!connected) return undefined;
    const q = latestQuestion;
    if (!q) return undefined;
    const ph = (q.placeholder || '').toLowerCase();
    const text = `${q.question} ${q.placeholder || ''}`.toLowerCase();

    if (currentProduct === 'jack') {
      if (sessionCurrentStepId && sessionCurrentStepId !== 'greeting') {
        return undefined;
      }
      const looksLikeScenarioChooser =
        (ph.includes('быстрый подбор') && ph.includes('детализированный')) ||
        (text.includes('быстр') && text.includes('детал') && text.includes('сценар')) ||
        text.includes('готовое резюме') ||
        text.includes('проанализировать');
      if (!looksLikeScenarioChooser) return undefined;
      return [
        { label: 'Быстрый подбор', value: 'Быстрый подбор', hint: '3 вопроса · 1–2 минуты' },
        {
          label: 'Детальный анализ',
          value: 'Детализированный анализ',
          hint: 'Полный профиль · 5–7 минут',
        },
        {
          label: 'Проанализировать готовое резюме',
          value: 'Проанализировать готовое резюме',
          hint: 'Мгновенный подбор',
        },
      ];
    }

    if (currentProduct === 'interview-prep') {
      const looksLikeInterviewChooser =
        (ph.includes('пробное собеседование') && ph.includes('разбор вакансии')) ||
        (text.includes('пробн') && text.includes('разбор') && text.includes('ваканс'));
      if (!looksLikeInterviewChooser) return undefined;
      return [
        {
          label: 'Пробное собеседование',
          value: 'Пробное собеседование',
          hint: 'Интервью на вашу позицию + отчёт',
        },
        {
          label: 'Разбор вакансии',
          value: 'Разбор вакансии',
          hint: 'План, теория, кейсы, мок-интервью',
        },
      ];
    }

    return undefined;
  }, [connected, currentProduct, latestQuestion, sessionCurrentStepId]);

  const latestUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === MessageRole.USER) {
        return messages[i].id;
      }
    }
    return null;
  }, [messages]);

  const jackProfileReadyForMatch = useMemo(
    () => jackCollectedDataReadyForJobMatch(jackCollectedSnapshot),
    [jackCollectedSnapshot]
  );

  const jackProfileRows = useMemo(
    () =>
      currentProduct === 'jack'
        ? getJackProfileSidebarRows(jackCollectedSnapshot, settings.locale)
        : [],
    [currentProduct, jackCollectedSnapshot, settings.locale]
  );

  const jackProfileVisibleRows = useMemo(() => {
    if (currentProduct !== 'jack') return jackProfileRows;

    const optionalKeys = new Set([
      'readyToStart',
      'pauseChoice',
      'privacyConfirmed',
      'completionChoice',
    ]);
    const rawPositionsCount = jackCollectedSnapshot.positionsCount;
    const parsedPositionsCount =
      typeof rawPositionsCount === 'number'
        ? rawPositionsCount
        : typeof rawPositionsCount === 'string'
          ? Number.parseInt(rawPositionsCount.trim(), 10)
          : Number.NaN;
    const positionsLimit = Number.isFinite(parsedPositionsCount)
      ? Math.max(1, Math.min(5, parsedPositionsCount))
      : null;

    return jackProfileRows.filter((row) => {
      if (optionalKeys.has(row.key) && !row.filled) {
        return false;
      }

      const positionMatch = row.key.match(/^position_(\d+)_/);
      if (positionMatch && positionsLimit !== null) {
        const positionIndex = Number.parseInt(positionMatch[1], 10);
        if (Number.isFinite(positionIndex) && positionIndex > positionsLimit) {
          return false;
        }
      }

      return true;
    });
  }, [currentProduct, jackProfileRows, jackCollectedSnapshot]);

  const jackProfileSections = useMemo(() => {
    const m = new Map<string, (typeof jackProfileVisibleRows)[number][]>();
    for (const row of jackProfileVisibleRows) {
      const list = m.get(row.section) ?? [];
      list.push(row);
      m.set(row.section, list);
    }
    return Array.from(m.entries());
  }, [jackProfileVisibleRows]);

  const profileEditableRows = useMemo(
    () =>
      jackProfileVisibleRows.filter(
        (row) => !['readyToStart', 'pauseChoice', 'privacyConfirmed'].includes(row.key)
      ),
    [jackProfileVisibleRows]
  );

  const handleOpenProfileEdit = useCallback(() => {
    const initialValues: ProfileEditFormValues = {};
    for (const row of profileEditableRows) {
      const raw = jackCollectedSnapshot[row.key];
      if (raw === undefined || raw === null) {
        initialValues[row.key] = '';
      } else if (typeof raw === 'string') {
        initialValues[row.key] = raw;
      } else if (typeof raw === 'number' || typeof raw === 'boolean') {
        initialValues[row.key] = String(raw);
      } else if (Array.isArray(raw)) {
        initialValues[row.key] = raw.map((item) => String(item)).join(', ');
      } else {
        initialValues[row.key] = JSON.stringify(raw);
      }
    }

    profileEditForm.setFieldsValue(initialValues);
    setProfileEditOpen(true);
  }, [jackCollectedSnapshot, profileEditForm, profileEditableRows]);

  const handleStartDetailedAnalysis = useCallback(() => {
    unlockAudio();
    if (!chatRef.current) return;
    setSidePanelTab('chat');
    void chatRef.current
      .executeCommand('quick_start_detailed', 'start_detailed_analysis')
      .catch(() => {
        chatRef.current?.sendMessage('детальный анализ');
      });
  }, [unlockAudio]);

  const handleEditProfileFromVacancies = useCallback(() => {
    setSidePanelTab('profile');
    handleOpenProfileEdit();
  }, [handleOpenProfileEdit]);

  const showVacanciesInsight = useMemo(
    () =>
      shouldShowVacanciesInsight(jobsMatchMeta, matchedJobs.length, weakMatchedJobs.length),
    [jobsMatchMeta, matchedJobs.length, weakMatchedJobs.length]
  );

  const displayedMatchedJobs = useMemo(() => {
    if (vacanciesFilter === 'new') {
      return filterJobsByNew(matchedJobs, newJobBadgeIds);
    }
    if (vacanciesFilter === 'favorite') {
      return filterJobsByFavorite(matchedJobs, favoriteJobIds);
    }
    return matchedJobs;
  }, [favoriteJobIds, matchedJobs, newJobBadgeIds, vacanciesFilter]);

  const displayedWeakMatchedJobs = useMemo(() => {
    if (vacanciesFilter === 'new') {
      return filterJobsByNew(weakMatchedJobs, newJobBadgeIds);
    }
    if (vacanciesFilter === 'favorite') {
      return filterJobsByFavorite(weakMatchedJobs, favoriteJobIds);
    }
    return weakMatchedJobs;
  }, [favoriteJobIds, newJobBadgeIds, vacanciesFilter, weakMatchedJobs]);

  const hasVisibleVacancies =
    displayedMatchedJobs.length > 0 || displayedWeakMatchedJobs.length > 0;

  useEffect(() => {
    if (vacanciesFilter === 'new' && newJobBadgeIds.size === 0) {
      setVacanciesFilter('all');
    }
    if (vacanciesFilter === 'favorite' && favoriteJobIds.size === 0) {
      setVacanciesFilter('all');
    }
  }, [favoriteJobIds.size, newJobBadgeIds.size, vacanciesFilter]);

  const jobsMatchInfoTooltip = useMemo(() => {
    if (!jobsMatchMeta || jobsLoadState !== 'success') return null;
    return buildJobsMatchInfoTooltip(jobsMatchMeta, settings.locale);
  }, [jobsLoadState, jobsMatchMeta, settings.locale]);

  const matchInfoTip = jobsMatchInfoTooltip ? (
    <ChatHelpPopover content={<span className="whitespace-pre-line">{jobsMatchInfoTooltip}</span>} ariaLabel="Как считался подбор" />
  ) : null;

  const handleCloseProfileEdit = useCallback(() => {
    setProfileEditOpen(false);
    profileEditForm.resetFields();
  }, [profileEditForm]);

  const handleSaveProfileEdit = useCallback(async () => {
    if (!chatRef.current) return;

    try {
      const values = await profileEditForm.validateFields();
      const payload: Record<string, unknown> = {};

      for (const row of profileEditableRows) {
        if (!(row.key in values)) continue;
        const rawValue = values[row.key];
        if (typeof rawValue !== 'string') continue;

        const trimmed = rawValue.trim();
        if (trimmed.length === 0) continue;

        if (row.key === 'positionsCount' || row.key === 'totalExperience') {
          const parsed = Number.parseInt(trimmed, 10);
          payload[row.key] = Number.isFinite(parsed) ? parsed : trimmed;
        } else {
          payload[row.key] = trimmed;
        }
      }

      setProfileEditSaving(true);
      await chatRef.current.mergeCollectedData(payload);
      syncSessionMetadata();
      messageApi.success('Профиль обновлён');
      handleCloseProfileEdit();
    } catch (error) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        return;
      }
      messageApi.error(error instanceof Error ? error.message : 'Не удалось сохранить профиль');
    } finally {
      setProfileEditSaving(false);
    }
  }, [handleCloseProfileEdit, messageApi, profileEditForm, profileEditableRows, syncSessionMetadata]);

  const fetchMatchedJobs = useCallback(async (options?: {
    revealPanel?: boolean;
    silent?: boolean;
    triggerWeakMatchGate?: boolean;
  }) => {
    if (!isAuthenticated()) {
      if (!options?.silent) {
        messageApi.warning('Нужна авторизация для подбора вакансий');
      }
      return;
    }

    const userId = await getAuthenticatedUserId();
    if (!userId) {
      if (!options?.silent) {
        messageApi.error('Не удалось определить пользователя. Перезайдите в аккаунт.');
      }
      return;
    }

    const activeSessionId = chatRef.current?.sessionId || sessionId;
    const sessionQuery = activeSessionId
      ? `?sessionId=${encodeURIComponent(activeSessionId)}`
      : '';

    const backgroundRefresh = Boolean(options?.silent && jobsListHydratedRef.current);
    const wasListHydrated = jobsListHydratedRef.current;
    if (!backgroundRefresh) {
      setIsJobsLoading(true);
      setJobsError(null);
      setJobsLoadState('matching');
    }
    if (options?.revealPanel) {
      setSidePanelTab('vacancies');
    }
    lastJobsFetchAtRef.current = Date.now();

    try {
      const response = await fetch(
        `${getJobMatchingBaseUrl()}/api/jobs/match/${userId}${sessionQuery}`,
        {
          credentials: 'include',
        }
      );

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      const jobs = Array.isArray(data?.jobs) ? (data.jobs as MatchedJobItem[]) : [];
      const weakJobs = Array.isArray(data?.weakJobs) ? (data.weakJobs as MatchedJobItem[]) : [];

      await hydrateVacancyFeedState(userId);

      const mergedLists = syncVacancyListsFromApi(
        jobs,
        weakJobs,
        matchedJobsRef.current,
        weakMatchedJobsRef.current
      );
      setMatchedJobs(mergedLists.recommended);
      setWeakMatchedJobs(mergedLists.weak);
      setJobsLoadState('success');
      setJobsLastUpdatedAt(new Date().toLocaleTimeString());

      const jobsInDb = typeof data?.jobsInDb === 'number' ? data.jobsInDb : 0;
      const jobsScanned = typeof data?.jobsScanned === 'number' ? data.jobsScanned : jobsInDb;
      const maxMatchScore = typeof data?.maxMatchScore === 'number' ? data.maxMatchScore : 0;
      const matchThreshold =
        typeof data?.matchThreshold === 'number' ? data.matchThreshold : 30;
      const totalMatched =
        typeof data?.totalMatched === 'number' ? data.totalMatched : jobs.length;
      const weakTierTotal =
        typeof data?.weakTierTotal === 'number' ? data.weakTierTotal : weakJobs.length;
      const weakMatchFloor =
        typeof data?.weakMatchFloor === 'number' ? data.weakMatchFloor : 12;
      const profileFamily =
        typeof data?.profileFamily === 'string' ? data.profileFamily : null;
      const profileFamilyLabel =
        typeof data?.profileFamilyLabel === 'string' ? data.profileFamilyLabel : null;
      const familyRelevanceShare =
        typeof data?.familyRelevanceShare === 'number' ? data.familyRelevanceShare : undefined;
      const familyCatalogCount =
        typeof data?.familyCatalogCount === 'number' ? data.familyCatalogCount : undefined;
      const catalogWarning =
        data?.catalogWarning === 'catalog_family_mismatch' ||
        data?.catalogWarning === 'no_matches' ||
        data?.catalogWarning === 'empty_catalog'
          ? (data.catalogWarning as JobsMatchMeta['catalogWarning'])
          : null;
      setJobsMatchMeta({
        jobsInDb,
        jobsScanned,
        maxMatchScore,
        matchThreshold,
        totalMatched,
        weakTierTotal,
        weakMatchFloor,
        profileFamily,
        profileFamilyLabel,
        familyRelevanceShare,
        familyCatalogCount,
        catalogWarning,
      });
      jobsListHydratedRef.current = true;

      const mergedIds = collectVacancyIds(mergedLists.recommended, mergedLists.weak);
      const currentFeedJobCount =
        matchedJobsRef.current.length + weakMatchedJobsRef.current.length;
      const persistedFeed = loadVacancyFeedState(userId);
      const hasEstablishedFeedHistory = hasEstablishedVacancyFeedHistory(
        persistedFeed.knownJobIds.length,
        knownJobIdsRef.current.size
      );
      const isBaselineFeedLoad = shouldBaselineVacancyFeedLoad({
        feedBaselined: vacancyFeedBaselinedRef.current,
        hasEstablishedFeedHistory,
        currentFeedJobCount,
      });
      const { newIds } = detectNewVacancyIds(
        mergedIds,
        knownJobIdsRef.current,
        viewedJobIdsRef.current
      );

      for (const id of mergedIds) {
        knownJobIdsRef.current.add(id);
      }

      if (isBaselineFeedLoad) {
        vacancyFeedBaselinedRef.current = true;
      }

      setNewJobBadgeIds((prev) => {
        let base = prev;
        if (
          !isBaselineFeedLoad &&
          hasEstablishedFeedHistory &&
          !wasListHydrated
        ) {
          base = sanitizeRestoredNewJobIds(
            persistedFeed,
            viewedJobIdsRef.current,
            mergedIds
          );
        }
        const next = applyVacancyNewBadges(base, mergedIds, newIds, isBaselineFeedLoad);
        persistVacancyFeedState(userId, next);
        return next;
      });

      if (options?.triggerWeakMatchGate) {
        const weakMatch =
          sessionCurrentStepId === 'resume_ready' &&
          jobs.length === 0 &&
          (weakJobs.length === 0 ? jobsInDb > 0 : true);
        if (weakMatch && chatRef.current) {
          messageApi.info('Подбор пока слабый — уточним пару деталей в чате.');
          await chatRef.current.executeCommand('resume_weak_clarify', 'resume_weak_match');
          syncSessionMetadata();
        }
      }

      if (!options?.silent) {
        if (jobs.length > 0 || weakJobs.length > 0) {
          if (jobs.length > 0 && weakJobs.length > 0) {
            messageApi.success(
              `Рекомендуем: ${jobs.length}, со слабым совпадением: ${weakJobs.length}`
            );
          } else if (jobs.length > 0) {
            messageApi.success(`Найдено вакансий: ${jobs.length}`);
          } else {
            messageApi.success(
              `Показано ${weakJobs.length} со слабым совпадением — уточните профиль для раздела «Рекомендуем».`
            );
          }
        } else if (jobsInDb === 0) {
          messageApi.info('В каталоге пока нет вакансий.');
        } else {
          messageApi.info(
            'Подбор обновлён: нет вакансий в зоне рекомендаций и слабого совпадения. Уточните профиль в чате.'
          );
        }
      }
    } catch (error) {
      const rawMessage =
        error instanceof Error ? error.message : 'Не удалось получить вакансии';
      const messageText =
        rawMessage === 'Failed to get user profile'
          ? 'Сервис профиля временно недоступен. Обновите страницу через минуту.'
          : rawMessage;
      if (!backgroundRefresh) {
        setJobsError(messageText);
        setJobsLoadState('error');
      }
      if (!options?.silent) {
        messageApi.error(messageText);
      }
    } finally {
      if (!backgroundRefresh) {
        setIsJobsLoading(false);
      }
    }
  }, [getJobMatchingBaseUrl, hydrateVacancyFeedState, messageApi, persistVacancyFeedState, sessionCurrentStepId, syncSessionMetadata]);

  /**
   * Кнопка reload теперь делает «умное обновление»:
   * 1) ставит в очередь сбор свежих вакансий под профиль пользователя;
   * 2) фоном перезапрашивает match через задержку, когда каталог успеет обновиться.
   */
  const requestFreshJobsForProfile = useCallback(async () => {
    if (!isAuthenticated()) {
      messageApi.warning('Нужна авторизация');
      return;
    }
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      messageApi.error('Не удалось определить пользователя. Перезайдите в аккаунт.');
      return;
    }

    if (!jackProfileReadyForMatch) {
      messageApi.info(
        'Сначала укажите в чате желаемую роль и опыт — тогда подбор и сбор вакансий будут точными.'
      );
      return;
    }

    if (jobsScrapeTimeoutRef.current) {
      clearTimeout(jobsScrapeTimeoutRef.current);
      jobsScrapeTimeoutRef.current = null;
    }

    try {
      setIsJobsLoading(true);
      setJobsLoadState('scraping');
      const response = await fetch(
        `${getJobMatchingBaseUrl()}/api/jobs/scrape/for-user/${userId}`,
        {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      messageApi.success(
        data?.usedProfileKeywords
          ? `Сбор вакансий под профиль (${data.familyPrimary || 'профиль'}) запущен. Через ~20 с пересчитаем матч.`
          : 'Запущен общий сбор. Уточните желаемую должность в чате для точного подбора.'
      );

      jobsScrapeTimeoutRef.current = setTimeout(() => {
        jobsScrapeTimeoutRef.current = null;
        void fetchMatchedJobs({ revealPanel: false, silent: true });
      }, 20_000);
    } catch (error) {
      setJobsLoadState('error');
      messageApi.error(
        error instanceof Error
          ? error.message
          : 'Не удалось запустить сбор свежих вакансий'
      );
    } finally {
      setIsJobsLoading(false);
    }
  }, [fetchMatchedJobs, getJobMatchingBaseUrl, jackProfileReadyForMatch, messageApi]);

  useEffect(() => {
    if (!productSelected || currentProduct !== 'jack' || !connected || !latestUserMessageId) {
      return;
    }
    if (latestAutoTriggeredMessageIdRef.current === latestUserMessageId) {
      return;
    }

    latestAutoTriggeredMessageIdRef.current = latestUserMessageId;

    if (autoRefreshTimeoutRef.current) {
      clearTimeout(autoRefreshTimeoutRef.current);
    }

    autoRefreshTimeoutRef.current = setTimeout(() => {
      const now = Date.now();
      if (now - lastJobsFetchAtRef.current < 8000) {
        return;
      }
      if (!jackProfileReadyForMatch) {
        return;
      }
      void fetchMatchedJobs({ revealPanel: false, silent: true });
    }, 1800);

    return () => {
      if (autoRefreshTimeoutRef.current) {
        clearTimeout(autoRefreshTimeoutRef.current);
      }
    };
  }, [connected, currentProduct, fetchMatchedJobs, jackProfileReadyForMatch, latestUserMessageId, productSelected]);

  /** Первая загрузка матча при открытии вкладки — только когда профиль готов для подбора. */
  useEffect(() => {
    if (sidePanelTab !== 'vacancies' || isJobsLoading || currentProduct !== 'jack') {
      return;
    }
    if (!jackProfileReadyForMatch) {
      return;
    }
    if (jobsLoadState !== 'idle' || jobsMatchMeta !== null) {
      return;
    }
    void fetchMatchedJobs({ revealPanel: false, silent: true });
  }, [
    currentProduct,
    fetchMatchedJobs,
    isJobsLoading,
    jackProfileReadyForMatch,
    jobsLoadState,
    jobsMatchMeta,
    sidePanelTab,
  ]);

  useEffect(() => {
    return () => {
      if (jobsScrapeTimeoutRef.current) {
        clearTimeout(jobsScrapeTimeoutRef.current);
        jobsScrapeTimeoutRef.current = null;
      }
    };
  }, []);

  /**
   * Фоновый пересчёт каталога в открытой вкладке «Вакансии».
   * Пользователь может не нажимать никаких кнопок — список держится актуальным.
   */
  useEffect(() => {
    if (backgroundJobsPollingRef.current) {
      clearInterval(backgroundJobsPollingRef.current);
      backgroundJobsPollingRef.current = null;
    }
    if (currentProduct !== 'jack' || sidePanelTab !== 'vacancies') {
      return;
    }

    backgroundJobsPollingRef.current = setInterval(() => {
      if (isJobsLoading) return;
      if (!jackProfileReadyForMatch) return;
      const now = Date.now();
      if (now - lastJobsFetchAtRef.current < 15_000) return;
      void fetchMatchedJobs({ revealPanel: false, silent: true });
    }, 30_000);

    return () => {
      if (backgroundJobsPollingRef.current) {
        clearInterval(backgroundJobsPollingRef.current);
        backgroundJobsPollingRef.current = null;
      }
    };
  }, [currentProduct, fetchMatchedJobs, isJobsLoading, jackProfileReadyForMatch, sidePanelTab]);

  useEffect(() => {
    if (currentProduct !== 'jack' && sidePanelTab === 'vacancies') {
      setSidePanelTab('chat');
    }
  }, [currentProduct, sidePanelTab]);

  const sidePanelTabs = useMemo((): { id: SidePanelTab; label: string }[] => {
    if (currentProduct !== 'jack') {
      return [
        { id: 'chat', label: ui('tabChat') },
        {
          id: 'profile',
          label: currentProduct === 'interview-prep' ? ui('prep') : ui('profile'),
        },
      ];
    }
    return [
      { id: 'chat', label: ui('tabChat') },
      { id: 'vacancies', label: ui('tabVacancies') },
      { id: 'profile', label: ui('profile') },
    ];
  }, [currentProduct, settings.locale]);

  const handleLogout = () => {
    Modal.confirm({
      title: ui('logoutConfirmTitle'),
      content: ui('logoutConfirmContent'),
      okText: ui('logout'),
      cancelText: ui('cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await userAPI.logout();
        } catch {
          // Even if backend logout fails, clear local auth state.
        }
        captureEvent('user_logged_out');
        clearClientAuthState();
        // Disconnect chat
        chatRef.current?.disconnect();
        // Redirect to home
        router.push('/');
        messageApi.success(ui('logoutSuccess'));
      },
    });
  };

  return (
    <Layout
      className={`leo-chat-layout min-h-screen ${
        settings.theme === 'hume-light'
          ? 'bg-[var(--color-bone)] text-[var(--color-ink)]'
          : 'bg-[#050913] text-white'
      }`}
    >
      {contextHolder}
      <Content
        className={`box-border flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden px-4 pb-2 pt-4 sm:px-6 sm:pb-3 sm:pt-6 lg:px-8 ${
          productSelected ? 'max-lg:pb-0' : ''
        } ${
          !productSelected && isNewChatMode ? 'lg:py-4' : 'lg:py-8'
        }`}
      >
        <div
          className={`flex min-h-0 flex-1 w-full max-w-[1400px] mx-auto flex-col overflow-hidden ${
            !productSelected && isNewChatMode ? 'gap-2 sm:gap-3 lg:gap-3' : 'gap-3 sm:gap-4 lg:gap-5'
          }`}
        >
          <header className="flex-shrink-0 flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Title
                level={2}
                style={{
                  color: settings.theme === 'hume-light' ? 'var(--color-ink)' : 'white',
                  marginBottom: 0,
                }}
                className="leo-chat-title text-lg sm:text-xl lg:text-2xl"
              >
                {!productSelected && isNewChatMode
                  ? ui('newChat')
                  : ui('chatTitle')}
              </Title>
            </div>
            <ChatAppHeaderNav onLogout={handleLogout} />
          </header>

          {productSelected ? (
            <div
              role="tablist"
              aria-label={ui('mobileMainTabsAria')}
              className={`flex shrink-0 gap-1 rounded-2xl border p-1 lg:hidden ${
                isHume
                  ? 'border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)]'
                  : 'border-white/10 bg-white/[0.04]'
              }`}
            >
              {(
                [
                  { id: 'stage' as const, label: ui('tabMobileStage') },
                  { id: 'workspace' as const, label: ui('tabMobileWorkspace') },
                ] as const
              ).map(({ id, label }) => {
                const selected = mobileMainTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setMobileMainTab(id)}
                    className={`flex-1 rounded-xl border-none px-3 py-2.5 text-sm font-semibold transition-colors ${
                      selected
                        ? isHume
                          ? 'bg-[var(--color-ink)] text-[var(--color-paper)]'
                          : 'bg-green-500 text-white shadow-lg shadow-green-950/20'
                        : isHume
                          ? 'bg-transparent text-[var(--color-smoke)] hover:bg-[var(--color-bone)] hover:text-[var(--color-ink)]'
                          : 'bg-transparent text-slate-300 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div
            className={`min-h-0 gap-3 sm:gap-4 lg:gap-5 ${
              !productSelected && isNewChatMode
                ? 'grid flex-1 grid-cols-1 overflow-hidden'
                : 'flex h-full min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[1fr_minmax(320px,380px)]'
            }`}
          >
            <section
              className={`leo-chat-panel flex min-h-0 flex-col ${
                productSelected
                  ? mobileMainTab === 'workspace'
                    ? 'max-lg:hidden'
                    : 'max-lg:flex max-lg:min-h-0 max-lg:flex-1'
                  : ''
              } ${
                !productSelected && isNewChatMode
                  ? isHume
                    ? 'flex-1 overflow-y-auto overscroll-y-contain rounded-2xl border border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)] sm:rounded-3xl [-webkit-overflow-scrolling:touch] lg:overflow-hidden'
                    : 'flex-1 overflow-y-auto overscroll-y-contain rounded-2xl border border-white/[0.08] bg-[#050913]/50 sm:rounded-3xl [-webkit-overflow-scrolling:touch] lg:overflow-hidden'
                  : isHume
                    ? 'gap-2 max-lg:overflow-hidden rounded-2xl border border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)] p-3 sm:gap-4 sm:p-4 lg:gap-5 lg:overflow-auto lg:p-5'
                    : 'gap-2 max-lg:overflow-hidden rounded-2xl border border-white/10 bg-white/[0.04] p-3 backdrop-blur sm:gap-4 sm:p-4 lg:gap-5 lg:overflow-auto lg:p-5'
              }`}
            >
              {/* Show product selection screen for new chats */}
              {!productSelected && isNewChatMode ? (
                <ProductSelectionScreen onSelect={handleProductScenarioSelect} />
              ) : (
                <>
                  <div className={`flex-shrink-0 ${isHume ? 'leo-chat-wave-bleed' : ''}`}>
                    <VoiceIndicator
                      isActive={(connected && !isMuted) || isListening}
                      isMuted={isMuted && !isListening}
                      mode={voiceMode}
                      ttsBeatAtRef={ttsBeatAtRef}
                      assistantLevelRef={assistantVoiceLevelRef}
                      waveOnly
                      waveCompact={isHume}
                    />
                  </div>

                  <div className="leo-chat-stage-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain chat-history-scroll py-0.5 sm:py-1 [-webkit-overflow-scrolling:touch]">
                    {connecting ? (
                      <div className="flex flex-col items-center justify-center gap-4">
                        <Spin size="large" />
                        <Text
                          style={{
                            color:
                              settings.theme === 'hume-light'
                                ? 'var(--color-smoke)'
                                : 'rgba(226, 232, 240, 0.85)',
                          }}
                        >
                          {currentProduct === 'wannanew' ? ui('connectingLeo') : ui('connecting')}
                        </Text>
                      </div>
                    ) : vacancyAnalyzeFlowActive &&
                      !latestInfoCard &&
                      currentProduct === 'interview-prep' ? (
                      <div className="flex flex-col items-center justify-center gap-4 px-4 text-center">
                        <Spin size="large" />
                        <Text
                          style={{
                            color:
                              settings.theme === 'hume-light'
                                ? 'var(--color-smoke)'
                                : 'rgba(226, 232, 240, 0.85)',
                          }}
                        >
                          Собираем план подготовки по вакансии…
                        </Text>
                      </div>
                    ) : isTyping && typingMessage ? (
                      <div className="flex flex-col items-start justify-center w-full">
                        <TypingMessage
                          message={typingMessage}
                          typingSpeed={typingOptions.speed}
                          delay={typingOptions.delay}
                          onComplete={handleTypingComplete}
                          variant={
                            currentProduct === 'interview-prep' &&
                            isInterviewPrepStageAssistantMessage(typingMessage)
                              ? 'stage'
                              : 'bubble'
                          }
                          stageModeLabel={
                            currentProduct === 'interview-prep' &&
                            isInterviewPrepStageAssistantMessage(typingMessage)
                              ? getInterviewPrepStageModeLabel(typingMessage)
                              : undefined
                          }
                        />
                      </div>
                    ) : (
                      <div className="flex w-full min-h-0 items-start justify-center">
                        <StagePanel
                          question={centerStageQuestion}
                          prepModeContent={centerStagePrepContent}
                          infoCard={latestInfoCard}
                          commands={stagePanelCommands}
                          onCommandSelect={handleCommandSelect}
                          detailedProgressLabel={jackDetailedProgressLabel}
                          quickReplies={
                            vacancyAnalyzeFlowActive ? undefined : scenarioQuickReplies
                          }
                          onQuickReply={(value) => {
                            unlockAudio();
                            cancelActiveSpeech();
                            chatRef.current?.sendMessage(value);
                          }}
                          interviewPrepOnOpenOverview={
                            currentProduct === 'interview-prep' &&
                            latestInfoCard?.title === 'Профиль вакансии и план подготовки'
                              ? () => setSidePanelTab('profile')
                              : undefined
                          }
                          onContinue={() => {
                            if (chatRef.current) {
                              chatRef.current.sendMessage('продолжить');
                            }
                          }}
                          interviewReport={
                            (currentProduct === 'wannanew' ||
                              currentProduct === 'interview-prep') &&
                            latestInfoCard?.title === 'Интервью завершено!'
                              ? {
                                  loading: interviewReportLoading,
                                  error: interviewReportError,
                                  data: interviewReportPreview,
                                  onDownloadPdf: runReportDownload,
                                  onRestart: handleInterviewRestart,
                                }
                              : undefined
                          }
                          profileCompletion={
                            currentProduct === 'jack' &&
                            latestInfoCard?.title === '✅ Профиль успешно собран!'
                              ? {
                                  resumeLoading: resumeDraftLoading,
                                  emailLoading: resumeEmailLoading,
                                  summaryLoading,
                                  onGenerateResume: handleGenerateResumeDraft,
                                  onSendResumeEmail: handleSendResumeByEmail,
                                  onGenerateSummary: handleGenerateSummary,
                                }
                              : undefined
                          }
                          resumeUpload={
                            showResumeUploadInQuestion
                              ? {
                                  onFile: handleResumeFile,
                                  loading: resumeImportLoading,
                                  disabled: !connected,
                                }
                              : undefined
                          }
                        />
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>

            {/* Hide aside panel when in product selection mode */}
            {productSelected && (
              <aside
                className={`leo-chat-sidebar relative flex w-full min-h-0 flex-col p-4 sm:p-5 rounded-2xl sm:rounded-3xl ${
                  mobileMainTab === 'stage'
                    ? 'max-lg:hidden'
                    : 'max-lg:flex max-lg:min-h-0 max-lg:flex-1'
                } ${
                  isHume
                    ? 'border border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)]'
                    : 'border border-white/10 bg-white/[0.04] backdrop-blur'
                }`}
              >
                <div className="mb-3 sm:mb-4 flex flex-shrink-0 flex-col">
                  <div
                    role="tablist"
                    aria-label={ui('sidebarSectionsAria')}
                    className="flex w-full min-w-0 items-stretch gap-1 border-b border-white/10 pb-2.5 sm:pb-3"
                  >
                    {sidePanelTabs.map(({ id, label }) => {
                      const selected = sidePanelTab === id;
                      return (
                        <Button
                          key={id}
                          role="tab"
                          aria-selected={selected}
                          type={selected ? 'primary' : 'text'}
                          size="small"
                          onClick={() => setSidePanelTab(id)}
                          className={
                            selected
                              ? isHume
                                ? 'leo-sidebar-tab-active !h-8 !min-w-0 !flex-1 !basis-0 !rounded-full !border-none !px-2 !text-xs !font-medium'
                                : '!h-8 !min-w-0 !flex-1 !basis-0 !rounded-full !border-none !bg-green-500 !px-2 !text-xs !font-medium !text-white !shadow-lg hover:!bg-green-400'
                              : isHume
                                ? 'leo-sidebar-tab-inactive !h-8 !min-w-0 !flex-1 !basis-0 !rounded-full !px-2 !text-xs !font-medium'
                                : '!h-8 !min-w-0 !flex-1 !basis-0 !rounded-full !px-2 !text-xs !font-medium !text-slate-400 hover:!bg-white/[0.06] hover:!text-slate-100'
                          }
                        >
                          {label}
                        </Button>
                      );
                    })}
                  </div>
                  <div className="min-w-0 pt-2.5 sm:pt-3">
                    {sidePanelTab === 'vacancies' ? (
                      <>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-100 leading-snug">
                          <span>{v('matchedTitle')}</span>
                          <ChatHelpPopover
                            content={v('matchedTooltip')}
                            ariaLabel={v('matchedTooltipAria')}
                          />
                        </div>
                        {jackProfileReadyForMatch &&
                        (matchedJobs.length > 0 ||
                        weakMatchedJobs.length > 0 ||
                        newJobBadgeIds.size > 0 ||
                        favoriteJobIds.size > 0) ? (
                          <div className="mt-1.5 space-y-1.5">
                            {matchedJobs.length > 0 || weakMatchedJobs.length > 0 ? (
                              <div className="text-xs text-slate-400">
                                {[
                                  matchedJobs.length > 0
                                    ? inRecommendedSummary(settings.locale, matchedJobs.length)
                                    : null,
                                  weakMatchedJobs.length > 0
                                    ? weakMatchSummary(settings.locale, weakMatchedJobs.length)
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </div>
                            ) : null}
                            {newJobBadgeIds.size > 0 || favoriteJobIds.size > 0 ? (
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {newJobBadgeIds.size > 0 ? (
                              <ChatHoverTooltip title={v('newBadgeTooltip')}>
                                  <Button
                                    type="text"
                                    size="small"
                                    aria-pressed={vacanciesFilter === 'new'}
                                    onClick={() =>
                                      setVacanciesFilter((current) =>
                                        current === 'new' ? 'all' : 'new'
                                      )
                                    }
                                    className={
                                      vacanciesFilter === 'new'
                                        ? isHume
                                          ? 'leo-vacancies-new-filter leo-vacancies-new-filter--active !h-auto !min-h-0 !rounded-full !border-0 !px-2 !py-0.5 !text-[11px] !font-medium !leading-none !shadow-none'
                                          : '!h-auto !min-h-0 !rounded-full !border-0 !px-2 !py-0.5 !text-[11px] !font-medium !leading-none !bg-emerald-500/25 !text-emerald-100 !shadow-none ring-1 ring-emerald-400/40 hover:!bg-emerald-500/30 hover:!text-emerald-50'
                                        : isHume
                                          ? 'leo-vacancies-new-filter !h-auto !min-h-0 !rounded-full !border-0 !px-2 !py-0.5 !text-[11px] !font-medium !leading-none !shadow-none'
                                          : '!h-auto !min-h-0 !rounded-full !border-0 !px-2 !py-0.5 !text-[11px] !font-medium !leading-none !bg-emerald-500/15 !text-emerald-300/95 !shadow-none ring-1 ring-emerald-400/20 hover:!bg-emerald-500/22 hover:!text-emerald-200'
                                    }
                                  >
                                    +{newJobBadgeIds.size}{' '}
                                    {newJobsBadgeWord(settings.locale, newJobBadgeIds.size)}
                                  </Button>
                              </ChatHoverTooltip>
                            ) : null}
                            {favoriteJobIds.size > 0 ? (
                              <ChatHoverTooltip title={v('favoriteBadgeTooltip')}>
                                <Button
                                  type="text"
                                  size="small"
                                  aria-pressed={vacanciesFilter === 'favorite'}
                                  onClick={() =>
                                    setVacanciesFilter((current) =>
                                      current === 'favorite' ? 'all' : 'favorite'
                                    )
                                  }
                                  className={
                                    vacanciesFilter === 'favorite'
                                      ? isHume
                                        ? 'leo-vacancies-favorite-filter leo-vacancies-favorite-filter--active !h-auto !min-h-0 !rounded-full !border-0 !px-2 !py-0.5 !text-[11px] !font-medium !leading-none !shadow-none'
                                        : '!h-auto !min-h-0 !rounded-full !border-0 !px-2 !py-0.5 !text-[11px] !font-medium !leading-none !bg-rose-500/25 !text-rose-100 !shadow-none ring-1 ring-rose-400/40 hover:!bg-rose-500/30 hover:!text-rose-50'
                                      : isHume
                                        ? 'leo-vacancies-favorite-filter !h-auto !min-h-0 !rounded-full !border-0 !px-2 !py-0.5 !text-[11px] !font-medium !leading-none !shadow-none'
                                        : '!h-auto !min-h-0 !rounded-full !border-0 !px-2 !py-0.5 !text-[11px] !font-medium !leading-none !bg-rose-500/15 !text-rose-300/95 !shadow-none ring-1 ring-rose-400/20 hover:!bg-rose-500/22 hover:!text-rose-200'
                                  }
                                >
                                  {vacanciesFilter === 'favorite' ? (
                                    <HeartFilled className="!text-[11px]" aria-hidden />
                                  ) : (
                                    <HeartOutlined className="!text-[11px]" aria-hidden />
                                  )}
                                  <span className="ml-1 tabular-nums">{favoriteJobIds.size}</span>
                                </Button>
                              </ChatHoverTooltip>
                            ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                        {vacanciesFilter === 'new' && newJobBadgeIds.size > 0 ? (
                          <div
                            className={
                              isHume
                                ? 'mt-1 text-[11px] text-[var(--color-slate-plum)]'
                                : 'mt-1 text-[11px] text-emerald-400/75'
                            }
                          >
                            {v('newFilterActive')}
                          </div>
                        ) : null}
                        {vacanciesFilter === 'favorite' && favoriteJobIds.size > 0 ? (
                          <div
                            className={
                              isHume
                                ? 'mt-1 text-[11px] text-[var(--color-slate-plum)]'
                                : 'mt-1 text-[11px] text-rose-400/75'
                            }
                          >
                            {v('favoriteFilterActive')}
                          </div>
                        ) : null}
                      </>
                    ) : sidePanelTab === 'profile' ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-100 leading-snug">
                          {currentProduct === 'interview-prep' ? ui('prep') : ui('profile')}
                        </div>
                        {currentProduct === 'jack' ? (
                          <Button
                            type="text"
                            size="small"
                            className={`!h-6 !rounded-full !px-2 !text-[11px] !font-medium ${
                              isHume
                                ? 'leo-profile-edit-btn'
                                : '!text-slate-300 hover:!text-slate-100 hover:!bg-white/[0.06]'
                            }`}
                            onClick={handleOpenProfileEdit}
                            disabled={!connected || profileEditableRows.length === 0}
                          >
                            {ui('edit')}
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="text-sm font-semibold text-slate-100 leading-snug">
                          {ui('dialogueHistory')}
                        </div>
                        {interviewPrepThreadsEnabled ? (
                          <div
                            role="tablist"
                            aria-label="Треды подготовки"
                            className="flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                          >
                            <Button
                              role="tab"
                              aria-selected={prepHistoryFilter === 'general'}
                              type={prepHistoryFilter === 'general' ? 'primary' : 'text'}
                              size="small"
                              onClick={() => setPrepHistoryFilter('general')}
                              className={
                                prepHistoryFilter === 'general'
                                  ? '!h-7 !shrink-0 !rounded-full !border-none !bg-white/15 !px-2.5 !text-[11px] !font-medium !text-white'
                                  : '!h-7 !shrink-0 !rounded-full !px-2.5 !text-[11px] !font-medium !text-slate-400 hover:!bg-white/[0.06] hover:!text-slate-100'
                              }
                            >
                              {ui('prepHistoryGeneral')}
                            </Button>
                            {INTERVIEW_PREP_MODES.map((mode) => {
                              const selected = prepHistoryFilter === mode;
                              const count = messages.filter((m) => m.interviewMode === mode).length;
                              return (
                                <Button
                                  key={mode}
                                  role="tab"
                                  aria-selected={selected}
                                  type={selected ? 'primary' : 'text'}
                                  size="small"
                                  onClick={() => setPrepHistoryFilter(mode)}
                                  className={
                                    selected
                                      ? '!h-7 !shrink-0 !rounded-full !border-none !bg-green-500/90 !px-2.5 !text-[11px] !font-medium !text-white'
                                      : '!h-7 !shrink-0 !rounded-full !px-2.5 !text-[11px] !font-medium !text-slate-400 hover:!bg-white/[0.06] hover:!text-slate-100'
                                  }
                                >
                                  {INTERVIEW_PREP_MODE_TAB_LABELS[mode]}
                                  {count > 0 ? (
                                    <span className="ml-1 opacity-75">({count})</span>
                                  ) : null}
                                </Button>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>
                </div>
                <div className="chat-history-scroll overflow-y-auto flex-1 pr-1">
                  {sidePanelTab === 'vacancies' ? (
                    currentProduct !== 'jack' ? (
                      <div className="text-sm text-slate-400">
                        {v('wannanewNoJobs')}
                      </div>
                    ) : (
                      <>
                        {jackProfileReadyForMatch ? (
                        <div className="mb-3 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                            <span className="min-w-0 leading-relaxed">
                              {jobsRefreshStatusLabel(jobsLoadState, jobsLastUpdatedAt, settings.locale)}
                            </span>
                            {currentProduct === 'jack' ? (
                              <div className="flex shrink-0 items-center gap-1">
                                <ChatHoverTooltip title={v('refreshTooltip')}>
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<ReloadOutlined />}
                                    loading={isJobsLoading || jobsLoadState === 'scraping'}
                                    disabled={!jackProfileReadyForMatch}
                                    onClick={() => {
                                      void requestFreshJobsForProfile();
                                    }}
                                    className="!shrink-0 !text-slate-400 hover:!text-slate-200 disabled:!text-slate-600"
                                    aria-label={v('refreshAria')}
                                  />
                                </ChatHoverTooltip>
                              </div>
                            ) : null}
                          </div>
                          {jobsMatchMeta?.catalogWarning === 'catalog_family_mismatch' ? (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] leading-snug text-amber-100">
                              {catalogFamilyMismatchWarning(
                                settings.locale,
                                jobsMatchMeta.profileFamilyLabel,
                                jobsMatchMeta.familyRelevanceShare
                              )}
                            </div>
                          ) : null}
                          {jobsMatchMeta?.catalogWarning === 'empty_catalog' ? (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] leading-snug text-amber-100">
                              {v('emptyCatalog')}
                            </div>
                          ) : null}
                        </div>
                        ) : null}
                        {!jackProfileReadyForMatch ? (
                          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 space-y-3">
                            <p className="text-sm font-medium text-slate-200">
                              {v('gateTitle')}
                            </p>
                            <p className="text-xs text-slate-400 leading-relaxed">
                              {v('gateBody')}
                            </p>
                            <Button
                              type="primary"
                              size="small"
                              onClick={() => setSidePanelTab('chat')}
                              className="!rounded-full !border-0 !bg-green-500 !text-white hover:!bg-green-400"
                            >
                              {v('continueInChat')}
                            </Button>
                          </div>
                        ) : isJobsLoading || jobsLoadState === 'matching' ? (
                      <div className="flex items-center justify-center py-8">
                        <Spin size="small" />
                      </div>
                    ) : jobsError ? (
                      <div className="text-sm text-red-300">{jobsError}</div>
                    ) : showVacanciesInsight && jobsMatchMeta ? (
                      <div className="space-y-4">
                        <VacanciesInsightPanel
                          meta={jobsMatchMeta}
                          onDetailedAnalysis={handleStartDetailedAnalysis}
                          onEditProfile={handleEditProfileFromVacancies}
                        />
                        {displayedWeakMatchedJobs.length > 0 ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-1.5">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-400/90">
                                {v('possibleWeakMatch')}
                              </div>
                              {displayedMatchedJobs.length === 0 ? matchInfoTip : null}
                            </div>
                            {displayedWeakMatchedJobs.map((item) => (
                              <MatchedJobCard
                                key={item.job.id}
                                variant="weak"
                                title={item.job.title}
                                company={item.job.company}
                                score={item.score}
                                source={item.job.source}
                                sourceUrl={item.job.source_url}
                                reasons={item.reasons}
                                isFavorite={favoriteJobIds.has(item.job.id)}
                                onToggleFavorite={() => handleToggleVacancyFavorite(item.job.id)}
                                favoriteAriaLabel={
                                  favoriteJobIds.has(item.job.id)
                                    ? v('removeFromFavorites')
                                    : v('addToFavorites')
                                }
                                isNew={newJobBadgeIds.has(item.job.id)}
                                onOpenVacancy={() => handleOpenVacancyFromJob(item, 'weak')}
                                onVacancyPrep={() => void handleVacancyPrepFromJob(item)}
                                vacancyPrepLoading={vacancyPrepJobId === item.job.id}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : matchedJobs.length > 0 || weakMatchedJobs.length > 0 ? (
                      !hasVisibleVacancies && vacanciesFilter === 'new' ? (
                        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                          <p className="text-sm text-emerald-100/90">{v('newFilterEmpty')}</p>
                          <Button
                            type="primary"
                            size="small"
                            onClick={() => setVacanciesFilter('all')}
                            className="!rounded-full !border-0 !bg-emerald-500 !text-white hover:!bg-emerald-400"
                          >
                            {v('showAllVacancies')}
                          </Button>
                        </div>
                      ) : !hasVisibleVacancies && vacanciesFilter === 'favorite' ? (
                        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 space-y-3">
                          <p className="text-sm text-rose-100/90">{v('favoriteFilterEmpty')}</p>
                          <Button
                            type="primary"
                            size="small"
                            onClick={() => setVacanciesFilter('all')}
                            className="!rounded-full !border-0 !bg-rose-500 !text-white hover:!bg-rose-400"
                          >
                            {v('showAllVacancies')}
                          </Button>
                        </div>
                      ) : (
                      <div className="space-y-6">
                        {displayedMatchedJobs.length > 0 ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-1.5">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400/90">
                                {v('recommended')}
                              </div>
                              {matchInfoTip}
                            </div>
                            {displayedMatchedJobs.map((item) => (
                              <MatchedJobCard
                                key={item.job.id}
                                variant="recommended"
                                title={item.job.title}
                                company={item.job.company}
                                score={item.score}
                                source={item.job.source}
                                sourceUrl={item.job.source_url}
                                reasons={item.reasons}
                                isFavorite={favoriteJobIds.has(item.job.id)}
                                onToggleFavorite={() => handleToggleVacancyFavorite(item.job.id)}
                                favoriteAriaLabel={
                                  favoriteJobIds.has(item.job.id)
                                    ? v('removeFromFavorites')
                                    : v('addToFavorites')
                                }
                                isNew={newJobBadgeIds.has(item.job.id)}
                                onOpenVacancy={() => handleOpenVacancyFromJob(item, 'recommended')}
                                onVacancyPrep={() => void handleVacancyPrepFromJob(item)}
                                vacancyPrepLoading={vacancyPrepJobId === item.job.id}
                              />
                            ))}
                          </div>
                        ) : null}
                        {displayedWeakMatchedJobs.length > 0 ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-1.5">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-400/90">
                                {v('weakMatch')}
                              </div>
                              {displayedMatchedJobs.length === 0 ? matchInfoTip : null}
                            </div>
                            {displayedWeakMatchedJobs.map((item) => (
                              <MatchedJobCard
                                key={item.job.id}
                                variant="weak"
                                title={item.job.title}
                                company={item.job.company}
                                score={item.score}
                                source={item.job.source}
                                sourceUrl={item.job.source_url}
                                reasons={item.reasons}
                                isFavorite={favoriteJobIds.has(item.job.id)}
                                onToggleFavorite={() => handleToggleVacancyFavorite(item.job.id)}
                                favoriteAriaLabel={
                                  favoriteJobIds.has(item.job.id)
                                    ? v('removeFromFavorites')
                                    : v('addToFavorites')
                                }
                                isNew={newJobBadgeIds.has(item.job.id)}
                                onOpenVacancy={() => handleOpenVacancyFromJob(item, 'weak')}
                                onVacancyPrep={() => void handleVacancyPrepFromJob(item)}
                                vacancyPrepLoading={vacancyPrepJobId === item.job.id}
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                      )
                    ) : jobsLoadState === 'success' ? (
                      <div className="text-sm text-slate-400 leading-relaxed">
                        {v('autoUpdateHint')}
                      </div>
                    ) : null}
                      </>
                    )
                  ) : sidePanelTab === 'profile' ? (
                    currentProduct === 'interview-prep' ? (
                      latestInfoCard?.title === 'Профиль вакансии и план подготовки' ? (
                        <InterviewPrepInfoOverview
                          compact
                          infoCard={latestInfoCard}
                          commands={latestInfoCard.commands}
                          onCommandSelect={handleCommandSelect}
                          onPrepModeSelect={(mode) => {
                            if (mode === 'mock' && mockGateBlockers.length > 0) {
                              return;
                            }
                            void handleCommandSelect(interviewModeCommandItem(mode));
                          }}
                          prepProgress={interviewPrepProgress}
                          collectedData={interviewPrepCollectedSnapshot}
                          onActivityStart={(mode, startMessage) => {
                            void handlePrepActivityStart(mode, startMessage);
                          }}
                          mockGateBlockers={mockGateBlockers}
                          onDownloadReport={() => {
                            void runReportDownload();
                          }}
                          prepArtifacts={interviewPrepArtifacts}
                          onOpenArtifactInChat={handleOpenArtifactInChat}
                        />
                      ) : (
                        <div className="text-sm text-slate-400 leading-relaxed">
                          Здесь появятся карточки «Профиль вакансии и план подготовки» после того, как вы
                          отправите в чат текст вакансии или требования к роли.
                        </div>
                      )
                    ) : currentProduct !== 'jack' ? (
                      <div className="space-y-3">
                        {Object.keys(jackCollectedSnapshot).length === 0 ? (
                          <div className="text-sm text-slate-400">Пока нет сохранённых данных профиля.</div>
                        ) : (
                          Object.keys(jackCollectedSnapshot)
                            .sort()
                            .map((key) => (
                              <div
                                key={key}
                                className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2"
                              >
                                <div className="text-[11px] uppercase tracking-wide text-slate-500">{key}</div>
                                <div className="text-sm text-slate-100 mt-0.5 whitespace-pre-wrap break-words">
                                  {formatCollectedValue(jackCollectedSnapshot[key], settings.locale)}
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    ) : !jackProfileVisibleRows.some((r) => r.filled) ? (
                      <div className="text-sm text-slate-400 leading-relaxed">
                        {ui('profileEmptyJack')}
                      </div>
                    ) : (
                      <div className="pb-1">
                        {jackProfileSections.map(([section, rows]) => (
                          <div key={section} className="mb-5 last:mb-0">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">
                              {section}
                            </div>
                            <div className="space-y-2">
                              {rows.map((row) => (
                                <div
                                  key={row.key}
                                  className={`rounded-lg border px-2.5 py-2 ${
                                    row.filled
                                      ? 'border-white/10 bg-white/[0.03]'
                                      : 'border-white/[0.06] bg-white/[0.01] opacity-70'
                                  }`}
                                >
                                  <div className="text-[11px] text-slate-500">{row.label}</div>
                                  <div className="text-sm text-slate-100 mt-0.5 whitespace-pre-wrap break-words">
                                    {row.value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  ) : messages.length > 0 ? (
                    chatHistoryMessages.length > 0 ? (
                      <MessageList
                        messages={chatHistoryMessages}
                        onShowProfile={handleShowProfile}
                        onCommandSelect={handleCommandSelect}
                      />
                    ) : (
                      <div className="text-sm text-slate-400 leading-relaxed py-6 text-center px-2">
                        {prepHistoryFilter === 'general' ? (
                          ui('sidebarEmpty')
                        ) : (
                          <>
                            В «{INTERVIEW_PREP_MODE_LABELS[prepHistoryFilter]}» пока пусто.
                            <br />
                            <span className="text-slate-500 text-xs">
                              Нажмите кнопку режима на главном экране.
                            </span>
                          </>
                        )}
                      </div>
                    )
                  ) : connecting ? (
                    <div className="flex items-center justify-center py-8">
                      <Spin size="small" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <div className="text-slate-500 text-sm">{ui('sidebarEmpty')}</div>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>

          {/* Mobile: footer pinned at bottom; always visible on both tabs */}
          {productSelected && (
            <footer className="leo-chat-mobile-bottom flex shrink-0 flex-col gap-2 sm:gap-3 lg:flex lg:flex-row lg:items-end">
              <Form form={form} onFinish={handleSend} className="flex-1">
                <Form.Item
                  name="message"
                  rules={[{ required: true, message: ui('formMessageRequired') }]}
                  style={{ marginBottom: 0 }}
                >
                <div
                  className={`flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl px-2 sm:px-3 lg:px-4 py-2 sm:py-2.5 leo-chat-footer ${
                    isHume
                      ? 'border border-[rgba(34,34,34,0.12)] bg-[var(--color-paper)]'
                      : 'border border-white/10 bg-white/[0.04] backdrop-blur'
                  }`}
                >
                    <div className="flex items-center gap-1 sm:gap-2">
                      <div className="lg:hidden">
                        <SupportWidget placement="toolbar" showTeaser={false} />
                      </div>
                      <ChatHoverTooltip title={isMuted ? ui('muteOn') : ui('muteOff')}>
                        <Button
                          type="text"
                          size="small"
                          icon={isMuted ? <AudioMutedOutlined /> : <SoundOutlined />}
                          onClick={() => setSpeechEnabled(isMuted)}
                          className={
                            isHume
                              ? '!text-[var(--color-smoke)] hover:!text-[var(--color-ink)] hover:!bg-[var(--color-bone)] !p-1 sm:!p-2 !rounded-full'
                              : '!text-white !p-1 sm:!p-2'
                          }
                        />
                      </ChatHoverTooltip>
                      <ChatHoverTooltip title={isListening ? 'Остановить запись' : 'Начать запись голоса'}>
                        <Button
                          type="text"
                          size="small"
                          icon={<AudioOutlined style={{ color: isListening ? (isHume ? '#c094e4' : '#22c55e') : isHume ? 'var(--color-smoke)' : 'white' }} />}
                          onClick={toggleListening}
                          className={
                            isHume
                              ? `!p-1 sm:!p-2 !rounded-full ${
                                  isListening
                                    ? 'animate-pulse bg-[var(--color-rose-mist)]'
                                    : 'hover:!bg-[var(--color-bone)]'
                                }`
                              : `!p-1 sm:!p-2 ${isListening ? 'animate-pulse bg-green-500/20 rounded-full' : '!text-white'}`
                          }
                        />
                      </ChatHoverTooltip>
                    </div>
                    <div
                      className={`flex-1 min-w-0 chat-footer-input-wrap ${
                        isHume ? 'chat-footer-input-wrap--hume' : ''
                      }`}
                    >
                      <Input.TextArea
                        value={inputText}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setInputText(newValue);
                          form.setFieldsValue({ message: newValue });
                        }}
                        placeholder={
                          isSendingMessage
                            ? ui('inputSending')
                            : isListening
                              ? ui('inputListening')
                              : ui('inputPlaceholder')
                        }
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        disabled={!connected || isSendingMessage}
                        variant="borderless"
                        className="!bg-transparent"
                        onPressEnter={(e) => {
                          if (!e.shiftKey) {
                            e.preventDefault();
                            form.submit();
                          }
                        }}
                      />
                    </div>
                    <Button
                      type="primary"
                      size="small"
                      htmlType="submit"
                      icon={<SendOutlined aria-hidden />}
                      loading={isSendingMessage}
                      disabled={!connected || isSendingMessage}
                      aria-label={ui('send')}
                      className={
                        isHume
                          ? 'leo-chat-send-btn !inline-flex !h-9 !w-9 !min-w-[2.25rem] !items-center !justify-center !rounded-full !border-none !bg-[var(--color-ink)] !p-0 !text-[var(--color-paper)] hover:!opacity-90'
                          : 'flex items-center justify-center rounded-full border-none bg-green-500 px-2 sm:px-3 lg:px-4 py-1 sm:py-2 text-white shadow-lg hover:bg-green-400'
                      }
                    />
                  </div>
                </Form.Item>
              </Form>

            </footer>
          )}
        </div>
      </Content>
      <ProfileModal
        open={profileModalOpen}
        onClose={handleCloseProfileModal}
        profileData={profileData}
      />
      <VacancyPreviewDrawer
        open={vacancyPreview !== null}
        onClose={handleCloseVacancyPreview}
        context={vacancyPreviewContext}
        onVacancyPrep={handleVacancyPrepFromPreview}
        vacancyPrepLoading={
          vacancyPreview ? vacancyPrepJobId === vacancyPreview.item.job.id : false
        }
        sessionId={sessionId}
        isFavorite={
          vacancyPreview ? favoriteJobIds.has(vacancyPreview.item.job.id) : false
        }
        onToggleFavorite={
          vacancyPreview
            ? () => handleToggleVacancyFavorite(vacancyPreview.item.job.id)
            : undefined
        }
        favoriteAriaLabel={
          vacancyPreview && favoriteJobIds.has(vacancyPreview.item.job.id)
            ? v('removeFromFavorites')
            : v('addToFavorites')
        }
      />
      <Modal
        title={
          <div>
            <div
              className={
                isHume
                  ? 'hume-label-sm mb-1'
                  : 'text-xs uppercase tracking-[0.4em] text-green-300/70 mb-1'
              }
            >
              {ui('editProfile')}
            </div>
            <h2
              className={
                isHume
                  ? 'hume-heading !text-xl'
                  : 'text-xl font-semibold text-white'
              }
            >
              {ui('editProfileModal')}
            </h2>
          </div>
        }
        open={profileEditOpen}
        onCancel={handleCloseProfileEdit}
        onOk={() => {
          void handleSaveProfileEdit();
        }}
        okText={ui('save')}
        cancelText={ui('cancel')}
        okButtonProps={{ loading: profileEditSaving }}
        width={900}
        className={`profile-modal profile-edit-modal ${isHume ? 'profile-edit-modal--hume leo-hume-modal' : ''}`}
        styles={
          isHume
            ? {
                content: {
                  backgroundColor: '#ffffff',
                  border: '1px solid rgba(34, 34, 34, 0.08)',
                  maxHeight: '90vh',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                },
                body: {
                  maxHeight: 'calc(90vh - 100px)',
                  overflowY: 'auto',
                  padding: '24px',
                },
                header: {
                  backgroundColor: '#ffffff',
                  borderBottom: '1px solid rgba(34, 34, 34, 0.08)',
                },
              }
            : {
                content: {
                  backgroundColor: '#0a0f1e',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  maxHeight: '90vh',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                },
                body: {
                  maxHeight: 'calc(90vh - 100px)',
                  overflowY: 'auto',
                  padding: '24px',
                },
                header: {
                  backgroundColor: '#0a0f1e',
                  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
                },
              }
        }
      >
        <Form form={profileEditForm} layout="vertical">
          <div className="max-h-[55vh] overflow-y-auto pr-1">
            {profileEditableRows.map((row) => (
              <Form.Item key={row.key} name={row.key} label={`${row.section} - ${row.label}`}>
                <Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} />
              </Form.Item>
            ))}
          </div>
        </Form>
      </Modal>
      {!productSelected && <SupportWidget showTeaser={false} />}
      {productSelected && (
        <div className="hidden lg:block">
          <SupportWidget showTeaser />
        </div>
      )}
    </Layout>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050913] flex items-center justify-center">
          <Spin size="large" />
        </div>
      }
    >
      <ChatPageContent />
    </Suspense>
  );
}
