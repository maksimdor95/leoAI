import { Job } from '../../models/job';
import {
  detectSalesChannel,
  getDemoteReasons,
  isAspirationalRoleGap,
  isSeniorityTierNoise,
  isThinProfile,
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
    source_meta: partial.source_meta ?? null,
    source: partial.source ?? 'hh.ru',
    source_url: partial.source_url ?? 'https://example.com/job',
    role_family: partial.role_family ?? null,
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

  it('detects thin profile without totalExperience', () => {
    expect(isThinProfile({ desiredRole: 'Head of Product' })).toBe(true);
    expect(isThinProfile({ totalExperience: 5 })).toBe(false);
  });

  it('treats higher-level same-family job as aspirational', () => {
    expect(isAspirationalRoleGap('middle', 'lead')).toBe(true);
    expect(isAspirationalRoleGap('lead', 'middle')).toBe(false);
  });

  it('does not demote aspirational Head of Product for middle PM at high score', () => {
    const job = mkJob({
      title: 'Head of Product',
      experience_level: 'lead',
    });
    const profile: CollectedData = {
      desiredRole: 'Head of Product / Group Product Manager',
      totalExperience: 5,
    };

    const reasons = getDemoteReasons(job, profile, 'middle', 'lead', false, {
      familyMatch: 'same',
      score: 53,
      thinProfile: false,
    });

    expect(reasons).not.toContain('seniority_mismatch');
    expect(shouldDemoteFromRecommended(job, profile, 'middle', 'lead', false, {
      familyMatch: 'same',
      score: 53,
    })).toBe(false);
  });

  it('still demotes aspirational role on salary hard mismatch', () => {
    const job = mkJob({
      title: 'Head of Product',
      experience_level: 'lead',
      salary_min: 120_000,
      salary_max: 150_000,
    });
    const profile: CollectedData = {
      desiredRole: 'Head of Product',
      totalExperience: 5,
      desired_salary: 'от 400 000 ₽',
    };

    const reasons = getDemoteReasons(job, profile, 'middle', 'lead', true, {
      familyMatch: 'same',
      score: 55,
    });

    expect(reasons).toContain('salary_below_expectation');
    expect(shouldDemoteFromRecommended(job, profile, 'middle', 'lead', true, {
      familyMatch: 'same',
      score: 55,
    })).toBe(true);
  });

  it('skips seniority demote for thin profile at same family and score >= 50', () => {
    const job = mkJob({
      title: 'Senior Product Manager',
      experience_level: 'senior',
    });
    const profile: CollectedData = {
      desiredRole: 'Senior Product Manager',
    };

    const reasons = getDemoteReasons(job, profile, 'junior', 'senior', false, {
      familyMatch: 'same',
      score: 52,
      thinProfile: true,
    });

    expect(reasons).not.toContain('seniority_mismatch');
  });

  it('always demotes underleveled junior for lead/senior even at high same-family score', () => {
    const job = mkJob({
      title: 'Junior Product Manager',
      experience_level: 'junior',
    });
    const profile: CollectedData = {
      desiredRole: 'Head of Product / Product Lead / CPO',
      totalExperience: 12,
    };

    const reasons = getDemoteReasons(job, profile, 'lead', 'junior', false, {
      familyMatch: 'same',
      score: 86,
      thinProfile: false,
    });

    expect(reasons).toContain('seniority_mismatch');
    expect(
      shouldDemoteFromRecommended(job, profile, 'lead', 'junior', false, {
        familyMatch: 'same',
        score: 86,
      })
    ).toBe(true);
  });

  it('does not skip underleveled demote for thin profile', () => {
    const job = mkJob({
      title: 'Junior Product manager',
      experience_level: 'junior',
    });
    const profile: CollectedData = {
      desiredRole: 'Head of Product',
    };

    const reasons = getDemoteReasons(job, profile, 'senior', 'junior', false, {
      familyMatch: 'same',
      score: 80,
      thinProfile: true,
    });

    expect(reasons).toContain('seniority_mismatch');
  });
});
