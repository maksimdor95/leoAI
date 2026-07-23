import { buildProfileEmbeddingText } from '../profileEmbedding';
import { ENRICHED_COLLECTED_KEY } from '../../types/enrichedProfile';

describe('profileEmbedding', () => {
  it('builds compact text from role, skills, summary and exclusions', () => {
    const text = buildProfileEmbeddingText({
      desired_role: 'Head of Product',
      careerSummary: '15 лет в продукте',
      skills_hard: 'SQL, Agile',
      additional_info: 'убери ВТБ',
      [ENRICHED_COLLECTED_KEY]: {
        version: 1,
        enrichedAt: new Date().toISOString(),
        source: 'resume_import',
        job_preferences: { domains: ['product'], red_flags: ['ВТБ'] },
        normalized_skills: [{ name: 'product management', source: 'chat' }],
      },
    });

    expect(text).toContain('Head of Product');
    expect(text).toContain('SQL');
    expect(text).toContain('ВТБ');
    expect(text).toContain('product');
  });
});
