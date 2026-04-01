import { Message } from './message';
import { ConversationSessionMetadata } from './session';

export type ScenarioStepType = 'question' | 'info_card' | 'command';

export interface ScenarioCondition {
  condition: string; // выражение для оценки, например: "experienceYears < 1"
  to: string; // ID шага для перехода
}

export interface ScenarioNext {
  default: string; // шаг по умолчанию
  when?: ScenarioCondition[]; // условия для ветвления
}

export type ScenarioNextValue = string | null | ScenarioNext;

export interface ScenarioStepBase {
  id: string;
  type: ScenarioStepType;
  label: string;
  next?: ScenarioNextValue;
}

export interface ScenarioQuestionStep extends ScenarioStepBase {
  type: 'question';
  instruction: string;
  fallbackText: string;
  placeholder?: string;
  collectKey?: string;
  commands?: Array<{
    id: string;
    label: string;
    action: string;
  }>;
}

export interface ScenarioInfoCardStep extends ScenarioStepBase {
  type: 'info_card';
  title: string;
  description?: string;
  cards: Array<{
    title: string;
    content: string;
    icon?: string;
  }>;
}

export interface ScenarioCommandStep extends ScenarioStepBase {
  type: 'command';
  commands: Array<{
    id: string;
    label: string;
    action: string;
  }>;
}

export type ScenarioStep = ScenarioQuestionStep | ScenarioInfoCardStep | ScenarioCommandStep;

export interface ScenarioDefinition {
  id: string;
  version: string;
  name: string;
  description?: string;
  entryStepId: string;
  steps: ScenarioStep[];
}

export interface PreparedStepResult {
  message: Message | null;
  nextStepId?: string | null;
  metadataUpdates?: Partial<ConversationSessionMetadata>;
}
