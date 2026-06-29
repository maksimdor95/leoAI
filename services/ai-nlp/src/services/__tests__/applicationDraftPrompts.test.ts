import {
  APPLICATION_DRAFT_PROMPT_VERSION,
  buildApplicationDraftPrompt,
  parseApplicationDraftJson,
} from '../applicationDraftPrompts';

describe('applicationDraftPrompts', () => {
  it('parses coverLetter-only json', () => {
    const result = parseApplicationDraftJson(
      '{"coverLetter":"7 лет в FinTech — запускал B2B-продукты. Готов обсудить детали."}',
      { headline: 'fallback', coverLetter: 'fallback letter', bullets: ['x'] }
    );

    expect(result.coverLetter).toContain('FinTech');
    expect(result.headline).toBe('');
    expect(result.bullets).toEqual([]);
  });

  it('builds prompt with job and profile context', () => {
    const { system, user } = buildApplicationDraftPrompt({
      collectedData: { desired_role: 'Product Owner', totalExperience: 8 },
      job: {
        title: 'Technical Product Owner',
        company: 'Units',
        description: 'Банковские платформы',
        skills: ['Jira'],
      },
      tone: 'formal',
      matchHighlights: ['Match по навыкам'],
    });

    expect(system).toContain('coverLetter');
    expect(system).toContain('Меня заинтересовала вакансия');
    expect(user).toContain('Technical Product Owner');
    expect(user).toContain('Product Owner');
    expect(user).toContain('Match по навыкам');
    expect(APPLICATION_DRAFT_PROMPT_VERSION).toBe('application-draft-v2');
  });

  it('includes human tone hint in system prompt', () => {
    const { system } = buildApplicationDraftPrompt({
      collectedData: { desired_role: 'PM' },
      job: { title: 'PM', company: 'Acme' },
      tone: 'human',
    });
    expect(system).toContain('живой тон');
  });
});
