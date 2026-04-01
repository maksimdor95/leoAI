import { io, Socket } from 'socket.io-client';
import { getToken } from '@/lib/auth';
import {
  MessageReceivedPayload,
  SessionHistoryPayload,
  SessionJoinedPayload,
  ErrorPayload,
} from '@/types/chat';

// Use Gateway URL for WebSocket (Gateway proxies to Conversation Service)
const getDefaultSocketUrl = () => {
  // In production, use Gateway URL (which proxies /socket.io/ to Conversation Service)
  if (typeof window !== 'undefined') {
    // Use relative path to Gateway (same origin)
    return window.location.origin;
  }
  // Fallback for SSR
  return (
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_CONVERSATION_SERVICE_URL ||
    'http://localhost:3001'
  );
};

export type ChatSocketEvents = {
  onConnected?: (socket: Socket) => void;
  onDisconnected?: () => void;
  onSessionJoined?: (payload: SessionJoinedPayload) => void;
  onHistory?: (payload: SessionHistoryPayload) => void;
  onMessage?: (payload: MessageReceivedPayload) => void;
  onError?: (payload: ErrorPayload) => void;
};

export type ChatSocketConfig = {
  url?: string;
  token?: string;
  sessionId?: string;
  createNew?: boolean;
  transports?: ('websocket' | 'polling')[];
} & ChatSocketEvents;

export function createChatSocket(config: ChatSocketConfig = {}) {
  const {
    url = getDefaultSocketUrl(),
    // Use polling as primary transport - Yandex Serverless Containers don't support WebSocket
    transports = ['polling'],
    token,
    sessionId,
    createNew,
    onConnected,
    onDisconnected,
    onSessionJoined,
    onHistory,
    onMessage,
    onError,
  } = config;

  const authToken = token ?? getToken();

  if (!authToken) {
    throw new Error('Токен не найден. Пользователь должен быть авторизован.');
  }

  const socket = io(url, {
    transports,
    auth: {
      token: authToken,
      ...(sessionId ? { sessionId } : {}),
      ...(createNew ? { createNew: true } : {}),
    },
    autoConnect: false,
  });

  socket.on('connect', () => {
    onConnected?.(socket);
  });

  socket.on('disconnect', () => {
    onDisconnected?.();
  });

  socket.on('session:joined', (payload: SessionJoinedPayload) => {
    onSessionJoined?.(payload);
  });

  socket.on('session:history', (payload: SessionHistoryPayload) => {
    onHistory?.(payload);
  });

  socket.on('message:received', (payload: MessageReceivedPayload) => {
    onMessage?.(payload);
  });

  socket.on('error', (payload: ErrorPayload) => {
    onError?.(payload);
  });

  socket.on('connect_error', (error) => {
    onError?.({ message: error.message });
  });

  const sendMessage = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    socket.emit('message:send', { content: trimmed });
  };

  const executeCommand = (commandId: string, action: string) => {
    socket.emit('command:execute', { commandId, action });
  };

  return {
    socket,
    connect: () => socket.connect(),
    disconnect: () => socket.disconnect(),
    sendMessage,
    executeCommand,
  };
}

export type ChatSocket = ReturnType<typeof createChatSocket>;
