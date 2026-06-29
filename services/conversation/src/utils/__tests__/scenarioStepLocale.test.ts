import { resolveQuestionStepCopy } from '../scenarioStepLocale';

describe('scenarioStepLocale', () => {
  it('returns English greeting for jack when locale is en', () => {
    const copy = resolveQuestionStepCopy('jack-profile-v2', 'greeting', 'en', {
      fallbackText: 'Привет',
      placeholder: 'RU',
      instruction: 'RU instr',
    });
    expect(copy.fallbackText).toContain("Hello! I'm LEO");
    expect(copy.placeholder).toContain('Quick match');
  });

  it('keeps Russian defaults when locale is ru', () => {
    const copy = resolveQuestionStepCopy('jack-profile-v2', 'greeting', 'ru', {
      fallbackText: 'Привет',
      placeholder: 'RU',
      instruction: 'RU instr',
    });
    expect(copy.fallbackText).toBe('Привет');
  });
});
