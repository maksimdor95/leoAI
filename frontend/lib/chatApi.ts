/**
 * REST-based Chat API Client
 * Fallback when WebSocket is unavailable (e.g. restrictive proxies).
 */

import { getToken } from '@/lib/auth';
import { Message, type ProfileSummary } from '@/types/chat';
import type { ClientPreferences, TtsPreferences } from '@/lib/ttsVoices';
import { getPublicConversationBaseUrl } from './publicApiBaseUrl';

const getApiUrl = () => getPublicConversationBaseUrl();

type ProductType = 'jack' | 'wannanew' | 'interview-prep';

interface SessionMetadata {
  product?: ProductType;
  scenarioId?: string;
  status?: string;
  collectedData?: Record<string, unknown>;
  [key: string]: unknown;
}

interface AssistantAudioPayload {
  messageId?: string;
  audioBase64: string;
  mimeType?: string;
  format?: 'mp3' | 'oggopus';
}

interface ChatSession {
  sessionId: string;
  messages: Message[];
  metadata: SessionMetadata;
  assistantAudio?: AssistantAudioPayload | null;
}

interface SendMessageResponse extends ChatSession {
  userMessage: Message;
  assistantMessage: Message | null;
  assistantAudio?: AssistantAudioPayload | null;
}

interface MergeCollectedResponse extends ChatSession {
  assistantMessage: Message | null;
  assistantAudio?: AssistantAudioPayload | null;
}

interface GenerateResumeResponse extends ChatSession {
  resume: string;
  format: 'markdown' | 'text' | 'json';
  assistantMessage: Message | null;
  downloadCommand?: Message | null;
  assistantAudio?: AssistantAudioPayload | null;
}

interface GenerateSummaryResponse extends ChatSession {
  summary: ProfileSummary;
  status: string;
  assistantMessage: Message | null;
  downloadCommand?: Message | null;
  assistantAudio?: AssistantAudioPayload | null;
}

interface SendResumeEmailResponse extends ChatSession {
  success: boolean;
  email: string;
  assistantMessage: Message | null;
  assistantAudio?: AssistantAudioPayload | null;
}

export type ChatMessageDelivery = {
  message: Message;
  skipAnimation?: boolean;
};

export type { TtsPreferences };

class ChatApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private sessionId: string | null = null;
  private sessionMetadata: SessionMetadata | null = null;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  /** Invalidates in-flight poll ticks when polling restarts or client disconnects. */
  private pollingGeneration = 0;
  private lastMessageCount = 0;
  private requestTimeoutMs = Number(process.env.NEXT_PUBLIC_CHAT_REQUEST_TIMEOUT_MS || 20000);
  private getClientPreferences?: () => ClientPreferences | undefined;

  // Event callbacks
  public onSessionJoined?: (sessionId: string, metadata?: SessionMetadata) => void;
  public onHistory?: (messages: Message[]) => void;
  public onMessage?: (payload: ChatMessageDelivery) => void;
  public onError?: (error: { message: string }) => void;
  public onSendStateChange?: (state: 'sending' | 'idle') => void;
  public onConnected?: () => void;
  public onDisconnected?: () => void;
  public onAssistantAudio?: (payload: {
    messageId: string;
    audioBase64: string;
    mimeType?: string;
    format?: 'mp3' | 'oggopus';
  }) => void;
  public onMetadataChange?: (metadata: SessionMetadata | null) => void;

  constructor(baseUrl?: string, getClientPreferences?: () => ClientPreferences | undefined) {
    this.baseUrl = baseUrl || getApiUrl();
    this.getClientPreferences = getClientPreferences;
  }

  private buildClientPreferencesBody(): { locale?: string; ttsPreferences?: TtsPreferences } {
    const prefs = this.getClientPreferences?.();
    if (!prefs) return {};
    return {
      locale: prefs.locale,
      ttsPreferences: { lang: prefs.lang, voice: prefs.voice },
    };
  }

  private emitAssistantAudio(
    audio: AssistantAudioPayload | null | undefined,
    fallbackMessage: Message | null | undefined
  ): void {
    if (!audio?.audioBase64) return;
    const messageId = audio.messageId ?? fallbackMessage?.id;
    if (!messageId) return;
    this.onAssistantAudio?.({
      messageId,
      audioBase64: audio.audioBase64,
      mimeType: audio.mimeType,
      format: audio.format,
    });
  }

  private applySessionMetadata(metadata: SessionMetadata | null | undefined): void {
    if (!metadata) return;
    this.sessionMetadata = metadata;
    this.onMetadataChange?.(metadata);
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    timeoutMs?: number
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      timeoutMs ?? this.requestTimeoutMs
    );
    const url = `${this.baseUrl}${endpoint}`;
    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        signal: controller.signal,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });
    } catch (error: unknown) {
      if (
        error instanceof DOMException ||
        (error instanceof Error && error.name === 'AbortError')
      ) {
        throw new Error('Превышено время ожидания ответа сервера');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    try {
      return await response.json();
    } catch {
      throw new Error('Некорректный JSON-ответ от сервера');
    }
  }

  /**
   * Initialize chat session
   */
  async connect(
    options: {
      token?: string;
      sessionId?: string;
      createNew?: boolean;
      product?: ProductType;
      intent?: 'vacancy_analyze';
    } = {}
  ): Promise<void> {
    this.token = options.token ?? getToken() ?? null;

    try {
      const session = await this.request<ChatSession>('/api/chat/session', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: options.sessionId,
          createNew: options.createNew,
          product: options.product,
          intent: options.intent,
          ...this.buildClientPreferencesBody(),
        }),
      });

      this.sessionId = session.sessionId;
      this.sessionMetadata = session.metadata;
      this.lastMessageCount = session.messages.length;

      this.onConnected?.();
      this.onSessionJoined?.(session.sessionId, session.metadata);

      if (session.assistantAudio?.audioBase64) {
        const audioTarget =
          (session.assistantAudio.messageId &&
            session.messages.find((msg) => msg.id === session.assistantAudio?.messageId)) ||
          [...session.messages].reverse().find((msg) => msg.role === 'assistant');
        this.emitAssistantAudio(session.assistantAudio, audioTarget ?? null);
      }

      if (session.messages.length > 0) {
        this.onHistory?.(session.messages);
      }

      // Start polling for new messages
      this.startPolling();
    } catch (error) {
      this.onError?.({
        message: error instanceof Error ? error.message : 'Connection failed',
      });
    }
  }

  /**
   * Disconnect and stop polling
   */
  disconnect(): void {
    this.stopPolling();
    this.sessionId = null;
    this.sessionMetadata = null;
    this.onDisconnected?.();
  }

  /**
   * Send a message
   */
  async sendMessage(content: string): Promise<void> {
    if (!this.sessionId) {
      this.onError?.({ message: 'Сессия не инициализирована' });
      return;
    }

    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    this.onSendStateChange?.('sending');
    try {
      const isInterviewPrep = this.sessionMetadata?.product === 'interview-prep';
      const timeoutMs = isInterviewPrep
        ? Number(process.env.NEXT_PUBLIC_CHAT_INTERVIEW_TIMEOUT_MS || 90000)
        : undefined;

      const response = await this.request<SendMessageResponse>(
        `/api/chat/session/${this.sessionId}/message`,
        {
          method: 'POST',
          body: JSON.stringify({ content: trimmed, ...this.buildClientPreferencesBody() }),
        },
        timeoutMs
      );

      if (response.metadata) {
        this.applySessionMetadata(response.metadata);
      }

      // Emit user message
      if (response.userMessage) {
        this.onMessage?.({ message: response.userMessage, skipAnimation: true });
      }

      // Emit assistant message
      if (response.assistantMessage) {
        this.emitAssistantAudio(response.assistantAudio, response.assistantMessage);
        this.onMessage?.({ message: response.assistantMessage });
      }

      this.lastMessageCount = response.messages.length;
    } catch (error) {
      const isAbort = error instanceof Error && error.message.includes('время ожидания');
      this.onError?.({
        message: isAbort
          ? 'LEO долго обрабатывает ответ. Подождите или попробуйте ещё раз.'
          : error instanceof Error
            ? error.message
            : 'Failed to send message',
      });
    } finally {
      this.onSendStateChange?.('idle');
    }
  }

  /**
   * Разбор вакансии из подбора Jack — длинный AI-запрос, короткая подпись в истории.
   */
  async analyzeVacancy(vacancyText: string, displayLabel: string): Promise<void> {
    if (!this.sessionId) {
      this.onError?.({ message: 'Сессия не инициализирована' });
      return;
    }

    const trimmedText = vacancyText.trim();
    const trimmedLabel = displayLabel.trim();
    if (!trimmedText || !trimmedLabel) {
      return;
    }

    const analyzeTimeoutMs = Number(
      process.env.NEXT_PUBLIC_CHAT_ANALYZE_TIMEOUT_MS || 120000
    );

    try {
      const response = await this.request<SendMessageResponse>(
        `/api/chat/session/${this.sessionId}/analyze-vacancy`,
        {
          method: 'POST',
          body: JSON.stringify({
            vacancyText: trimmedText,
            displayLabel: trimmedLabel,
            ...this.buildClientPreferencesBody(),
          }),
        },
        analyzeTimeoutMs
      );

      if (response.metadata) {
        this.applySessionMetadata(response.metadata);
      }

      if (response.userMessage) {
        this.onMessage?.({ message: response.userMessage, skipAnimation: true });
      }

      if (response.assistantMessage) {
        this.emitAssistantAudio(response.assistantAudio, response.assistantMessage);
        this.onMessage?.({ message: response.assistantMessage });
      }

      this.lastMessageCount = response.messages.length;
    } catch (error) {
      this.onError?.({
        message: error instanceof Error ? error.message : 'Не удалось разобрать вакансию',
      });
    }
  }

  /**
   * Объединить импортированные поля профиля (после загрузки резюме) и получить следующий шаг диалога.
   */
  async mergeCollectedData(collectedData: Record<string, unknown>): Promise<void> {
    if (!this.sessionId) {
      this.onError?.({ message: 'Сессия не инициализирована' });
      return;
    }

    try {
      const isFeedbackOnly =
        Object.keys(collectedData).length === 1 && collectedData.vacancyFeedback != null;
      const response = await this.request<MergeCollectedResponse>(
        `/api/chat/session/${this.sessionId}/merge-collected`,
        {
          method: 'POST',
          body: JSON.stringify({ collectedData, ...this.buildClientPreferencesBody() }),
        },
        // Resume/import + enrichment может занимать >20s; свайпы — быстрый путь.
        isFeedbackOnly ? 15000 : 60000
      );

      if (response.metadata) {
        this.applySessionMetadata(response.metadata);
      }

      if (response.assistantMessage) {
        this.emitAssistantAudio(response.assistantAudio, response.assistantMessage);
        this.onMessage?.({ message: response.assistantMessage });
      }

      this.lastMessageCount = response.messages.length;
    } catch (error) {
      this.onError?.({
        message: error instanceof Error ? error.message : 'Failed to merge profile data',
      });
    }
  }

  /**
   * Execute a command
   */
  async executeCommand(commandId: string, action: string): Promise<void> {
    if (!this.sessionId) {
      this.onError?.({ message: 'Сессия не инициализирована' });
      return;
    }

    try {
      const response = await this.request<ChatSession>(
        `/api/chat/session/${this.sessionId}/command`,
        {
          method: 'POST',
          body: JSON.stringify({ commandId, action, ...this.buildClientPreferencesBody() }),
        }
      );

      if (response.metadata) {
        this.applySessionMetadata(response.metadata);
      }

      // Check for new messages
      if (response.messages.length > this.lastMessageCount) {
        const newMessages = response.messages.slice(this.lastMessageCount);
        const audioTarget =
          (response.assistantAudio?.messageId &&
            newMessages.find((msg) => msg.id === response.assistantAudio?.messageId)) ||
          [...newMessages].reverse().find((msg) => msg.role === 'assistant');
        this.emitAssistantAudio(response.assistantAudio, audioTarget ?? null);

        const lastAnimatableIndex = (() => {
          for (let i = newMessages.length - 1; i >= 0; i -= 1) {
            const msg = newMessages[i];
            if (
              msg.role === 'assistant' &&
              (msg.type === 'question' || (msg.type === 'text' && msg.interviewMode))
            ) {
              return i;
            }
          }
          return -1;
        })();

        newMessages.forEach((msg, index) => {
          if (!this.onMessage) return;
          this.onMessage({
            message: msg,
            skipAnimation: lastAnimatableIndex >= 0 && index !== lastAnimatableIndex,
          });
        });
      }

      this.lastMessageCount = response.messages.length;
    } catch (error) {
      this.onError?.({
        message: error instanceof Error ? error.message : 'Failed to execute command',
      });
    }
  }

  async generateResume(): Promise<{ resume: string; format: 'markdown' | 'text' | 'json' }> {
    if (!this.sessionId) {
      throw new Error('Сессия не инициализирована');
    }

    const response = await this.request<GenerateResumeResponse>(
      `/api/chat/session/${this.sessionId}/resume`,
      { method: 'POST' }
    );

    if (response.metadata) {
      this.applySessionMetadata(response.metadata);
    }

    if (response.assistantMessage) {
      this.emitAssistantAudio(response.assistantAudio, response.assistantMessage);
      this.onMessage?.({ message: response.assistantMessage });
    }
    if (response.downloadCommand) {
      this.onMessage?.({ message: response.downloadCommand, skipAnimation: true });
    }

    this.lastMessageCount = response.messages.length;
    return { resume: response.resume, format: response.format };
  }

  async downloadResumeFile(
    format: 'pdf' | 'docx'
  ): Promise<{ blob: Blob; fileName: string; mimeType: string }> {
    if (!this.sessionId) {
      throw new Error('Сессия не инициализирована');
    }
    const response = await fetch(
      `${this.baseUrl}/api/chat/session/${this.sessionId}/resume-file?format=${encodeURIComponent(format)}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition') || '';
    const fileNameMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
    const fileName = fileNameMatch?.[1] || `resume.${format}`;
    const mimeType = response.headers.get('Content-Type') || blob.type || 'application/octet-stream';
    return { blob, fileName, mimeType };
  }

  async generateSummary(): Promise<ProfileSummary> {
    if (!this.sessionId) {
      throw new Error('Сессия не инициализирована');
    }

    const response = await this.request<GenerateSummaryResponse>(
      `/api/chat/session/${this.sessionId}/summary`,
      { method: 'POST' }
    );

    if (!response.summary?.professionalSummary) {
      throw new Error('Сервер вернул пустое саммари');
    }

    if (response.metadata) {
      this.applySessionMetadata(response.metadata);
    }

    if (response.assistantMessage) {
      this.emitAssistantAudio(response.assistantAudio, response.assistantMessage);
      this.onMessage?.({ message: response.assistantMessage });
    }
    if (response.downloadCommand) {
      this.onMessage?.({ message: response.downloadCommand, skipAnimation: true });
    }

    this.lastMessageCount = response.messages.length;
    return response.summary;
  }

  async downloadSummaryFile(
    format: 'pdf' | 'docx'
  ): Promise<{ blob: Blob; fileName: string; mimeType: string }> {
    if (!this.sessionId) {
      throw new Error('Сессия не инициализирована');
    }
    const response = await fetch(
      `${this.baseUrl}/api/chat/session/${this.sessionId}/summary-file?format=${encodeURIComponent(format)}`,
      {
        method: 'GET',
        credentials: 'include',
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    const blob = await response.blob();
    const contentDisposition = response.headers.get('Content-Disposition') || '';
    const fileNameMatch = contentDisposition.match(/filename=\"?([^\";]+)\"?/i);
    const fileName = fileNameMatch?.[1] || `profile-summary.${format}`;
    const mimeType = response.headers.get('Content-Type') || blob.type || 'application/octet-stream';
    return { blob, fileName, mimeType };
  }

  async sendResumeEmail(customEmail?: string): Promise<{ success: boolean; email: string }> {
    if (!this.sessionId) {
      throw new Error('Сессия не инициализирована');
    }

    const response = await this.request<SendResumeEmailResponse>(
      `/api/chat/session/${this.sessionId}/resume-email`,
      {
        method: 'POST',
        body: customEmail ? JSON.stringify({ email: customEmail }) : undefined,
        headers: customEmail ? { 'Content-Type': 'application/json' } : undefined,
      }
    );

    if (response.metadata) {
      this.sessionMetadata = response.metadata;
    }

    if (response.assistantMessage) {
      this.emitAssistantAudio(response.assistantAudio, response.assistantMessage);
      this.onMessage?.({ message: response.assistantMessage });
    }

    this.lastMessageCount = response.messages.length;
    return { success: response.success, email: response.email };
  }

  /**
   * Poll for new messages (fallback for real-time)
   */
  private isStaleSessionPollingError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const message = error.message.toLowerCase();
    return (
      message.includes('session not found') ||
      message.includes('http 404') ||
      message.includes('not found or unauthorized')
    );
  }

  private startPolling(): void {
    this.stopPolling();
    const generation = this.pollingGeneration;

    // Poll every 3 seconds
    this.pollingInterval = setInterval(async () => {
      if (!this.sessionId || generation !== this.pollingGeneration) return;

      try {
        const session = await this.request<ChatSession>(`/api/chat/session/${this.sessionId}`);

        if (generation !== this.pollingGeneration) return;

        if (session.metadata) {
          this.sessionMetadata = session.metadata;
        }

        // Check for new messages
        if (session.messages.length > this.lastMessageCount) {
          const newMessages = session.messages.slice(this.lastMessageCount);
          newMessages.forEach((msg) => this.onMessage?.({ message: msg }));
          this.lastMessageCount = session.messages.length;
        }
      } catch (error) {
        if (generation !== this.pollingGeneration) return;

        if (this.isStaleSessionPollingError(error)) {
          // Session expired in Redis or was deleted — stop spamming 404 every 3s.
          this.stopPolling();
          this.sessionId = null;
          this.onError?.({
            message: 'Сессия истекла или недоступна. Обновите страницу или откройте чат заново.',
          });
          this.onDisconnected?.();
          return;
        }

        console.warn('Polling error:', error);
      }
    }, 3000);
  }

  private stopPolling(): void {
    this.pollingGeneration += 1;
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  get currentSessionId(): string | null {
    return this.sessionId;
  }

  get isConnected(): boolean {
    return this.sessionId !== null;
  }

  get metadata(): SessionMetadata | null {
    return this.sessionMetadata;
  }

  get product(): ProductType | undefined {
    return this.sessionMetadata?.product;
  }

  /**
   * Разбор интервью (оценка, рекомендации, вопросы) без PDF — для карточек на экране завершения.
   */
  async fetchReportPreview(): Promise<Record<string, unknown>> {
    if (!this.sessionId) {
      throw new Error('Сессия не инициализирована');
    }
    return this.request<Record<string, unknown>>(
      `/api/chat/session/${this.sessionId}/report-preview`
    );
  }

  /**
   * Request PDF report generation and get download URL
   */
  async requestReport(): Promise<{ reportId: string; status: string; url?: string }> {
    if (!this.sessionId) {
      throw new Error('Сессия не инициализирована');
    }

    // Request report generation
    const response = await this.request<{ reportId: string; status: string }>(
      `/api/chat/session/${this.sessionId}/report`,
      { method: 'POST' }
    );

    // If status is pending/generating, poll for completion
    if (response.status === 'pending' || response.status === 'generating') {
      return this.pollReportStatus(response.reportId);
    }

    return response;
  }

  /**
   * Poll for report status until ready or error
   */
  private async pollReportStatus(
    reportId: string,
    maxAttempts = 30,
    intervalMs = 2000
  ): Promise<{ reportId: string; status: string; url?: string }> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));

      const status = await this.request<{ reportId: string; status: string; url?: string }>(
        `/api/chat/session/${this.sessionId}/report/${reportId}`
      );

      if (status.status === 'ready') {
        return status;
      }

      if (status.status === 'error') {
        throw new Error('Ошибка генерации отчёта');
      }
    }

    throw new Error('Превышено время ожидания генерации отчёта');
  }
}

// Factory function for consistency with chatSocket API
export function createChatApi(
  config: {
    url?: string;
    token?: string;
    sessionId?: string;
    createNew?: boolean;
    product?: ProductType;
    intent?: 'vacancy_analyze';
    getClientPreferences?: () => ClientPreferences | undefined;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onSessionJoined?: (payload: { sessionId: string; metadata?: SessionMetadata }) => void;
    onHistory?: (payload: { messages: Message[] }) => void;
    onMessage?: (payload: ChatMessageDelivery) => void;
    onAssistantAudio?: (payload: {
      messageId: string;
      audioBase64: string;
      mimeType?: string;
      format?: 'mp3' | 'oggopus';
    }) => void;
    onError?: (payload: { message: string }) => void;
    onSendStateChange?: (state: 'sending' | 'idle') => void;
    onMetadataChange?: (metadata: SessionMetadata | null) => void;
  } = {}
) {
  const client = new ChatApiClient(config.url, config.getClientPreferences);

  // Wrap callbacks to match Socket.io interface
  if (config.onConnected) client.onConnected = config.onConnected;
  if (config.onDisconnected) client.onDisconnected = config.onDisconnected;
  if (config.onSessionJoined) {
    client.onSessionJoined = (sessionId, metadata) => config.onSessionJoined?.({ sessionId, metadata });
  }
  if (config.onHistory) {
    client.onHistory = (messages) => config.onHistory?.({ messages });
  }
  if (config.onMessage) {
    client.onMessage = (payload) => config.onMessage?.(payload);
  }
  if (config.onAssistantAudio) {
    client.onAssistantAudio = config.onAssistantAudio;
  }
  if (config.onError) client.onError = config.onError;
  if (config.onSendStateChange) client.onSendStateChange = config.onSendStateChange;
  if (config.onMetadataChange) {
    client.onMetadataChange = (metadata) => config.onMetadataChange?.(metadata);
  }

  return {
    connect: () =>
      client.connect({
        token: config.token,
        sessionId: config.sessionId,
        createNew: config.createNew,
        product: config.product,
        intent: config.intent,
      }),
    disconnect: () => client.disconnect(),
    sendMessage: (content: string) => client.sendMessage(content),
    analyzeVacancy: (vacancyText: string, displayLabel: string) =>
      client.analyzeVacancy(vacancyText, displayLabel),
    mergeCollectedData: (data: Record<string, unknown>) => client.mergeCollectedData(data),
    executeCommand: (commandId: string, action: string) => client.executeCommand(commandId, action),
    generateResume: () => client.generateResume(),
    generateSummary: () => client.generateSummary(),
    sendResumeEmail: (email?: string) => client.sendResumeEmail(email),
    downloadResumeFile: (format: 'pdf' | 'docx') => client.downloadResumeFile(format),
    downloadSummaryFile: (format: 'pdf' | 'docx') => client.downloadSummaryFile(format),
    fetchReportPreview: () => client.fetchReportPreview(),
    requestReport: () => client.requestReport(),
    get sessionId() {
      return client.currentSessionId;
    },
    get isConnected() {
      return client.isConnected;
    },
    get metadata() {
      return client.metadata;
    },
    get product() {
      return client.product;
    },
  };
}

export type ChatApi = ReturnType<typeof createChatApi>;
