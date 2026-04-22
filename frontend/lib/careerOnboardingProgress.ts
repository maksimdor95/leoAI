import { OnboardingStepKey } from '@/components/career/OnboardingStepper';

export const CAREER_ONBOARDING_PROGRESS_KEY = 'careerOnboardingProgress';

export type CareerOnboardingProgress = {
  step: OnboardingStepKey;
  updatedAt: string;
  completed: boolean;
};

export const onboardingStepTitles: Record<OnboardingStepKey, string> = {
  welcome: 'Welcome',
  currentRole: 'Текущая роль',
  experienceYears: 'Опыт',
  careerGoal: 'Цель',
  resume: 'Резюме',
  interview: 'Интервью',
  readinessScore: 'AI Readiness',
};

export function readCareerOnboardingProgress(): CareerOnboardingProgress | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(CAREER_ONBOARDING_PROGRESS_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CareerOnboardingProgress;
    if (!parsed?.step || !parsed?.updatedAt) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function saveCareerOnboardingProgress(progress: CareerOnboardingProgress): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(CAREER_ONBOARDING_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // Ignore storage errors in private mode / limited environments
  }
}
