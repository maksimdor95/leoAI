import { Job } from '../../models/job';
import {
  detectSalesChannel,
  isSeniorityTierNoise,
  matchSalaryExpectation,
  shouldDemoteFromRecommended,
} from '../matchNoise';
import { CollectedData } from '../userService';

function mkJob(partial: Partial<Job>): Job {
  return {
    id: partial.id ?? 'job-1',
    title: partial.title ?? 'Untitled',
    company: partial.company ?? 'ACME',
    location: partial.location ?? ['Москва'],
    salary_min: partial.salary_min ?? null,
    salary_max: partial.salary_max ?? null,
    currency: partial.currency ?? 'RUR',
    description: partial.description ?? '',
    requirements: partial.requirements ?? '',
    skills: partial.skills ?? [],
    experience_level: partial.experience_level ?? null,
    work_mode: partial.work_mode ?? null,
    source: partial.source ?? 'hh.ru',
    source_url: partial.source_url ?? 'https://example.com/job',
    posted_at: partial.posted_at ?? new Date(),
    created_at: partial.created_at ?? new Date(),
    updated_at: partial.updated_at ?? new Date(),
  };
}

describe('matchNoise', () => {
  it('detects inbound vs outbound sales mismatch', () => {
    expect(detectSalesChannel('менеджер по исходящим B2B продажам')).toBe('outbound');
    expect(detectSalesChannel('оператор call-центра, входящие звонки')).toBe('inbound');
  });

  it('flags seniority noise in both directions', () => {
    expect(isSeniorityTierNoise('lead', 'middle')).toBe(true);
    expect(isSeniorityTierNoise('junior', 'senior')).toBe(true);
    expect(isSeniorityTierNoise('senior', 'middle')).toBe(false);
  });

  it('demotes outbound profile against inbound vacancy', () => {
    const job = mkJob({
      title: 'Оператор call-центра',
      description: 'Входящие звонки, поддержка клиентов',
      experience_level: 'middle',
    });
    const profile: CollectedData = {
      desiredRole: 'Менеджер по исходящим B2B продажам',
      careerSummary: '5 лет outbound enterprise sales',
      totalExperience: 5,
    };
    expect(
      shouldDemoteFromRecommended(job, profile, 'middle', 'middle', false)
    ).toBe(true);
  });

  it('penalizes salary below expectation', () => {
    const job = mkJob({ salary_min: 120_000, salary_max: 150_000 });
    const profile: CollectedData = { desired_salary: 'от 400 000 ₽' };
    const result = matchSalaryExpectation(job, profile);
    expect(result.points).toBeLessThan(0);
    expect(result.hardMismatch).toBe(true);
  });
});
