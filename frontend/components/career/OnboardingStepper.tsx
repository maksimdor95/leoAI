import { Steps } from 'antd';

const { Step } = Steps;

export type OnboardingStepKey =
  | 'welcome'
  | 'currentRole'
  | 'experienceYears'
  | 'careerGoal'
  | 'resume'
  | 'interview'
  | 'readinessScore';

type OnboardingStepperProps = {
  currentStep: OnboardingStepKey;
};

const stepOrder: OnboardingStepKey[] = [
  'welcome',
  'currentRole',
  'experienceYears',
  'careerGoal',
  'resume',
  'interview',
  'readinessScore',
];

const stepTitles: Record<OnboardingStepKey, string> = {
  welcome: 'Welcome',
  currentRole: 'Текущая роль',
  experienceYears: 'Опыт',
  careerGoal: 'Цель',
  resume: 'Резюме',
  interview: 'Интервью',
  readinessScore: 'AI Readiness',
};

export function OnboardingStepper({ currentStep }: OnboardingStepperProps) {
  const currentIndex = stepOrder.indexOf(currentStep);

  return (
    <div className="mb-6 sm:mb-8">
      <Steps
        size="small"
        current={currentIndex}
        responsive
        labelPlacement="vertical"
        className="!text-slate-200"
      >
        {stepOrder.map((stepKey) => (
          <Step
            key={stepKey}
            title={<span className="text-[11px] sm:text-xs text-slate-200">{stepTitles[stepKey]}</span>}
          />
        ))}
      </Steps>
    </div>
  );
}

