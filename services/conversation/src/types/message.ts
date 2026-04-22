/**
 * Types for conversation messages
 */

export const MessageType = {
  TEXT: 'text',
  QUESTION: 'question',
  INFO_CARD: 'info_card',
  COMMAND: 'command',
  SYSTEM: 'system',
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const;

export type MessageRoleValue = (typeof MessageRole)[keyof typeof MessageRole];

/**
 * Base message interface
 */
export interface BaseMessage {
  id: string;
  type: MessageTypeValue;
  role: MessageRoleValue;
  timestamp: string;
  sessionId: string;
}

/**
 * Text message (обычное сообщение в чате)
 */
export interface TextMessage extends BaseMessage {
  type: typeof MessageType.TEXT;
  content: string;
}

/**
 * Question message (вопрос, отображается по центру)
 */
export interface QuestionMessage extends BaseMessage {
  type: typeof MessageType.QUESTION;
  question: string;
  placeholder?: string; // Подсказка для поля ввода
}

/**
 * Info card (информационная карточка)
 */
export interface InfoCardMessage extends BaseMessage {
  type: typeof MessageType.INFO_CARD;
  title: string;
  description?: string;
  cards: Array<{
    title: string;
    content: string;
    icon?: string;
  }>;
  /** Кнопки сценария (например «Скачать PDF» на шаге report_ready) */
  commands?: Array<{
    id: string;
    label: string;
    action: string;
    icon?: string;
  }>;
}

/**
 * Command message (команды/кнопки для сценариев)
 */
export interface CommandMessage extends BaseMessage {
  type: typeof MessageType.COMMAND;
  commands: Array<{
    id: string;
    label: string;
    action: string; // Действие, которое выполнится при нажатии
    icon?: string;
  }>;
}

/**
 * System message (системные сообщения)
 */
export interface SystemMessage extends BaseMessage {
  type: typeof MessageType.SYSTEM;
  content: string;
  action?: string; // Системное действие
}

/**
 * Union type for all message types
 */
export type Message =
  | TextMessage
  | QuestionMessage
  | InfoCardMessage
  | CommandMessage
  | SystemMessage;

/**
 * Message payload for sending to client
 */
export interface MessagePayload {
  message: Message;
  metadata?: {
    isTyping?: boolean;
    audioUrl?: string; // URL для голосового ответа (будет добавлено позже)
  };
}
