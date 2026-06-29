import { ProductType } from '../../types/session';

export interface JackPersonaFixture {
  id: string;
  description: string;
  product: ProductType;
  scenarioId: string;
  expectedFinalStepId: string;
  maxClarifyCount: number;
  requiredCollectedKeys: string[];
  expectedMilestones?: string[];
  answers: string[];
}

export const JACK_DETAILED_REQUIRED_KEYS = [
  'scenarioMode',
  'careerSummary',
  'totalExperience',
  'positionsCount',
  'position_1_company',
  'position_1_role',
  'position_2_company',
  'desired_role',
  'desired_location',
  'additional_info',
] as const;

export const JACK_DETAILED_MILESTONES = [
  'career_overview',
  'position_1_company',
  'position_2_company',
  'skills_languages',
  'desired_role',
  'completion',
] as const;

interface DetailedJackAnswersInput {
  careerOverview: string;
  totalExperience: string;
  positionsCount: string;
  position1: [string, string, string, string, string, string, string];
  position2: [string, string, string, string, string];
  education: [string, string];
  skills: [string, string, string];
  preferences: [string, string, string, string, string, string];
}

/** Детальный Jack: greeting → career…skills → profile_snapshot → prefs → completion */
export function buildDetailedJackAnswers(input: DetailedJackAnswersInput): string[] {
  return [
    'детализированный анализ',
    input.careerOverview,
    input.totalExperience,
    input.positionsCount,
    'продолжить', // position_intro info_card (auto-advance, answer not collected)
    ...input.position1,
    ...input.position2,
    ...input.education,
    ...input.skills,
    'продолжить',
    ...input.preferences,
  ];
}
