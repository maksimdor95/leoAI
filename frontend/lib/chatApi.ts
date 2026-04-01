/**
 * REST-based Chat API Client
 * Works reliably in serverless environments (Yandex Serverless Containers)
 */

import { getToken } from '@/lib/auth';
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
}

interface SendMessageResponse extends ChatSession {
  userMessage: Message;
  assistantMessage: Message | null;
}

class ChatApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private sessionId: string | null = null;
  private sessionMetadata: SessionMetadata | null = null;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private lastMessageCount = 0;

  // Event callbacks
  public onSessionJoined?: (sessionId: string, metadata?: SessionMetadata) => void;
  public onHistory?: (messages: Message[]) => void;
  public onMessage?: (message: Message) => void;
  public onError?: (error: { message: string }) => void;
  public onConnected?: () => void;
  public onDisconnected?: () => void;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || getApiUrl();
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.token || getToken();
    if (!token) {
      throw new Error('Токен не найден. Пользователь должен быть авторизован.');
    }

    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        // Use X-Auth-Token instead of Authorization to bypass Yandex IAM validation
        'X-Auth-Token': `Bearer ${token}`,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    return response.json();
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

      // Emit user message
      if (response.userMessage) {
        this.onMessage?.(response.userMessage);
      }

      // Emit assistant message
      if (response.assistantMessage) {
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
    executeCommand: (commandId: string, action: string) => client.executeCommand(commandId, action),
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
