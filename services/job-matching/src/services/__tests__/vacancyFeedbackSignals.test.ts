import { Job } from '../../models/job';
import { CollectedData } from '../userService';
import { getDemoteReasons } from '../matchNoise';
import { matchJobs } from '../matcher';
import {
  findVacancyFeedbackDemotion,
  normalizeCompanyKey,
  scoreVacancyFeedbackLike,
} from '../vacancyFeedbackSignals';

function mkJob(partial: Partial<Job>): Job {
  return {
    id: partial.id ?? `job-${Math.random().toString(36).slice(2, 9)}`,
    title: partial.title ?? 'Untitled',
    company: partial.company ?? 'ACME',
    location: partial.location ?? ['Москва'],
    salary_min: partial.salary_min ?? null,
    salary_max: partial.salary_max ?? null,
    currency: partial.currency ?? 'RUR',
    description: partial.description ?? 'Product management, roadmap, analytics',
    requirements: partial.requirements ?? 'Product, analytics, stakeholder management',
    skills: partial.skills ?? ['product', 'analytics'],
    experience_level: partial.experience_level ?? 'middle',
    work_mode: partial.work_mode ?? 'remote',
    source_meta: partial.source_meta ?? null,
    source: partial.source ?? 'hh.ru',
    source_url: partial.source_url ?? 'https://example.com/job',
    role_family: partial.role_family ?? 'product',
    posted_at: partial.posted_at ?? new Date(),
    created_at: partial.created_at ?? new Date(),
    updated_at: partial.updated_at ?? new Date(),
  };
}

describe('vacancyFeedbackSignals', () => {
  const baseProfile: CollectedData = {
    desiredRole: 'Product Manager',
    totalExperience: 5,
    location: ['Москва'],
    workMode: 'remote',
    skills: ['product', 'analytics'],
  };

  it('normalizes company keys', () => {
    expect(normalizeCompanyKey('  Яндекс  ')).toBe('яндекс');
  });

  it('demotes disliked job id', () => {
    const job = mkJob({ id: 'job-1', title: 'PM', company: 'Acme' });
    const data: CollectedData = {
      ...baseProfile,
      vacancyFeedback: {
        likedJobIds: [],
        dislikedJobIds: ['job-1'],
        dislikedCompanies: [],
        likedCompanies: [],
      },
    };
    expect(findVacancyFeedbackDemotion(job, data)?.kind).toBe('job');
    const codes = getDemoteReasons(job, data, 'middle', 'middle', false);
    expect(codes).toContain('company_exclusion');
  });

  it('demotes disliked company out of recommended', () => {
    const liked = mkJob({
      id: 'ok-1',
      title: 'Senior Product Manager',
      company: 'Ozon',
      experience_level: 'senior',
    });
    const disliked = mkJob({
      id: 'bad-1',
      title: 'Senior Product Manager',
      company: 'ВТБ',
      experience_level: 'senior',
    });
    const data: CollectedData = {
      ...baseProfile,
      vacancyFeedback: {
        likedJobIds: [],
        dislikedJobIds: [],
        dislikedCompanies: ['втб'],
        likedCompanies: [],
      },
    };

    const result = matchJobs([liked, disliked], data);
    const recommendedIds = result.matches.map((item) => item.job.id);
    expect(recommendedIds).toContain('ok-1');
    expect(recommendedIds).not.toContain('bad-1');
  });

  it('boosts liked company score', () => {
    const job = mkJob({
      id: 'like-1',
      title: 'Product Manager',
      company: 'Яндекс',
    });
    const without: CollectedData = { ...baseProfile };
    const withLike: CollectedData = {
      ...baseProfile,
      vacancyFeedback: {
        likedJobIds: ['like-1'],
        dislikedJobIds: [],
        dislikedCompanies: [],
        likedCompanies: ['яндекс'],
      },
    };

    const boost = scoreVacancyFeedbackLike(job, withLike);
    expect(boost.points).toBeGreaterThanOrEqual(6);

    const plain = matchJobs([job], without);
    const boosted = matchJobs([job], withLike);
    const plainScore = plain.matches[0]?.score ?? plain.weakMatches[0]?.score ?? 0;
    const boostedScore = boosted.matches[0]?.score ?? boosted.weakMatches[0]?.score ?? 0;
    expect(boostedScore).toBeGreaterThan(plainScore);
  });
});