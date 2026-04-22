/**
 * REST-based Chat API Client
 * Works reliably in serverless environments (Yandex Serverless Containers)
 */

import { getToken } from '@/lib/auth';
import { buildAuthHeaders } from '@/lib/authHeaders';
import { Message } from '@/types/chat';

const getApiUrl = () => {
  // Всегда используем переменную окружения, даже в браузере
  // В dev: из .env.local
  // В production: встроено в код при сборке из Dockerfile ARG
  return process.env.NEXT_PUBLIC_CONVERSATION_API_URL || 
         process.env.NEXT_PUBLIC_API_URL || 
         'http://localhost:3002';
};

type ProductType = 'jack' | 'wannanew';

interface SessionMetadata {
  product?: ProductType;
  scenarioId?: string;
  status?: string;
  collectedData?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ChatSession {
  sessionId: string;
  messages: Message[];
  metadata: SessionMetadata;
  assistantAudio?: {
    audioBase64: string;
    mimeType?: string;
    format?: 'mp3' | 'oggopus';
  } | null;
}

interface SendMessageResponse extends ChatSession {
  userMessage: Message;
  assistantMessage: Message | null;
  assistantAudio?: {
    audioBase64: string;
    mimeType?: string;
    format?: 'mp3' | 'oggopus';
  } | null;
}

interface MergeCollectedResponse extends ChatSession {
  assistantMessage: Message | null;
  assistantAudio?: {
    audioBase64: string;
    mimeType?: string;
    format?: 'mp3' | 'oggopus';
  } | null;
}

interface GenerateResumeResponse extends ChatSession {
  resume: string;
  format: 'markdown' | 'text' | 'json';
  assistantMessage: Message | null;
  downloadCommand?: Message | null;
  assistantAudio?: {
    audioBase64: string;
    mimeType?: string;
    format?: 'mp3' | 'oggopus';
  } | null;
}

interface SendResumeEmailResponse extends ChatSession {
  success: boolean;
  email: string;
  assistantMessage: Message | null;
  assistantAudio?: {
    audioBase64: string;
    mimeType?: string;
    format?: 'mp3' | 'oggopus';
  } | null;
}

class ChatApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private sessionId: string | null = null;
  private sessionMetadata: SessionMetadata | null = null;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private lastMessageCount = 0;
  private requestTimeoutMs = Number(process.env.NEXT_PUBLIC_CHAT_REQUEST_TIMEOUT_MS || 20000);

  // Event callbacks
  public onSessionJoined?: (sessionId: string, metadata?: SessionMetadata) => void;
  public onHistory?: (messages: Message[]) => void;
  public onMessage?: (message: Message) => void;
  public onError?: (error: { message: string }) => void;
  public onConnected?: () => void;
  public onDisconnected?: () => void;
  public onAssistantAudio?: (payload: {
    messageId: string;
    audioBase64: string;
    mimeType?: string;
    format?: 'mp3' | 'oggopus';
  }) => void;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getApiUrl();
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.token || getToken();
    if (!token) {
      throw new Error('Токен не найден. Пользователь должен быть авторизован.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.requestTimeoutMs);
    const url = `${this.baseUrl}${endpoint}`;
    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(token, true),
          ...options.headers,
        },
      });
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
    } = {}
  ): Promise<void> {
    this.token = options.token || getToken();

    try {
      const session = await this.request<ChatSession>('/api/chat/session', {
        method: 'POST',
        body: JSON.stringify({
          sessionId: options.sessionId,
          createNew: options.createNew,
          product: options.product,
        }),
      });

      this.sessionId = session.sessionId;
      this.sessionMetadata = session.metadata;
      this.lastMessageCount = session.messages.length;

      this.onConnected?.();
      this.onSessionJoined?.(session.sessionId, session.metadata);

      if (session.assistantAudio?.audioBase64) {
        const lastAssistant = [...session.messages]
          .reverse()
          .find((msg) => msg.role === 'assistant');
        if (lastAssistant) {
          this.onAssistantAudio?.({
            messageId: lastAssistant.id,
            audioBase64: session.assistantAudio.audioBase64,
            mimeType: session.assistantAudio.mimeType,
            format: session.assistantAudio.format,
          });
        }
      }

      if (session.messages.length > 0) {
        this.onHistory?.(session.messages);
      }

      // Start polling for new messages
      this.startPolling();
    } catch (error) {
      this.onError?.({ message: error instanceof Error ? error.message : 'Connection failed' });
      throw error;
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

    try {
      const response = await this.request<SendMessageResponse>(
        `/api/chat/session/${this.sessionId}/message`,
        {
          method: 'POST',
          body: JSON.stringify({ content: trimmed }),
        }
      );

      if (response.metadata) {
        this.sessionMetadata = response.metadata;
      }

      // Emit user message
      if (response.userMessage) {
        this.onMessage?.(response.userMessage);
      }

      // Emit assistant message
      if (response.assistantMessage) {
        if (response.assistantAudio?.audioBase64) {
          this.onAssistantAudio?.({
            messageId: response.assistantMessage.id,
            audioBase64: response.assistantAudio.audioBase64,
            mimeType: response.assistantAudio.mimeType,
            format: response.assistantAudio.format,
          });
        }
        this.onMessage?.(response.assistantMessage);
      }

      this.lastMessageCount = response.messages.length;
    } catch (error) {
      this.onError?.({
        message: error instanceof Error ? error.message : 'Failed to send message',
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
      const response = await this.request<MergeCollectedResponse>(
        `/api/chat/session/${this.sessionId}/merge-collected`,
        {
          method: 'POST',
          body: JSON.stringify({ collectedData }),
        }
      );

      if (response.metadata) {
        this.sessionMetadata = response.metadata;
      }

      if (response.assistantMessage) {
        if (response.assistantAudio?.audioBase64) {
          this.onAssistantAudio?.({
            messageId: response.assistantMessage.id,
            audioBase64: response.assistantAudio.audioBase64,
            mimeType: response.assistantAudio.mimeType,
            format: response.assistantAudio.format,
          });
        }
        this.onMessage?.(response.assistantMessage);
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
          body: JSON.stringify({ commandId, action }),
        }
      );

      if (response.metadata) {
        this.sessionMetadata = response.metadata;
      }

      // Check for new messages
      if (response.messages.length > this.lastMessageCount) {
        const newMessages = response.messages.slice(this.lastMessageCount);
        newMessages.forEach((msg) => this.onMessage?.(msg));
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
      this.sessionMetadata = response.metadata;
    }

    if (response.assistantMessage) {
      if (response.assistantAudio?.audioBase64) {
        this.onAssistantAudio?.({
          messageId: response.assistantMessage.id,
          audioBase64: response.assistantAudio.audioBase64,
          mimeType: response.assistantAudio.mimeType,
          format: response.assistantAudio.format,
        });
      }
      this.onMessage?.(response.assistantMessage);
    }
    if (response.downloadCommand) {
      this.onMessage?.(response.downloadCommand);
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
    const token = this.token || getToken();
    if (!token) {
      throw new Error('Токен не найден. Пользователь должен быть авторизован.');
    }
    const response = await fetch(
      `${this.baseUrl}/api/chat/session/${this.sessionId}/resume-file?format=${encodeURIComponent(format)}`,
      {
        method: 'GET',
        headers: buildAuthHeaders(token, true),
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

  async sendResumeEmail(): Promise<{ success: boolean; email: string }> {
    if (!this.sessionId) {
      throw new Error('Сессия не инициализирована');
    }

    const response = await this.request<SendResumeEmailResponse>(
      `/api/chat/session/${this.sessionId}/resume-email`,
      { method: 'POST' }
    );

    if (response.metadata) {
      this.sessionMetadata = response.metadata;
    }

    if (response.assistantMessage) {
      if (response.assistantAudio?.audioBase64) {
        this.onAssistantAudio?.({
          messageId: response.assistantMessage.id,
          audioBase64: response.assistantAudio.audioBase64,
          mimeType: response.assistantAudio.mimeType,
          format: response.assistantAudio.format,
        });
      }
      this.onMessage?.(response.assistantMessage);
    }

    this.lastMessageCount = response.messages.length;
    return { success: response.success, email: response.email };
  }

  /**
   * Poll for new messages (fallback for real-time)
   */
  private startPolling(): void {
    this.stopPolling();

    // Poll every 3 seconds
    this.pollingInterval = setInterval(async () => {
      if (!this.sessionId) return;

      try {
        const session = await this.request<ChatSession>(`/api/chat/session/${this.sessionId}`);

        if (session.metadata) {
          this.sessionMetadata = session.metadata;
        }

        // Check for new messages
        if (session.messages.length > this.lastMessageCount) {
          const newMessages = session.messages.slice(this.lastMessageCount);
          newMessages.forEach((msg) => this.onMessage?.(msg));
          this.lastMessageCount = session.messages.length;
        }
      } catch (error) {
        // Silently ignore polling errors
        console.warn('Polling error:', error);
      }
    }, 3000);
  }

  private stopPolling(): void {
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
    onConnected?: () => void;
    onDisconnected?: () => void;
    onSessionJoined?: (payload: { sessionId: string; metadata?: SessionMetadata }) => void;
    onHistory?: (payload: { messages: Message[] }) => void;
    onMessage?: (payload: { message: Message }) => void;
    onAssistantAudio?: (payload: {
      messageId: string;
      audioBase64: string;
      mimeType?: string;
      format?: 'mp3' | 'oggopus';
    }) => void;
    onError?: (payload: { message: string }) => void;
  } = {}
) {
  const client = new ChatApiClient(config.url);

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
    client.onMessage = (message) => config.onMessage?.({ message });
  }
  if (config.onAssistantAudio) {
    client.onAssistantAudio = config.onAssistantAudio;
  }
  if (config.onError) client.onError = config.onError;

  return {
    connect: () =>
      client.connect({
        token: config.token,
        sessionId: config.sessionId,
        createNew: config.createNew,
        product: config.product,
      }),
    disconnect: () => client.disconnect(),
    sendMessage: (content: string) => client.sendMessage(content),
    mergeCollectedData: (data: Record<string, unknown>) => client.mergeCollectedData(data),
    executeCommand: (commandId: string, action: string) => client.executeCommand(commandId, action),
    generateResume: () => client.generateResume(),
    sendResumeEmail: () => client.sendResumeEmail(),
    downloadResumeFile: (format: 'pdf' | 'docx') => client.downloadResumeFile(format),
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
