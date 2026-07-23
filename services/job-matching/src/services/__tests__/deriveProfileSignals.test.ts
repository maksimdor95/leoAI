import { deriveProfileSignals } from '../deriveProfileSignals';
import type { CollectedData } from '../userService';

describe('deriveProfileSignals', () => {
  it('derives role_family, seniority and job_preferences from Jack collectedData', () => {
    const data: CollectedData = {
      careerSummary: 'Product Manager, 7 лет в B2B SaaS',
      totalExperience: 7,
      desired_role: 'Senior Product Manager',
      desired_location: 'Москва, гибрид',
      desired_salary: 'от 400 000 ₽',
      skills_hard: 'SQL, Jira, Figma',
    };

    const signals = deriveProfileSignals(data);

    expect(signals.role_family).toBe('product');
    expect(signals.seniority).toBe('senior');
    expect(signals.job_preferences?.target_role).toBe('Senior Product Manager');
    expect(signals.job_preferences?.work_format).toBe('hybrid');
    expect(signals.normalized_skills?.length).toBeGreaterThan(0);
  });

  it('returns empty object for null input', () => {
    expect(deriveProfileSignals(null)).toEqual({});
  });
});
