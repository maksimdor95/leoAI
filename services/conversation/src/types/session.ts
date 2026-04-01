/**
 * Types for conversation sessions
 */

import { Message } from './message';

// ============================================
// ПРОФИЛЬ КАНДИДАТА (Расширенная структура)
// ============================================

/**
 * Информация о команде на позиции
 */
export interface TeamInfo {
  size?: number;
  type?: 'direct' | 'matrix' | 'mixed';
  description?: string;
}

/**
 * Проект с результатами
 */
export interface ProjectInfo {
  name: string;
  result: string;
}

/**
 * Позиция/место работы
 */
export interface WorkPosition {
  company: string;
  period: string;
  role: string;
  industry?: string;
  team?: TeamInfo;
  responsibilities?: string[];
  achievements?: string[];
  projects?: ProjectInfo[];
}

/**
 * Образование
 */
export interface EducationInfo {
  main?: string; // Основное образование (ВУЗ, факультет, годы)
  additional?: string[]; // Курсы, MBA, сертификации
}

/**
 * Навыки
 */
export interface SkillsInfo {
  hard?: string[]; // Технические навыки
  soft?: string[]; // Управленческие/коммуникативные
  languages?: Array<{ language: string; level: string }>;
}

/**
 * Предпочтения по поиску работы
 */
export interface DesiredJobInfo {
  role?: string;
  location?: string;
  workFormat?: string;
  salary?: string;
  culture?: string;
}

/**
 * Полный профиль кандидата
 */
export interface CandidateProfile {
  // Общая информация
  careerSummary?: string; // Автогенерируемое саммари
  totalExperience?: number | string;
  
  // Детальный опыт работы
  positionsCount?: number;
  currentPositionIndex?: number; // Для отслеживания прогресса в цикле
  positions?: WorkPosition[];
  
  // Образование
  education?: EducationInfo;
  
  // Навыки
  skills?: SkillsInfo;
  
  // Предпочтения
  desired?: DesiredJobInfo;
}

/**
 * Собранные данные (обратная совместимость + новый профиль)
 */
export interface CollectedData extends CandidateProfile {
  email?: string;
  name?: string;
  preferences?: Record<string, unknown>;
  [key: string]: unknown;
}

export type ProductType = 'jack' | 'wannanew';

export interface ConversationSessionMetadata {
  collectedData: CollectedData;
  status: 'active' | 'paused' | 'completed';
  product?: ProductType;
  scenarioId?: string;
  currentStepId?: string;
  completedSteps: string[];
  flags: Record<string, boolean | string | undefined>;
}

export interface ConversationSession {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
  metadata: ConversationSessionMetadata;
}

export interface SessionCreateRequest {
  userId: string;
  product?: ProductType;
}

export interface SessionJoinRequest {
  sessionId: string;
  token: string; // JWT token для авторизации
}
