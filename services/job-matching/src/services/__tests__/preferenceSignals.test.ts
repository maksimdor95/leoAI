import { Job } from '../../models/job';
import { ENRICHED_COLLECTED_KEY } from '../../types/enrichedProfile';
import {
  findProfileCompanyExclusion,
  scoreDomainAffinity,
} from '../preferenceSignals';
import { CollectedData } from '../userService';
import { getDemoteReasons } from '../matchNoise';
import { matchJobs } from '../matcher';

function mkJob(partial: Partial<Job>): Job {
  return {
    id: partial.id ?? 'job-1',
    title: partial.title ?? 'Product Manager',
    company: partial.company ?? 'ACME',
    location: partial.location ?? ['Москва'],
    salary_min: partial.salary_min ?? null,
    salary_max: partial.salary_max ?? null,
    currency: partial.currency ?? 'RUR',
    description: partial.description ?? '',
    requirements: partial.requirements ?? '',
    skills: partial.skills ?? [],
    experience_level: partial.experience_level ?? 'senior',
    work_mode: partial.work_mode ?? null,
    source_meta: partial.source_meta ?? null,
    source: partial.source ?? 'hh.ru',
    source_url: partial.source_url ?? 'https://example.com/job',
    role_family: partial.role_family ?? 'product',
    posted_at: partial.posted_at ?? new Date(),
    created_at: partial.created_at ?? new Date(),
    updated_at: partial.updated_at ?? new Date(),
  };
}

describe('preferenceSignals layer 1', () => {
  it('excludes banks via additional_info', () => {
    const profile: CollectedData = { additional_info: 'не рассматриваю банки' };
    expect(findProfileCompanyExclusion(mkJob({ company: 'СБЕР' }), profile)?.label).toBe(
      'банки'
    );
  });

  it('excludes banks via __enriched.red_flags', () => {
    const profile: CollectedData = {
      [ENRICHED_COLLECTED_KEY]: {
        version: 1,
        enrichedAt: new Date().toISOString(),
        source: 'resume_import',
        job_preferences: { red_flags: ['банки'] },
      },
    };
    expect(
      findProfileCompanyExclusion(mkJob({ company: 'Банк ВТБ (ПАО)' }), profile)?.label
    ).toBe('банки');
    expect(findProfileCompanyExclusion(mkJob({ company: 'Яндекс' }), profile)).toBeNull();
  });

  it('boosts domain affinity for product/SaaS experience', () => {
    const profile: CollectedData = {
      position_1_industry: 'B2B SaaS',
      [ENRICHED_COLLECTED_KEY]: {
        version: 1,
        enrichedAt: new Date().toISOString(),
        source: 'jack-profile-v2',
        job_preferences: { domains: ['product', 'saas'] },
      },
    };
    const saasJob = mkJob({
      company: 'Acme SaaS',
      title: 'Head of Product',
      description: 'B2B SaaS product platform for enterprise',
    });
    const bankJob = mkJob({
      company: 'СБЕР',
      title: 'Product Manager',
      description: 'Банковские продукты для розницы',
    });
    expect(scoreDomainAffinity(saasJob, profile).points).toBeGreaterThan(0);
    // bank still matches "product" needle — affinity can be positive; exclusion is separate
    expect(scoreDomainAffinity(bankJob, profile).points).toBeGreaterThanOrEqual(-4);
  });

  it('demotes Sber from recommended when red_flags say банки', () => {
    const job = mkJob({
      company: 'СБЕР',
      title: 'Product Manager (TagMe)',
      description: 'Продукт в экосистеме банка',
      skills: ['product', 'agile', 'sql'],
    });
    const profile: CollectedData = {
      desiredRole: 'Head of Product',
      desired_role: 'Head of Product',
      totalExperience: 15,
      skills: ['product', 'agile', 'sql'],
      location: ['Москва'],
      [ENRICHED_COLLECTED_KEY]: {
        version: 1,
        enrichedAt: new Date().toISOString(),
        source: 'resume_import',
        role_family: 'product',
        seniority: 'lead',
        job_preferences: { red_flags: ['банки'], domains: ['product'] },
      },
    };
    const codes = getDemoteReasons(job, profile, 'lead', 'senior', false);
    expect(codes).toContain('company_exclusion');

    const res = matchJobs([job, mkJob({ id: 'y', company: 'Яндекс', title: 'Head of Product', description: 'Product SaaS', skills: ['product', 'agile'] })], profile);
    const sberInRec = res.matches.find((m) => m.job.company === 'СБЕР');
    expect(sberInRec).toBeUndefined();
  });
});
