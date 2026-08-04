/**
 * Phase next: cross-source dedup prefers career site over HH.
 */

import {
  dedupeMatchEntries,
  dedupeMatchTiers,
  jobFingerprint,
  normalizeCompanyName,
  sourcePriority,
} from '../jobDedup';
import type { Job } from '../../models/job';

function job(partial: Partial<Job> & Pick<Job, 'id' | 'title' | 'company' | 'source'>): Job {
  return {
    location: [],
    salary_min: null,
    salary_max: null,
    currency: null,
    description: '',
    requirements: '',
    skills: [],
    experience_level: null,
    work_mode: null,
    source_meta: null,
    source_url: `https://example.com/${partial.id}`,
    role_family: 'product',
    posted_at: null,
    created_at: new Date('2026-08-01T00:00:00Z'),
    updated_at: new Date('2026-08-01T00:00:00Z'),
    ...partial,
  };
}

describe('jobDedup', () => {
  it('normalizes Sber variants into one company key', () => {
    expect(normalizeCompanyName('СБЕР')).toBe(normalizeCompanyName('ПАО Сбербанк'));
  });

  it('fingerprints identical PO titles across sources', () => {
    const hh = job({
      id: '1',
      title: 'Product Owner (B2B, Эквайринг, AI-ассистент)',
      company: 'СБЕР',
      source: 'hh.ru',
    });
    const career = job({
      id: '2',
      title: 'Product Owner (B2B, Эквайринг, AI-ассистент)',
      company: 'ПАО Сбербанк',
      source: 'career_sber',
    });
    expect(jobFingerprint(hh)).toBe(jobFingerprint(career));
    expect(sourcePriority('career_sber')).toBeGreaterThan(sourcePriority('hh.ru'));
  });

  it('keeps career_sber over hh.ru at equal score', () => {
    const title = 'Product Owner (B2B, Эквайринг, AI-ассистент)';
    const entries = [
      { job: job({ id: 'hh', title, company: 'СБЕР', source: 'hh.ru' }), score: 92 },
      {
        job: job({ id: 'sber', title, company: 'ПАО Сбербанк', source: 'career_sber' }),
        score: 92,
      },
    ];
    const out = dedupeMatchEntries(entries);
    expect(out).toHaveLength(1);
    expect(out[0].job.source).toBe('career_sber');
  });

  it('removes weak duplicate when recommended already has fingerprint', () => {
    const title = 'Product Owner AI';
    const recommended = [
      {
        job: job({ id: 'sber', title, company: 'Сбер', source: 'career_sber' }),
        score: 92,
      },
    ];
    const weak = [
      { job: job({ id: 'hh', title, company: 'СБЕР', source: 'hh.ru' }), score: 40 },
    ];
    const out = dedupeMatchTiers(recommended, weak);
    expect(out.recommended).toHaveLength(1);
    expect(out.weak).toHaveLength(0);
  });
});
