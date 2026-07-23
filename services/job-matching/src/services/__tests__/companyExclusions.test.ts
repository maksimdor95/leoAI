import { Job } from '../../models/job';
import {
  findMatchingCompanyExclusion,
  parseCompanyExclusions,
} from '../companyExclusions';
import { CollectedData } from '../userService';
import { getDemoteReasons } from '../matchNoise';

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

describe('companyExclusions', () => {
  it('parses «не рассматриваю банки» from additional_info', () => {
    const rules = parseCompanyExclusions({
      additional_info: 'не рассматриваю банки',
    });
    expect(rules).toHaveLength(1);
    expect(rules[0].label).toBe('банки');
  });

  it('matches Sber / VTB / Domclick when banks excluded', () => {
    const profile: CollectedData = { additional_info: 'не рассматриваю банки' };
    expect(findMatchingCompanyExclusion(mkJob({ company: 'СБЕР' }), profile)?.label).toBe(
      'банки'
    );
    expect(
      findMatchingCompanyExclusion(mkJob({ company: 'Банк ВТБ (ПАО)' }), profile)?.label
    ).toBe('банки');
    expect(findMatchingCompanyExclusion(mkJob({ company: 'Домклик' }), profile)?.label).toBe(
      'банки'
    );
    expect(findMatchingCompanyExclusion(mkJob({ company: 'Яндекс' }), profile)).toBeNull();
  });

  it('demotes bank jobs from recommended when excluded', () => {
    const job = mkJob({ company: 'СБЕР', title: 'Product Manager (TagMe)' });
    const profile: CollectedData = {
      desiredRole: 'Head of Product',
      totalExperience: 15,
      additional_info: 'не рассматриваю банки',
    };
    const codes = getDemoteReasons(job, profile, 'lead', 'senior', false);
    expect(codes).toContain('company_exclusion');
  });

  it('parses «убери ВТБ» as named company exclusion only', () => {
    const rules = parseCompanyExclusions({
      additional_info: 'убери ВТБ',
    });
    expect(rules.some((r) => r.label === 'ВТБ')).toBe(true);
    expect(rules.some((r) => r.label === 'банки')).toBe(false);

    const vtb = mkJob({ company: 'Банк ВТБ (ПАО)' });
    const sber = mkJob({ company: 'СБЕР' });
    expect(findMatchingCompanyExclusion(vtb, { additional_info: 'убери ВТБ' })?.label).toBe(
      'ВТБ'
    );
    expect(findMatchingCompanyExclusion(sber, { additional_info: 'убери ВТБ' })).toBeNull();
  });
});
