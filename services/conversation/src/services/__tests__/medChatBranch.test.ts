import { JACK_SCENARIO } from '../../scenario/jackScenario';
import { isMedPathMode, resolveNextStep, shouldSkipStepForProfileGaps } from '../dialogueEngine';
import { applyMedSkillsFeedback, normalizeMedEmployment } from '../medProfileService';
import { normalizeYesNo, resolveCollectValueForStep } from '../../utils/numericStepAnswers';

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function nextOf(stepId: string, collected: Record<string, unknown>): string | null {
  const step = JACK_SCENARIO.steps.find((s) => s.id === stepId);
  if (!step) throw new Error(`Step not found: ${stepId}`);
  return resolveNextStep(
    (step as { next?: Parameters<typeof resolveNextStep>[0] }).next,
    collected
  );
}

describe('LEO Med branch inside Jack scenario', () => {
  it('routes to med confirmation only when a medical role was detected', () => {
    expect(nextOf('quick_role', { medDetected: 'да' })).toBe('med_confirm');
    expect(nextOf('quick_role', { medDetected: 'нет' })).toBe('quick_experience');
    expect(nextOf('quick_role', {})).toBe('quick_experience');

    expect(nextOf('desired_role', { medDetected: 'да' })).toBe('med_confirm_pref');
    expect(nextOf('desired_role', {})).toBe('desired_location');

    expect(nextOf('career_overview', { medDetected: 'да' })).toBe('med_confirm_career');
    expect(nextOf('career_overview', {})).toBe('total_experience');
  });

  it('falls back to the regular path when the candidate is not a medic', () => {
    expect(nextOf('med_confirm', { medConfirmed: 'да' })).toBe('med_skills');
    expect(nextOf('med_confirm', { medConfirmed: 'нет' })).toBe('quick_experience');
    expect(nextOf('med_confirm_pref', { medConfirmed: 'да' })).toBe('med_skills');
    expect(nextOf('med_confirm_pref', { medConfirmed: 'нет' })).toBe('desired_location');
    expect(nextOf('med_confirm_career', { medConfirmed: 'да' })).toBe('med_skills');
    expect(nextOf('med_confirm_career', { medConfirmed: 'нет' })).toBe('total_experience');
  });

  it('walks the med profile steps up to consent', () => {
    expect(nextOf('med_skills', {})).toBe('med_experience');
    expect(nextOf('med_experience', {})).toBe('med_documents');
    expect(nextOf('med_documents', {})).toBe('med_city');
    expect(nextOf('med_city', {})).toBe('med_employment');
    expect(nextOf('med_employment', {})).toBe('med_consent');
  });

  it('saves the profile only when consent A is given', () => {
    expect(nextOf('med_consent', { medConsent: 'да' })).toBe('med_ready');
    expect(nextOf('med_consent', { medConsent: 'нет' })).toBe('med_no_consent');
  });

  it('normalizes free-form yes/no answers used by the branch conditions', () => {
    expect(resolveCollectValueForStep('medConfirmed', 'Да, верно')).toBe('да');
    expect(resolveCollectValueForStep('medConfirmed', 'Нет, я в IT')).toBe('нет');
    expect(resolveCollectValueForStep('medConsent', 'Даю согласие')).toBe('да');
    expect(resolveCollectValueForStep('medConsent', 'не сейчас')).toBe('нет');
    expect(normalizeYesNo('Конечно')).toBe('да');
  });

  it('keeps med steps out of the profile-gap flow for non-med candidates', () => {
    const itProfile = { desired_role: 'Product Manager' };
    const medStep = JACK_SCENARIO.steps.find((s) => s.id === 'med_documents')!;
    expect(shouldSkipStepForProfileGaps(medStep, itProfile)).toBe(true);

    const medProfile = { medRoleId: 'doctor_therapist', medConfirmed: 'да' };
    expect(isMedPathMode(medProfile)).toBe(true);
    expect(isMedPathMode({ medRoleId: 'doctor_therapist', medConfirmed: 'нет' })).toBe(false);
    expect(shouldSkipStepForProfileGaps(medStep, medProfile)).toBe(false);
  });
});

describe('med taxonomy prefill editing', () => {
  const ids = ['s1', 's2', 's3'];
  const labels = ['ЭКГ', 'Ведение документации', 'Осмотр пациента'];

  it('keeps the whole prefill on confirmation', () => {
    expect(applyMedSkillsFeedback(ids, labels, 'всё верно')).toEqual({
      skillIds: ids,
      skillLabels: labels,
    });
  });

  it('drops named items when the answer asks to remove them', () => {
    const result = applyMedSkillsFeedback(ids, labels, 'убрать ЭКГ');
    expect(result.skillIds).toEqual(['s2', 's3']);
    expect(result.skillLabels).not.toContain('ЭКГ');
  });

  it('treats other free text as additions', () => {
    const result = applyMedSkillsFeedback(ids, labels, 'добавить УЗИ, забор крови');
    expect(result.skillIds).toEqual(ids);
    expect(result.skillLabels).toEqual([...labels, 'УЗИ', 'забор крови']);
  });
});

describe('med employment normalization', () => {
  it('maps free-form answers to the med_specialists enum', () => {
    expect(normalizeMedEmployment('совместительство')).toBe('combination');
    expect(normalizeMedEmployment('подработка по выходным')).toBe('side_job');
    expect(normalizeMedEmployment('временная, на декрет')).toBe('temporary');
    expect(normalizeMedEmployment('постоянная работа')).toBe('permanent');
    expect(normalizeMedEmployment('')).toBeNull();
  });
});
