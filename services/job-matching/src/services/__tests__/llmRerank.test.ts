import { applyLlmRerankDeltas } from '../llmRerank';
import type { MatchingScore } from '../matcher';
import type { Job } from '../../models/job';

function mkMatch(id: string, score: number, company = 'ACME'): MatchingScore {
  const job = {
    id,
    title: 'Product Manager',
    company,
    location: ['Москва'],
    salary_min: null,
    salary_max: null,
    currency: 'RUR',
    description: '',
    requirements: '',
    skills: [],
    experience_level: 'senior',
    work_mode: null,
    source_meta: null,
    source: 'hh.ru',
    source_url: 'https://example.com',
    role_family: 'product',
    posted_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  } as Job;

  return {
    job,
    score,
    reasons: ['base'],
    jobFamily: 'product',
    familyMatch: 'same',
  };
}

describe('llmRerank applyLlmRerankDeltas', () => {
  it('reorders by score+delta and prepends AI explain', () => {
    const matches = [mkMatch('a', 90, 'СБЕР'), mkMatch('b', 88, 'Яндекс')];
    const out = applyLlmRerankDeltas(matches, [
      { id: 'a', delta: -8, explain: 'Банк не подходит по исключениям' },
      { id: 'b', delta: 5, explain: 'Сильный product/SaaS fit' },
    ]);

    expect(out[0].job.id).toBe('b');
    expect(out[0].score).toBe(93);
    expect(out[0].reasons[0]).toContain('AI:');
    expect(out[1].job.id).toBe('a');
    expect(out[1].score).toBe(82);
  });

  it('clamps delta and keeps missing ids unchanged', () => {
    const matches = [mkMatch('a', 50)];
    const out = applyLlmRerankDeltas(matches, [{ id: 'a', delta: 100 }]);
    expect(out[0].score).toBe(62); // +12 clamp
  });
});
