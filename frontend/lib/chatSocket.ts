import { io, Socket } from 'socket.io-client';
import { isAuthenticated } from '@/lib/auth';
import {
  MessageReceivedPayload,
  SessionHistoryPayload,
  SessionJoinedPayload,
  ErrorPayload,
} from '@/types/chat';
import { getPublicApiBaseUrl } from './publicApiBaseUrl';

// Gateway / reverse proxy serves /socket.io on the same host as the frontend.
const getDefaultSocketUrl = () => {
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  return getPublicApiBaseUrl();
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
    // polling first for restrictive networks; VPS + Caddy supports websocket via upgrade
    transports = ['websocket', 'polling'],
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

  const authToken = token;

  if (!authToken && !isAuthenticated()) {
    throw new Error('Токен не найден. Пользователь должен быть авторизован.');
  }

  const socket = io(url, {
    transports,
    withCredentials: true,
    auth: {
      ...(authToken ? { token: authToken } : {}),
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
