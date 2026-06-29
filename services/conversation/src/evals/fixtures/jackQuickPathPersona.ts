import { JackPersonaFixture } from './types';

/** Быстрый подбор Jack: greeting → 3 вопроса → quick_ready */
export const JACK_QUICK_PATH_PERSONA: JackPersonaFixture = {
  id: 'jack-quick-path',
  description: 'Jack quick path — 4 user answers from TEST_USERS quick mode',
  product: 'jack',
  scenarioId: 'jack-profile-v2',
  expectedFinalStepId: 'quick_ready',
  maxClarifyCount: 1,
  requiredCollectedKeys: ['scenarioMode', 'desired_role', 'careerSummary', 'desired_location'],
  answers: [
    'быстрый подбор',
    'Senior Product Manager',
    '5 лет в продукте, финтех, аналитика и запуск фич',
    'Москва, гибрид, от 350000 net',
  ],
};
