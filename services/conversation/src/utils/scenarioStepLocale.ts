export type UiLocale = 'ru' | 'en';

type StepLocaleCopy = {
  fallbackText: string;
  placeholder?: string;
  instruction?: string;
};

/** Английские fallback для ключевых шагов (scenarioId:stepId). */
const EN_STEP_COPY: Record<string, StepLocaleCopy> = {
  'jack-profile-v2:greeting': {
    fallbackText:
      "Hello! I'm LEO, your AI job-matching assistant. I'll build your profile and match jobs. Choose a path: quick match, detailed analysis, or analyze an existing resume.",
    placeholder: 'Quick match, detailed analysis, or analyze resume.',
  },
  'interview-prep-v1:greeting': {
    fallbackText:
      "Hi! I'm LEO — I'll help you prepare for interviews on any role. I can run a mock interview as the hiring company, or break down a job posting with a prep plan, theory, and cases. What would you like to start with?",
    placeholder: 'Type "mock interview" or "vacancy breakdown".',
  },
  'wannanew-pm-v1:greeting': {
    fallbackText:
      "Hi! I'm LEO — I'll run a mock interview for your target role, like a real employer, and prepare a personal report with feedback. In 10–15 minutes we'll review your experience and run the interview. Ready to start?",
    placeholder: 'Type "yes" if you\'re ready to continue.',
  },
};

export function getSessionUiLocale(metadata: { uiLocale?: UiLocale; ttsLang?: string }): UiLocale {
  if (metadata.uiLocale === 'en' || metadata.uiLocale === 'ru') {
    return metadata.uiLocale;
  }
  if (metadata.ttsLang === 'en-US') {
    return 'en';
  }
  return 'ru';
}

export function resolveQuestionStepCopy(
  scenarioId: string | undefined,
  stepId: string,
  uiLocale: UiLocale,
  defaults: { fallbackText: string; placeholder?: string; instruction: string }
): { fallbackText: string; placeholder?: string; instruction: string } {
  if (uiLocale !== 'en') {
    return defaults;
  }

  const key = `${scenarioId ?? ''}:${stepId}`;
  const en = EN_STEP_COPY[key];
  if (en) {
    return {
      fallbackText: en.fallbackText,
      placeholder: en.placeholder ?? defaults.placeholder,
      instruction:
        en.instruction ??
        `${defaults.instruction}\n\nIMPORTANT: Write the entire question in English only.`,
    };
  }

  return {
    ...defaults,
    instruction: `${defaults.instruction}\n\nIMPORTANT: Write the entire question in English only.`,
  };
}
