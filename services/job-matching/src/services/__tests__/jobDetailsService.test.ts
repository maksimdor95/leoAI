import { Job } from '../../models/job';
import {
  buildJobDetailsPayload,
  isJobStale,
  JOB_STALE_DAYS,
} from '../jobDetailsService';

function makeJob(partial: Partial<Job> = {}): Job {
  const now = new Date();
  return {
    id: 'job-1',
    title: 'Product Owner',
    company: 'Acme',
    location: ['Москва'],
    salary_min: 200000,
    salary_max: 300000,
    currency: 'RUR',
    description: '<p>Описание</p>',
    requirements: 'Опыт 3+ года',
    skills: ['Agile'],
    experience_level: 'middle',
    work_mode: 'hybrid',
    source_meta: null,
    source: 'hh.ru',
    source_url: 'https://hh.ru/vacancy/12345678',
    role_family: 'product',
    posted_at: now,
    created_at: now,
    updated_at: now,
    ...partial,
  };
}

describe('jobDetailsService', () => {
  it('marks job as stale when updated_at is old', () => {
    const old = new Date(Date.now() - (JOB_STALE_DAYS + 1) * 24 * 60 * 60 * 1000);
    expect(isJobStale(old)).toBe(true);
    expect(isJobStale(new Date())).toBe(false);
  });

  it('builds enriched job details payload', () => {
    const payload = buildJobDetailsPayload(makeJob());
    expect(payload.externalVacancyId).toBe('12345678');
    expect(payload.publicUrl).toBe('https://hh.ru/vacancy/12345678');
    expect(payload.stale).toBe(false);
    expect(payload.conditions).toBeNull();
    expect(payload.job.title).toBe('Product Owner');
  });

  it('returns null external id for demo jobs', () => {
    const payload = buildJobDetailsPayload(
      makeJob({ source: 'demo', source_url: 'demo://leo-ai/mock/1' })
    );
    expect(payload.externalVacancyId).toBeNull();
    expect(payload.publicUrl).toBeNull();
  });
});
