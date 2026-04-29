'use client';

import { useCallback, useEffect, useMemo, useRef, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
  Button,
  Form,
  Input,
  Layout,
  Spin,
  Typography,
  message as antdMessage,
  Modal,
  Tooltip,
} from 'antd';
import {
  CommandItem,
  CommandMessage,
  InfoCardMessage,
  Message,
  MessageRole,
  MessageType,
  MessageTypeValue,
  QuestionMessage,
} from '@/types/chat';
import { createChatApi, ChatApi } from '@/lib/chatApi';
import { getToken, isAuthenticated, removeToken } from '@/lib/auth';
import { jackCollectedDataReadyForJobMatch } from '@/lib/jackProfileGating';
import {
  formatCollectedValue,
  getJackProfileSidebarRows,
} from '@/lib/jackProfileFieldCatalog';
import { MessageList } from '@/components/chat/MessageList';
import { VoiceIndicator, type VoiceIndicatorMode } from '@/components/chat/VoiceIndicator';
import { StagePanel } from '@/components/chat/StagePanel';
import type { InterviewReportPreview } from '@/components/chat/InterviewReportCards';
import { TypingMessage } from '@/components/chat/TypingMessage';
import { ProfileModal } from '@/components/chat/ProfileModal';
import { ProductSelectionScreen, ProductType } from '@/components/chat/ProductSelectionScreen';
import {
  SoundOutlined,
  AudioMutedOutlined,
  SendOutlined,
  AudioOutlined,
  ReloadOutlined,
  QuestionCircleOutlined,
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
  };
  score: number;
  reasons?: string[];
};

type JobsLoadState = 'idle' | 'updating' | 'success' | 'error';

type SidePanelTab = 'chat' | 'vacancies' | 'profile';

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
  /** Предупреждение от API: 'catalog_family_mismatch' | 'no_matches' | 'empty_catalog' | null */
  catalogWarning?: 'catalog_family_mismatch' | 'no_matches' | 'empty_catalog' | null;
};

/** Сколько мс показывать бейдж «Новая» на карточке после появления в подборке */
const NEW_JOB_BADGE_MS = 18_000;

function ruPositionsLabel(count: number): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return `${count} позиций`;
  if (n1 === 1) return `${count} позиция`;
  if (n1 >= 2 && n1 <= 4) return `${count} позиции`;
  return `${count} позиций`;
}

function ruNewJobsLabel(count: number): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return 'новых';
  if (n1 === 1) return 'новая';
  if (n1 >= 2 && n1 <= 4) return 'новые';
  return 'новых';
}

function vacanciesEmptyExplanation(meta: JobsMatchMeta | null): string {
  if (!meta) {
    return 'Отвечайте в диалоге — подбор вакансий обновится автоматически.';
  }
  if (meta.jobsInDb === 0) {
    return 'В каталоге пока нет вакансий. После загрузки с hh.ru или SuperJob они появятся здесь.';
  }
  if (
    meta.totalMatched === 0 &&
    meta.weakTierTotal === 0 &&
    meta.maxMatchScore < meta.matchThreshold
  ) {
    return `В каталоге есть вакансии, но ни одна не доходит до порога «Рекомендуем» (${meta.matchThreshold}) и до блока «Слабое совпадение» (от ${meta.weakMatchFloor}). Уточните профиль в чате. Текущий лучший балл: ${meta.maxMatchScore}.`;
  }
  return 'Отвечайте в диалоге — подбор вакансий обновится автоматически.';
}

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

  if (message.type !== MessageType.QUESTION) {
    return false;
  }

  // Если сообщение уже есть в истории, повторно не анимируем
  return !existingMessages.some((existing) => existing.id === message.id);
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
  const [isMuted, setIsMuted] = useState(false);
  const [typingMessage, setTypingMessage] = useState<Message | null>(null);
  const [typingOptions, setTypingOptions] = useState<{ speed: number; delay: number }>({
    speed: 50,
    delay: 1200,
  });
  const [isTyping, setIsTyping] = useState(false);
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
  const assistantAudioCtxRef = useRef<AudioContext | null>(null);
  const assistantAudioAnalyserRef = useRef<AnalyserNode | null>(null);
  const assistantAudioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const assistantAudioTimeDataRef = useRef<Float32Array | null>(null);
  const assistantAudioRafRef = useRef(0);
  const assistantAudioByMessageIdRef = useRef<
    Map<string, { audioBase64: string; mimeType?: string; format?: 'mp3' | 'oggopus' }>
  >(new Map());
  const typingMessageIdRef = useRef<string | null>(null);
  const handledSpeechMessageIdsRef = useRef<Set<string>>(new Set());
  const enableBrowserTtsFallbackRef = useRef(
    process.env.NEXT_PUBLIC_ENABLE_BROWSER_TTS_FALLBACK !== 'false'
  );
  const lastSpokenTextRef = useRef<string>('');
  const lastSpokenAtRef = useRef<number>(0);
  const [isTtsSpeaking, setIsTtsSpeaking] = useState(false);
  useEffect(() => {
    typingMessageIdRef.current = typingMessage?.id ?? null;
  }, [typingMessage]);

  const [currentProduct, setCurrentProduct] = useState<ProductType>('jack');
  const [pendingStarterMessage, setPendingStarterMessage] = useState<string | null>(null);
  const autoStarterSentRef = useRef(false);
  const [productSelected, setProductSelected] = useState(false);
  const [isNewChatMode, setIsNewChatMode] = useState(false);
  const [matchedJobs, setMatchedJobs] = useState<MatchedJobItem[]>([]);
  const [weakMatchedJobs, setWeakMatchedJobs] = useState<MatchedJobItem[]>([]);
  const [isJobsLoading, setIsJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const [sidePanelTab, setSidePanelTab] = useState<SidePanelTab>('chat');
  const [jobsLoadState, setJobsLoadState] = useState<JobsLoadState>('idle');
  const [jobsLastUpdatedAt, setJobsLastUpdatedAt] = useState<string | null>(null);
  const [jobsMatchMeta, setJobsMatchMeta] = useState<JobsMatchMeta | null>(null);
  const [newJobsCount, setNewJobsCount] = useState(0);
  const previousJobIdsRef = useRef<Set<string>>(new Set());
  const autoRefreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundJobsPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatConnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestAutoTriggeredMessageIdRef = useRef<string | null>(null);
  const lastJobsFetchAtRef = useRef<number>(0);
  const [newJobBadgeIds, setNewJobBadgeIds] = useState<Set<string>>(() => new Set());
  const newBadgeClearTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [resumeImportLoading, setResumeImportLoading] = useState(false);
  const [resumeDraftLoading, setResumeDraftLoading] = useState(false);
  const [resumeEmailLoading, setResumeEmailLoading] = useState(false);
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

  const getJobMatchingBaseUrl = useCallback(() => {
    const explicit = process.env.NEXT_PUBLIC_JOB_MATCHING_URL?.trim();
    if (explicit) {
      return explicit.replace(/\/$/, '');
    }
    if (typeof window === 'undefined') {
      return 'http://localhost:3004';
    }
    const nextPublicApiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    if (nextPublicApiUrl.includes(':3001')) {
      return nextPublicApiUrl.replace(':3001', ':3004');
    }
    return 'http://localhost:3004';
  }, []);

  useEffect(() => {
    return () => {
      newBadgeClearTimeoutsRef.current.forEach(clearTimeout);
      newBadgeClearTimeoutsRef.current = [];
    };
  }, []);

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

  const speakFallback = useCallback(
    (text: string) => {
      if (typeof window === 'undefined' || isMuted || !text?.trim()) return;
      const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');
      const now = Date.now();
      if (normalized && normalized === lastSpokenTextRef.current && now - lastSpokenAtRef.current < 4500) {
        return;
      }
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
    [isMuted]
  );

  const playAssistantAudio = useCallback(
    async (payload: { audioBase64: string; mimeType?: string }) => {
      if (isMuted || !payload.audioBase64) return false;
      if (typeof window !== 'undefined') {
        // Prevent overlap with browser TTS fallback.
        window.speechSynthesis.cancel();
      }
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
    [ensureAssistantAudioChain, isMuted]
  );

  const waitForAssistantAudio = useCallback(
    (messageId: string, timeoutMs = 4000) =>
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
    async (message: QuestionMessage) => {
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

      if (payload) {
        assistantAudioByMessageIdRef.current.delete(messageId);
        const played = await playAssistantAudio(payload);
        if (!played && enableBrowserTtsFallbackRef.current) {
          speakFallback(message.question);
        } else if (played) {
          lastSpokenTextRef.current = message.question.trim().toLowerCase().replace(/\s+/g, ' ');
          lastSpokenAtRef.current = Date.now();
        }
        return;
      }

      if (enableBrowserTtsFallbackRef.current) {
        speakFallback(message.question);
      }
    },
    [playAssistantAudio, speakFallback, waitForAssistantAudio]
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

  // Function to initialize chat with a specific product
  const initializeChat = useCallback((product: ProductType, sessionIdParam?: string, isNew?: boolean) => {
    // Disconnect previous chat if exists
    if (chatRef.current) {
      chatRef.current.disconnect();
      chatRef.current = null;
      chatInitializedRef.current = false;
    }

    setConnecting(true);
    setError(null);
    setMessages([]);
    handledSpeechMessageIdsRef.current.clear();
    setSessionId(null);
    setCurrentProduct(product);
    autoStarterSentRef.current = false;
    setProductSelected(true);
    setMatchedJobs([]);
    setWeakMatchedJobs([]);
    setJobsMatchMeta(null);
    setNewJobsCount(0);
    setJobsLoadState('idle');
    setJobsLastUpdatedAt(null);
    setSidePanelTab('chat');
    previousJobIdsRef.current = new Set();

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
        token: getToken() ?? undefined,
        sessionId: sessionIdParam ?? undefined,
        createNew: isNew ?? true,
        product: isNew ? product : undefined,
        onConnected: () => {
          if (chatConnectTimeoutRef.current) {
            clearTimeout(chatConnectTimeoutRef.current);
            chatConnectTimeoutRef.current = null;
          }
          setConnected(true);
          setConnecting(false);
          setError(null);
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
          // Keep sessionId in URL to avoid re-triggering "new chat" mode
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
        },
        onMessage: (payload) => {
          if (
            profileModalOpenRef.current &&
            payload.message.type === MessageType.INFO_CARD &&
            (payload.message as InfoCardMessage).title === 'Ваш профиль'
          ) {
            setProfileData(payload.message as InfoCardMessage);
          }

          setMessages((prev) => {
            if (shouldAnimateMessage(payload.message, prev)) {
              setTypingMessage(payload.message);
              setTypingOptions({ speed: 50, delay: 700 });
              setIsTyping(true);

              if (payload.message.type === MessageType.QUESTION) {
                void speakQuestionWithPriority(payload.message as QuestionMessage);
              }

              return prev;
            }

            return appendMessage(prev, payload.message);
          });
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
            removeToken();
            openAuthModal('login');
            router.push('/');
          }
          messageApi.error(payload.message);
        },
        onAssistantAudio: (payload) => {
          assistantAudioByMessageIdRef.current.set(payload.messageId, payload);
        },
      });

      chatRef.current = chat;
      chat.connect();
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
  }, [messageApi, openAuthModal, playAssistantAudio, router, speakQuestionWithPriority]);

  useEffect(() => {
    if (!isAuthenticated()) {
      messageApi.warning('Авторизуйтесь, чтобы продолжить диалог с LEO.');
      openAuthModal('login');
      router.push('/');
      return;
    }

    const isNewChat = searchParams.get('new') === 'true';
    const requestedSessionId = isNewChat ? null : searchParams.get('sessionId');
    const requestedProduct = searchParams.get('product') as ProductType | null;

    // If it's a new chat without a pre-selected product, show product selection screen
    if (isNewChat && !requestedProduct) {
      setIsNewChatMode(true);
      setProductSelected(false);
      setConnecting(false);
      return;
    }

    // If resuming an existing session or product is pre-selected
    if (requestedSessionId || requestedProduct) {
      const product = requestedProduct || 'jack';
      initializeChat(product, requestedSessionId ?? undefined, isNewChat);
    } else {
      // Default: show product selection for new users
      setIsNewChatMode(true);
      setProductSelected(false);
      setConnecting(false);
    }

    return () => {
      if (chatConnectTimeoutRef.current) {
        clearTimeout(chatConnectTimeoutRef.current);
        chatConnectTimeoutRef.current = null;
      }
      chatRef.current?.disconnect();
      chatRef.current = null;
      chatInitializedRef.current = false;
    };
  }, [messageApi, router, searchParams, openAuthModal, initializeChat]);

  // Handler for product selection
  const handleProductScenarioSelect = useCallback((product: ProductType, starterMessage?: string) => {
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

    chatRef.current.sendMessage(pendingStarterMessage);
    autoStarterSentRef.current = true;
    setPendingStarterMessage(null);
  }, [connected, messages, pendingStarterMessage, sessionId]);

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
        const scenarioId =
          chatRef.current.metadata?.scenarioId ||
          (currentProduct === 'wannanew' ? 'wannanew-pm-v1' : 'jack-profile-v2');
        const { fields } = await extractProfileFromResumeText(extractedText, scenarioId);
        const imported = contentList
          ? { ...fields, __resumeContentList: contentList }
          : fields;
        await chatRef.current.mergeCollectedData(imported);
        messageApi.destroy('resume-import');
        messageApi.success('Данные из резюме добавлены в профиль диалога');
      } catch (err) {
        messageApi.destroy('resume-import');
        messageApi.error(err instanceof Error ? err.message : 'Не удалось обработать файл');
      } finally {
        setResumeImportLoading(false);
      }
    },
    [currentProduct, messageApi]
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
    router.push('/chat?new=true&product=wannanew');
  }, [router]);

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

  const handleSendResumeByEmail = useCallback(async () => {
    if (!chatRef.current) return;
    try {
      setResumeEmailLoading(true);
      messageApi.loading({ content: 'Отправляем резюме на почту...', key: 'resume-email', duration: 0 });
      const result = await chatRef.current.sendResumeEmail();
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

    chatRef.current.sendMessage(messageText);
    form.resetFields();
    setInputText('');
    finalTranscriptRef.current = '';
  };

  const handleCommandSelect = async (command: CommandItem) => {
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

    if (command.action === 'download_report') {
      await runReportDownload();
      return;
    }

    chatRef.current.executeCommand(command.id, command.action);
  };

  const latestQuestion = useMemo(
    () => extractLatest<QuestionMessage>(messages, MessageType.QUESTION),
    [messages]
  );

  const latestInfoCard = useMemo(
    () => extractLatest<InfoCardMessage>(messages, MessageType.INFO_CARD),
    [messages]
  );

  const latestCommand = useMemo(
    () => extractLatest<CommandMessage>(messages, MessageType.COMMAND),
    [messages]
  );

  /** Кнопки сценария (не показываем для экрана «Интервью завершено!» — там действия внутри карточек) */
  const stagePanelCommands = useMemo(() => {
    if (currentProduct === 'wannanew' && latestInfoCard?.title === 'Интервью завершено!') {
      return undefined;
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
    if (currentProduct !== 'wannanew') {
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

  /** Блок загрузки резюме под вопросом (шаг «резюме / опыт»), не в строке ввода */
  const showResumeUploadInQuestion = useMemo(() => {
    if (!connected) return false;
    const q = latestQuestion;
    if (!q) return false;
    const t = `${q.question} ${q.placeholder || ''}`.toLowerCase();
    if (currentProduct === 'wannanew') {
      return /резюме|pdf|docx/.test(t);
    }
    return /резюме|pdf|docx|cv\b/.test(t);
  }, [connected, latestQuestion, currentProduct]);

  const latestUserMessageId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      if (messages[i].role === MessageRole.USER) {
        return messages[i].id;
      }
    }
    return null;
  }, [messages]);

  const jackCollectedSnapshot = useMemo((): Record<string, unknown> => {
    const raw = chatRef.current?.metadata?.collectedData;
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      return { ...(raw as Record<string, unknown>) };
    }
    return {};
  }, [messages.length, sessionId, connected, sidePanelTab]);

  const jackProfileRows = useMemo(
    () =>
      currentProduct === 'jack' ? getJackProfileSidebarRows(jackCollectedSnapshot) : [],
    [currentProduct, jackCollectedSnapshot]
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
  }, [handleCloseProfileEdit, messageApi, profileEditForm, profileEditableRows]);

  const fetchMatchedJobs = useCallback(async (options?: { revealPanel?: boolean; silent?: boolean }) => {
    const token = getToken();
    if (!token) {
      if (!options?.silent) {
        messageApi.warning('Нужна авторизация для подбора вакансий');
      }
      return;
    }

    const userId = getUserIdFromToken(token);
    if (!userId) {
      if (!options?.silent) {
        messageApi.error('Не удалось определить пользователя. Перезайдите в аккаунт.');
      }
      return;
    }

    setIsJobsLoading(true);
    setJobsError(null);
    setJobsLoadState('updating');
    if (options?.revealPanel) {
      setSidePanelTab('vacancies');
    }
    lastJobsFetchAtRef.current = Date.now();

    try {
      const response = await fetch(`${getJobMatchingBaseUrl()}/api/jobs/match/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || `HTTP ${response.status}`);
      }

      const jobs = Array.isArray(data?.jobs) ? (data.jobs as MatchedJobItem[]) : [];
      const weakJobs = Array.isArray(data?.weakJobs) ? (data.weakJobs as MatchedJobItem[]) : [];
      setMatchedJobs(jobs);
      setWeakMatchedJobs(weakJobs);
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
        catalogWarning,
      });

      const previousIds = previousJobIdsRef.current;
      const incomingIds = new Set<string>();
      for (const item of jobs) incomingIds.add(item.job.id);
      for (const item of weakJobs) incomingIds.add(item.job.id);
      const newIds = Array.from(incomingIds).filter((id) => !previousIds.has(id));
      setNewJobsCount(newIds.length);
      previousJobIdsRef.current = incomingIds;

      if (previousIds.size > 0 && newIds.length > 0) {
        setNewJobBadgeIds((prev) => {
          const next = new Set(prev);
          for (const id of newIds) {
            next.add(id);
          }
          return next;
        });
        for (const id of newIds) {
          const timeoutId = setTimeout(() => {
            setNewJobBadgeIds((prev) => {
              const next = new Set(prev);
              next.delete(id);
              return next;
            });
          }, NEW_JOB_BADGE_MS);
          newBadgeClearTimeoutsRef.current.push(timeoutId);
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
      const messageText =
        error instanceof Error ? error.message : 'Не удалось получить вакансии';
      setJobsError(messageText);
      setJobsLoadState('error');
      if (!options?.silent) {
        messageApi.error(messageText);
      }
    } finally {
      setIsJobsLoading(false);
    }
  }, [getJobMatchingBaseUrl, getUserIdFromToken, messageApi]);

  /**
   * Кнопка reload теперь делает «умное обновление»:
   * 1) ставит в очередь сбор свежих вакансий под профиль пользователя;
   * 2) фоном перезапрашивает match через задержку, когда каталог успеет обновиться.
   */
  const requestFreshJobsForProfile = useCallback(async () => {
    const token = getToken();
    if (!token) {
      messageApi.warning('Нужна авторизация');
      return;
    }
    const userId = getUserIdFromToken(token);
    if (!userId) {
      messageApi.error('Не удалось определить пользователя. Перезайдите в аккаунт.');
      return;
    }
    try {
      setIsJobsLoading(true);
      const response = await fetch(
        `${getJobMatchingBaseUrl()}/api/jobs/scrape/for-user/${userId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
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
          ? `Собираем вакансии под ваш профиль (${data.familyPrimary || 'профиль'}). Обновлю через ~20 сек.`
          : 'Профиль пока слишком лаконичный — запустил общий сбор. Заполните желаемую должность в чате для точного подбора.'
      );

      // Ждём 20 секунд и фоном перезапрашиваем подбор.
      setTimeout(() => {
        void fetchMatchedJobs({ revealPanel: false, silent: true });
      }, 20_000);
    } catch (error) {
      messageApi.error(
        error instanceof Error
          ? error.message
          : 'Не удалось запустить сбор свежих вакансий'
      );
    } finally {
      setIsJobsLoading(false);
    }
  }, [fetchMatchedJobs, getJobMatchingBaseUrl, getUserIdFromToken, messageApi]);

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
      const collected = chatRef.current?.metadata?.collectedData as
        | Record<string, unknown>
        | undefined;
      if (!jackCollectedDataReadyForJobMatch(collected)) {
        return;
      }
      void fetchMatchedJobs({ revealPanel: false, silent: true });
    }, 1800);

    return () => {
      if (autoRefreshTimeoutRef.current) {
        clearTimeout(autoRefreshTimeoutRef.current);
      }
    };
  }, [connected, currentProduct, fetchMatchedJobs, latestUserMessageId, productSelected]);

  /** Первая загрузка метаданных каталога при открытии вкладки — без гейтинга по анкете (бэкенд всё равно отдаёт jobsInDb). */
  useEffect(() => {
    if (sidePanelTab !== 'vacancies' || isJobsLoading || currentProduct !== 'jack') {
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
    jobsLoadState,
    jobsMatchMeta,
    sidePanelTab,
  ]);

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
      const now = Date.now();
      if (now - lastJobsFetchAtRef.current < 15_000) return;
      const collected = chatRef.current?.metadata?.collectedData as
        | Record<string, unknown>
        | undefined;
      if (!jackCollectedDataReadyForJobMatch(collected)) return;
      void fetchMatchedJobs({ revealPanel: false, silent: true });
    }, 30_000);

    return () => {
      if (backgroundJobsPollingRef.current) {
        clearInterval(backgroundJobsPollingRef.current);
        backgroundJobsPollingRef.current = null;
      }
    };
  }, [currentProduct, fetchMatchedJobs, isJobsLoading, sidePanelTab]);

  useEffect(() => {
    if (currentProduct === 'wannanew' && sidePanelTab === 'vacancies') {
      setSidePanelTab('chat');
    }
  }, [currentProduct, sidePanelTab]);

  const sidePanelTabs = useMemo((): { id: SidePanelTab; label: string }[] => {
    if (currentProduct === 'wannanew') {
      return [
        { id: 'chat', label: 'Чат' },
        { id: 'profile', label: 'Профиль' },
      ];
    }
    return [
      { id: 'chat', label: 'Чат' },
      { id: 'vacancies', label: 'Вакансии' },
      { id: 'profile', label: 'Профиль' },
    ];
  }, [currentProduct]);

  const handleLogout = () => {
    Modal.confirm({
      title: 'Выход из аккаунта',
      content: 'Вы уверены, что хотите выйти?',
      okText: 'Выйти',
      cancelText: 'Отмена',
      okButtonProps: { danger: true },
      onOk: () => {
        // Remove token
        removeToken();
        // Disconnect chat
        chatRef.current?.disconnect();
        // Redirect to home
        router.push('/');
        messageApi.success('Вы успешно вышли из аккаунта');
      },
    });
  };

  return (
    <Layout className="min-h-screen bg-[#050913] text-white">
      {contextHolder}
      <Content className="flex flex-col h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="flex h-full w-full max-w-[1400px] mx-auto flex-col gap-3 sm:gap-4 lg:gap-5 overflow-hidden">
          <header className="flex-shrink-0 flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Title
                level={2}
                style={{ color: 'white', marginBottom: 0 }}
                className="text-lg sm:text-xl lg:text-2xl"
              >
                {!productSelected && isNewChatMode
                  ? 'Новый чат'
                  : currentProduct === 'wannanew'
                    ? 'Чат с LEO'
                    : 'Чат с LEO'}
              </Title>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Link href="/chats">
                <Button type="text" size="small" className="!text-slate-200 text-xs sm:text-sm">
                  <span className="hidden sm:inline">Мои чаты</span>
                  <span className="sm:hidden">Чаты</span>
                </Button>
              </Link>
              <Tooltip title="Выйти из аккаунта">
                <Button
                  type="text"
                  size="small"
                  onClick={handleLogout}
                  className="!text-slate-200 hover:!text-red-400 text-xs sm:text-sm"
                >
                  Выйти
                </Button>
              </Tooltip>
            </div>
          </header>

          <div className={`grid gap-3 sm:gap-4 lg:gap-5 h-full overflow-hidden min-h-0 ${
            !productSelected && isNewChatMode
              ? 'grid-cols-1'
              : 'grid-cols-1 lg:grid-cols-[1fr_minmax(320px,380px)]'
          }`}>
            <section className="flex flex-col gap-3 sm:gap-4 lg:gap-5 rounded-2xl sm:rounded-3xl border border-white/10 bg-white/[0.04] p-3 sm:p-4 lg:p-5 backdrop-blur overflow-auto min-h-0">
              {/* Show product selection screen for new chats */}
              {!productSelected && isNewChatMode ? (
                <div className="flex-1 flex items-center justify-center">
                  <ProductSelectionScreen onSelect={handleProductScenarioSelect} />
                </div>
              ) : (
                <>
                  <div className="flex-shrink-0">
                    <VoiceIndicator
                      isActive={(connected && !isMuted) || isListening}
                      isMuted={isMuted && !isListening}
                      mode={voiceMode}
                      ttsBeatAtRef={ttsBeatAtRef}
                      assistantLevelRef={assistantVoiceLevelRef}
                      waveOnly
                    />
                  </div>

                  <div className="flex-1 overflow-auto flex items-start justify-center min-h-0 py-2 sm:py-3">
                    {connecting ? (
                      <div className="flex flex-col items-center justify-center gap-4">
                        <Spin size="large" />
                        <Text style={{ color: 'rgba(226, 232, 240, 0.85)' }}>
                          {currentProduct === 'wannanew' ? 'Подключаемся к Leo...' : 'Подключаемся к LEO...'}
                        </Text>
                      </div>
                    ) : isTyping && typingMessage ? (
                      <div className="flex flex-col items-start justify-center w-full">
                        <TypingMessage
                          message={typingMessage}
                          typingSpeed={typingOptions.speed}
                          delay={typingOptions.delay}
                          onComplete={handleTypingComplete}
                        />
                      </div>
                    ) : (
                      <div className="w-full flex items-start justify-center overflow-auto">
                        <StagePanel
                          question={latestQuestion}
                          infoCard={latestInfoCard}
                          commands={stagePanelCommands}
                          onCommandSelect={handleCommandSelect}
                          onContinue={() => {
                            if (chatRef.current) {
                              chatRef.current.sendMessage('продолжить');
                            }
                          }}
                          interviewReport={
                            currentProduct === 'wannanew' &&
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
                                  onGenerateResume: handleGenerateResumeDraft,
                                  onSendResumeEmail: handleSendResumeByEmail,
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
              <aside className="flex flex-col rounded-2xl sm:rounded-3xl border border-white/10 bg-white/[0.04] p-4 sm:p-5 backdrop-blur w-full overflow-hidden">
                <div className="mb-3 sm:mb-4 flex flex-shrink-0 flex-col">
                  <div
                    role="tablist"
                    aria-label="Разделы боковой панели"
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
                              ? '!h-8 !min-w-0 !flex-1 !basis-0 !rounded-full !border-none !bg-green-500 !px-2 !text-xs !font-medium !text-white !shadow-lg hover:!bg-green-400'
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
                          <span>Подобранные вакансии</span>
                          <Tooltip
                            trigger={['click']}
                            placement="topLeft"
                            title="Мы сопоставляем ваши ответы из чата с вакансиями в каталоге: учитываем роль, стек, уровень, формат и опыт. Чем больше релевантных деталей в профиле, тем точнее рекомендации."
                          >
                            <Button
                              type="text"
                              size="small"
                              icon={<QuestionCircleOutlined />}
                              className="!h-5 !w-5 !min-w-0 !p-0 !text-slate-400 hover:!text-slate-200"
                              aria-label="Как формируется подбор вакансий"
                            />
                          </Tooltip>
                        </div>
                        {matchedJobs.length > 0 ||
                        weakMatchedJobs.length > 0 ||
                        newJobsCount > 0 ? (
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                            {matchedJobs.length > 0 || weakMatchedJobs.length > 0 ? (
                              <span>
                                {[
                                  matchedJobs.length > 0
                                    ? `${ruPositionsLabel(matchedJobs.length)} в «Рекомендуем»`
                                    : null,
                                  weakMatchedJobs.length > 0
                                    ? `${weakMatchedJobs.length} со слабым совпадением`
                                    : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </span>
                            ) : null}
                            {newJobsCount > 0 ? (
                              <>
                                {matchedJobs.length > 0 || weakMatchedJobs.length > 0 ? (
                                  <span className="text-slate-600" aria-hidden>
                                    ·
                                  </span>
                                ) : null}
                                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                                  +{newJobsCount} {ruNewJobsLabel(newJobsCount)}
                                </span>
                              </>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    ) : sidePanelTab === 'profile' ? (
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-100 leading-snug">Профиль</div>
                        {currentProduct === 'jack' ? (
                          <Button
                            type="text"
                            size="small"
                            className="!h-6 !rounded-full !px-2 !text-[11px] !font-medium !text-slate-300 hover:!text-slate-100 hover:!bg-white/[0.06]"
                            onClick={handleOpenProfileEdit}
                            disabled={!connected || profileEditableRows.length === 0}
                          >
                            Редактировать
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-sm font-semibold text-slate-100 leading-snug">История диалога</div>
                    )}
                  </div>
                </div>
                <div className="custom-scrollbar overflow-y-auto flex-1 pr-2">
                  {sidePanelTab === 'vacancies' ? (
                    currentProduct !== 'jack' ? (
                      <div className="text-sm text-slate-400">
                        Для продукта wannanew вакансии не подбираются.
                      </div>
                    ) : (
                      <>
                        <div className="mb-3 flex flex-col gap-1.5">
                          <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                            <span className="min-w-0 leading-relaxed">
                              {jobsLoadState === 'updating'
                                ? 'Обновляем подбор...'
                                : jobsLoadState === 'error'
                                  ? 'Ошибка обновления, попробуйте ещё раз.'
                                  : jobsLastUpdatedAt
                                    ? `Подбор пересчитан в ${jobsLastUpdatedAt}`
                                    : 'Подбор пока не запускался'}
                            </span>
                            {currentProduct === 'jack' ? (
                              <div className="flex shrink-0 items-center gap-1">
                                <Tooltip
                                  title="Обновить подбор: запускает сбор свежих вакансий под ваш профиль и фоном пересчитывает совпадения в каталоге."
                                >
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<ReloadOutlined />}
                                    loading={isJobsLoading}
                                    onClick={() => {
                                      void requestFreshJobsForProfile();
                                    }}
                                    className="!shrink-0 !text-slate-400 hover:!text-slate-200"
                                    aria-label="Обновить подбор под профиль"
                                  />
                                </Tooltip>
                              </div>
                            ) : null}
                          </div>
                          {jobsMatchMeta && jobsLoadState === 'success' ? (
                            <div className="text-[11px] leading-snug text-slate-500">
                              В каталоге: {jobsMatchMeta.jobsInDb} вакансий
                              {jobsMatchMeta.jobsScanned < jobsMatchMeta.jobsInDb
                                ? ` (для матча смотрим последние ${jobsMatchMeta.jobsScanned})`
                                : ''}
                              {jobsMatchMeta.profileFamilyLabel
                                ? ` · профиль: ${jobsMatchMeta.profileFamilyLabel}`
                                : ''}
                              .
                            </div>
                          ) : null}
                          {jobsMatchMeta?.catalogWarning === 'catalog_family_mismatch' ? (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] leading-snug text-amber-100">
                              В текущем каталоге мало вакансий
                              {jobsMatchMeta.profileFamilyLabel
                                ? ` из области «${jobsMatchMeta.profileFamilyLabel}»`
                                : ''}
                              {typeof jobsMatchMeta.familyRelevanceShare === 'number'
                                ? ` (релевантных только ${Math.round(
                                    jobsMatchMeta.familyRelevanceShare * 100
                                  )}%).`
                                : '.'}{' '}
                              Нажмите <span className="font-semibold">кнопку обновления ↻</span>, чтобы скачать свежие объявления именно под ваш профиль.
                            </div>
                          ) : null}
                          {jobsMatchMeta?.catalogWarning === 'empty_catalog' ? (
                            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-[12px] leading-snug text-amber-100">
                              Каталог ещё пустой. Нажмите кнопку обновления ↻, чтобы запустить сбор под ваш профиль.
                            </div>
                          ) : null}
                        </div>
                        {isJobsLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <Spin size="small" />
                      </div>
                    ) : jobsError ? (
                      <div className="text-sm text-red-300">{jobsError}</div>
                    ) : matchedJobs.length > 0 || weakMatchedJobs.length > 0 ? (
                      <div className="space-y-6">
                        {matchedJobs.length > 0 ? (
                          <div className="space-y-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-emerald-400/90">
                              Рекомендуем
                            </div>
                            {matchedJobs.map((item) => (
                              <div
                                key={item.job.id}
                                className={`rounded-xl border bg-white/[0.03] p-3 ${
                                  newJobBadgeIds.has(item.job.id)
                                    ? 'border-emerald-400/55 ring-1 ring-emerald-400/25 shadow-[0_0_20px_rgba(52,211,153,0.12)]'
                                    : 'border-white/10'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-sm font-semibold text-white">{item.job.title}</div>
                                  {newJobBadgeIds.has(item.job.id) ? (
                                    <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                                      Новая
                                    </span>
                                  ) : null}
                                </div>
                                <div className="mt-1 text-xs text-slate-300">{item.job.company}</div>
                                <div className="mt-2 text-xs text-slate-400">
                                  Источник: {item.job.source || 'unknown'} | Match: {item.score}
                                </div>
                                {item.job.source_url ? (
                                  <a
                                    href={item.job.source_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-block text-xs text-green-400 hover:text-green-300"
                                  >
                                    Открыть вакансию
                                  </a>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        {weakMatchedJobs.length > 0 ? (
                          <div className="space-y-3">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-amber-400/90">
                              Слабое совпадение
                            </div>
                            {weakMatchedJobs.map((item) => (
                              <div
                                key={item.job.id}
                                className={`rounded-xl border bg-white/[0.02] p-3 ${
                                  newJobBadgeIds.has(item.job.id)
                                    ? 'border-amber-400/45 ring-1 ring-amber-400/20'
                                    : 'border-amber-900/40'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="text-sm font-semibold text-white">{item.job.title}</div>
                                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                                    {newJobBadgeIds.has(item.job.id) ? (
                                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                                        Новая
                                      </span>
                                    ) : null}
                                    <span className="text-[10px] font-medium text-amber-500/80">
                                      слабее
                                    </span>
                                  </div>
                                </div>
                                <div className="mt-1 text-xs text-slate-300">{item.job.company}</div>
                                <div className="mt-2 text-xs text-slate-400">
                                  Источник: {item.job.source || 'unknown'} | Match: {item.score}
                                </div>
                                {item.job.source_url ? (
                                  <a
                                    href={item.job.source_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="mt-2 inline-block text-xs text-amber-400/90 hover:text-amber-300"
                                  >
                                    Открыть вакансию
                                  </a>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="text-sm text-slate-400 leading-relaxed">
                        {vacanciesEmptyExplanation(jobsMatchMeta)}
                      </div>
                    )}
                      </>
                    )
                  ) : sidePanelTab === 'profile' ? (
                    currentProduct !== 'jack' ? (
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
                                  {formatCollectedValue(jackCollectedSnapshot[key])}
                                </div>
                              </div>
                            ))
                        )}
                      </div>
                    ) : !jackProfileVisibleRows.some((r) => r.filled) ? (
                      <div className="text-sm text-slate-400 leading-relaxed">
                        Пока нет сохранённых ответов — продолжайте диалог слева: поля появятся здесь по мере
                        заполнения анкеты.
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
                    <MessageList
                      messages={messages}
                      onShowProfile={handleShowProfile}
                      onCommandSelect={handleCommandSelect}
                    />
                  ) : connecting ? (
                    <div className="flex items-center justify-center py-8">
                      <Spin size="small" />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center py-12">
                      <div className="text-slate-500 text-sm">Сообщения появятся здесь по мере диалога</div>
                    </div>
                  )}
                </div>
              </aside>
            )}
          </div>

          {/* Hide footer when in product selection mode */}
          {productSelected && (
            <footer className="flex-shrink-0 flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-end">
              <Form form={form} onFinish={handleSend} className="flex-1">
                <Form.Item
                  name="message"
                  rules={[{ required: true, message: 'Введите сообщение LEO' }]}
                  style={{ marginBottom: 0 }}
                >
                  <div className="flex items-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border border-white/10 bg-white/[0.04] px-2 sm:px-3 lg:px-4 py-2 sm:py-3 backdrop-blur">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <Tooltip title={isMuted ? 'Включить звук' : 'Выключить звук'}>
                        <Button
                          type="text"
                          size="small"
                          icon={isMuted ? <AudioMutedOutlined /> : <SoundOutlined />}
                          onClick={() => setIsMuted((prev) => !prev)}
                          className="!text-white !p-1 sm:!p-2"
                        />
                      </Tooltip>
                      <Tooltip title={isListening ? 'Остановить запись' : 'Начать запись голоса'}>
                        <Button
                          type="text"
                          size="small"
                          icon={<AudioOutlined style={{ color: isListening ? '#22c55e' : 'white' }} />}
                          onClick={toggleListening}
                          className={`!p-1 sm:!p-2 ${isListening ? 'animate-pulse bg-green-500/20 rounded-full' : '!text-white'}`}
                        />
                      </Tooltip>
                    </div>
                    <div className="flex-1 min-w-0 chat-footer-input-wrap">
                      <Input.TextArea
                        value={inputText}
                        onChange={(e) => {
                          const newValue = e.target.value;
                          setInputText(newValue);
                          form.setFieldsValue({ message: newValue });
                        }}
                        placeholder={
                          isListening
                            ? 'Слушаю...'
                            : 'Введите ответ…'
                        }
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        disabled={!connected}
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
                      icon={<SendOutlined />}
                      disabled={!connected}
                      className="flex items-center justify-center rounded-full border-none bg-green-500 px-2 sm:px-3 lg:px-4 py-1 sm:py-2 text-white shadow-lg hover:bg-green-400"
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
      <Modal
        title={
          <div>
            <div className="text-xs uppercase tracking-[0.4em] text-green-300/70 mb-1">Профиль</div>
            <h2 className="text-xl font-semibold text-white">Редактировать профиль</h2>
          </div>
        }
        open={profileEditOpen}
        onCancel={handleCloseProfileEdit}
        onOk={() => {
          void handleSaveProfileEdit();
        }}
        okText="Сохранить"
        cancelText="Отмена"
        okButtonProps={{ loading: profileEditSaving }}
        width={900}
        className="profile-modal profile-edit-modal"
        styles={{
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
        }}
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
