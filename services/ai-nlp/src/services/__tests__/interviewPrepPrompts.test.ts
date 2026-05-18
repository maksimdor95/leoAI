import {
  buildGradingRubric,
  buildInterviewSystemMessage,
  buildLanguageInstruction,
  buildModePrompt,
  buildPrepPlanPrompt,
  buildRolePackModePrompt,
  buildRolePackRubric,
  buildRespondPrompt,
  inferRoleTrack,
  inferSeniority,
  parseJsonObject,
  resolveInterviewLanguage,
} from '../interviewPrepPrompts';

describe('interviewPrepPrompts', () => {
  it('parses fenced json returned by the model', () => {
    const result = parseJsonObject<{ profile: { role: string } }>(
      '```json\n{"profile":{"role":"Product Manager"}}\n```',
      { profile: { role: 'fallback' } }
    );

    expect(result.profile.role).toBe('Product Manager');
  });

  it('returns fallback for invalid json', () => {
    const result = parseJsonObject('not json', { ok: false });

    expect(result).toEqual({ ok: false });
  });

  it('infers product/business track from vacancy profile', () => {
    const track = inferRoleTrack({
      role: 'Senior Product Manager',
      requirements: ['roadmap ownership', 'retention metrics'],
    });

    expect(track).toBe('product_business');
  });

  it('infers engineering track from technical vacancy profile', () => {
    const track = inferRoleTrack({
      role: 'Backend Engineer',
      stack: ['distributed systems', 'api', 'platform'],
    });

    expect(track).toBe('engineering_systems');
  });

  it('infers seniority from profile level', () => {
    expect(inferSeniority({ level: 'Senior' })).toBe('senior');
    expect(inferSeniority({ role: 'Lead Product Manager' })).toBe('lead');
  });

  it('builds mode prompt with case-specific protocol', () => {
    expect(buildModePrompt('case')).toContain('Give one case at a time');
    expect(buildGradingRubric('star')).toContain('STAR answers');
  });

  it('builds PM role pack overlays for product interviews', () => {
    const profile = {
      role: 'Senior Product Manager',
      requirements: ['roadmap ownership', 'experimentation'],
    };

    expect(buildRolePackModePrompt('case', profile)).toContain('PM/Product Role Pack: Case');
    expect(buildRolePackRubric('mock', profile)).toContain('PM/Product Role Pack Rubric');
  });

  it('builds Analytics role pack overlays for analytics interviews', () => {
    const profile = {
      role: 'Senior Product Analyst',
      requirements: ['ab-test design', 'sql', 'causal reasoning'],
    };

    expect(buildRolePackModePrompt('case', profile)).toContain('Analytics/Data Role Pack: Case');
    expect(buildRolePackRubric('mock', profile)).toContain('Analytics/Data Role Pack Rubric');
  });

  it('defaults interview language to Russian', () => {
    expect(resolveInterviewLanguage({ interviewLanguage: 'unknown' })).toBe('ru');
    expect(resolveInterviewLanguage({ interviewLanguage: 'en' })).toBe('en');
    expect(buildLanguageInstruction()).toContain('MUST be in Russian');
  });

  it('builds strict trainer system prompt with anti-water rules', () => {
    const systemMessage = buildInterviewSystemMessage('mock', {
      role: 'Senior Product Manager',
      level: 'Senior',
    });

    expect(systemMessage.text).toContain('strict, fair');
    expect(systemMessage.text).toContain('MUST be in Russian');
    expect(systemMessage.text).toContain('Anti-Water Rules');
    expect(systemMessage.text).toContain('Seniority Expectations');
    expect(systemMessage.text).toContain('PM/Product Role Pack');
  });

  it('builds analytics-aware system prompt for data profile', () => {
    const systemMessage = buildInterviewSystemMessage('mock', {
      role: 'Senior Data Analyst',
      requirements: ['causal inference', 'sql'],
    });

    expect(systemMessage.text).toContain('Analytics/Data Core Expectations');
    expect(systemMessage.text).toContain('Analytics/Data Role Pack');
  });

  it('builds respond prompt using grading and history', () => {
    const prompt = buildRespondPrompt({
      mode: 'mock',
      userMessage: 'Я бы начал с сегментации пользователей и baseline метрик.',
      conversationHistory: [{ role: 'assistant', content: 'Как ты оценишь успех?' }],
      grading: {
        overallScore: 6,
        dimensionScores: {
          structure: 6,
          depth: 5,
          metrics: 4,
          tradeOffs: 4,
          communication: 7,
          seniorityFit: 5,
        },
        fatalGaps: ['Нет явных trade-offs'],
        strengths: ['Есть структура'],
        improvements: ['Добавь ограничения'],
        followUpToProbe: 'Какие альтернативы ты бы рассмотрел?',
        modelStructure: ['Контекст', 'Решение', 'Trade-offs'],
      },
    });

    expect(prompt.text).toContain('Previous answer grading');
    expect(prompt.text).toContain('Какие альтернативы ты бы рассмотрел?');
    expect(prompt.text).toContain('Conversation history');
  });

  it('injects PM-specific coaching instruction into respond prompt', () => {
    const prompt = buildRespondPrompt({
      mode: 'case',
      userMessage: 'Я бы улучшил onboarding и в целом engagement.',
      vacancyProfile: { role: 'Product Manager', level: 'Senior' },
    });

    expect(prompt.text).toContain('PM/Product role pack is active');
  });

  it('injects analytics-specific coaching instruction into respond prompt', () => {
    const prompt = buildRespondPrompt({
      mode: 'case',
      userMessage: 'Я бы посмотрел на retention и сделал выводы.',
      vacancyProfile: { role: 'Product Analyst', level: 'Senior' },
    });

    expect(prompt.text).toContain('Analytics/Data role pack is active');
  });

  it('asks for Russian prep plan tasks by default', () => {
    const prompt = buildPrepPlanPrompt({
      vacancyProfile: { role: 'Product Manager', interviewLanguage: 'ru' },
      availableDays: 5,
    });

    expect(prompt.text).toContain('Write focus and every task in Russian');
  });
});
