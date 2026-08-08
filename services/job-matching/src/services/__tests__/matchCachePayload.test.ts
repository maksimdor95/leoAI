import {
  buildMatchCacheKey,
  hashMatchProfile,
} from '../matchCache';
import {
  MATCH_RETURN_RECOMMENDED_MAX,
  MATCH_RETURN_WEAK_MAX,
  slimJobForMatchResponse,
  stripJobEmbeddings,
} from '../matchPayload';
import type { Job } from '../../models/job';

describe('matchCache hashing', () => {
  it('ignores embedding fields in profile hash', () => {
    const a = hashMatchProfile({ desiredRole: 'PO', embedding: [1, 2, 3] });
    const b = hashMatchProfile({ desiredRole: 'PO', embedding: [9, 9, 9] });
    expect(a).toBe(b);
  });

  it('changes when profile content changes', () => {
    const a = hashMatchProfile({ desiredRole: 'PO' });
    const b = hashMatchProfile({ desiredRole: 'PM' });
    expect(a).not.toBe(b);
  });

  it('builds stable cache key', () => {
    const key = buildMatchCacheKey({
      userId: 'u1',
      sessionId: 's1',
      profileHash: 'abc',
      catalog: { jobsInDb: 100, maxUpdatedAt: '2026-01-01T00:00:00.000Z' },
    });
    expect(key).toContain('match:v1:u1:s1:abc:');
  });
});

describe('matchPayload memory mitigations', () => {
  it('strips embeddings in place', () => {
    const jobs = [{ id: '1', embedding: [0.1, 0.2] } as Job];
    stripJobEmbeddings(jobs);
    expect(jobs[0].embedding).toBeUndefined();
  });

  it('slims description/requirements and omits embedding', () => {
    const job = {
      id: '1',
      title: 'PO',
      company: 'X',
      location: ['Москва'],
      salary_min: null,
      salary_max: null,
      currency: 'RUR',
      description: 'x'.repeat(5000),
      requirements: 'y'.repeat(2000),
      skills: Array.from({ length: 40 }, (_, i) => `s${i}`),
      experience_level: 'senior',
      work_mode: null,
      source_meta: null,
      source: 'hh.ru',
      source_url: 'https://example.com',
      role_family: 'product',
      posted_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      embedding: [1, 2, 3],
    } as Job;

    const slim = slimJobForMatchResponse(job);
    expect(slim.embedding).toBeUndefined();
    expect(String(slim.description).length).toBeLessThanOrEqual(600);
    expect(String(slim.requirements).length).toBeLessThanOrEqual(400);
    expect((slim.skills as string[]).length).toBeLessThanOrEqual(24);
  });

  it('caps return limits to sane defaults', () => {
    expect(MATCH_RETURN_RECOMMENDED_MAX).toBeLessThanOrEqual(500);
    expect(MATCH_RETURN_WEAK_MAX).toBeLessThanOrEqual(300);
    expect(MATCH_RETURN_RECOMMENDED_MAX).toBeGreaterThanOrEqual(20);
  });
});
