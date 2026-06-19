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

/** Режим тренажёра interview-prep (тред в истории диалога). */
export type InterviewPrepMode =
  | 'diagnostics'
  | 'theory'
  | 'case'
  | 'mock'
  | 'star'
  | 'employer_questions';

export interface BaseMessage {
  id: string;
  type: MessageTypeValue;
  role: MessageRoleValue;
  timestamp: string;
  sessionId: string;
  interviewMode?: InterviewPrepMode;
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
  /** Структурированный план подготовки по дням (рендерится списком). */
  planDays?: PrepPlanDayItem[];
}

export interface PrepPlanDayItem {
  day: number;
  focus: string;
  tasks: string[];
}

export interface CommandItem {
  id: string;
  label: string;
  action: string;
  icon?: string;
}

export interface ChatScenarioCta {
  id: string;
  label: string;
  action: string;
}

export interface ChatScenario {
  id: string;
  title: string;
  description: string;
  starterMessage: string;
  followUpMessage: string;
  ctas: ChatScenarioCta[];
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

export type ProfileSummaryScoreItem = {
  criterion: string;
  score: number;
  maxScore: number;
  comment: string;
};

export type ProfileSummary = {
  professionalSummary: string;
  score: number;
  scoreBreakdown: ProfileSummaryScoreItem[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};
