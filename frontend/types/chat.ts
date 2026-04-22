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

export interface BaseMessage {
  id: string;
  type: MessageTypeValue;
  role: MessageRoleValue;
  timestamp: string;
  sessionId: string;
}

export interface TextMessage extends BaseMessage {
  type: typeof MessageType.TEXT;
  content: string;
}

export interface QuestionMessage extends BaseMessage {
  type: typeof MessageType.QUESTION;
  question: string;
  placeholder?: string;
}

export interface InfoCardItem {
  title: string;
  content: string;
  icon?: string;
}

export interface CommandItem {
  id: string;
  label: string;
  action: string;
  icon?: string;
}

export interface InfoCardMessage extends BaseMessage {
  type: typeof MessageType.INFO_CARD;
  title: string;
  description?: string;
  cards: InfoCardItem[];
  /** Кнопки сценария (PDF, рестарт и т.д.) */
  commands?: CommandItem[];
}

export interface CommandMessage extends BaseMessage {
  type: typeof MessageType.COMMAND;
  commands: CommandItem[];
}

export interface SystemMessage extends BaseMessage {
  type: typeof MessageType.SYSTEM;
  content: string;
  action?: string;
}

export type Message =
  | TextMessage
  | QuestionMessage
  | InfoCardMessage
  | CommandMessage
  | SystemMessage;

export interface SessionJoinedPayload {
  sessionId: string;
}

export interface SessionHistoryPayload {
  messages: Message[];
}

export interface MessageReceivedPayload {
  message: Message;
}

export interface ErrorPayload {
  message: string;
}
