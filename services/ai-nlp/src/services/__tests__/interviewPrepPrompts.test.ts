import {
  buildGradingRubric,
  buildInterviewSystemMessage,
  buildLanguageInstruction,
  buildModePrompt,
  buildPrepPlanPrompt,
  buildPrepPlanSeniorityBlock,
  buildRolePackModePrompt,
  buildRolePackRubric,
  buildRespondPrompt,
  buildSeniorityIntensityPrompt,
  inferRoleTrack,
  inferSeniority,
  parseJsonObject,
  resolveInterviewLanguage,
  resolveInterviewSeniority,
} from '../interviewPrepPrompts';
import {
  buildCoachPersona,
  buildPhaseRespondPrompt,
  buildPhaseSystemMessage,
  buildRescueProtocol,
} from '../interviewPrepPhasePrompts';

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

  it('infers QA track before generic engineering keywords', () => {
    expect(
      inferRoleTrack({
        role: 'QA Engineer',
        requirements: ['test automation', 'selenium'],
      })
    ).toBe('qa_quality');

    expect(
      inferRoleTrack({
        role: 'SDET',
        stack: ['playwright', 'ci/cd'],
      })
    ).toBe('qa_quality');

    expect(
      inferRoleTrack({
        role: 'Инженер по тестированию',
        responsibilities: ['регресс', 'автотесты'],
      })
    ).toBe('qa_quality');
  });

  it('builds Engineering role pack overlays for developer interviews', () => {
    const profile = {
      role: 'Senior Backend Engineer',
      stack: ['distributed systems', 'postgresql', 'kafka'],
    };

    expect(buildRolePackModePrompt('case', profile)).toContain('Engineering/Systems Role Pack: Case');
    expect(buildRolePackRubric('mock', profile)).toContain('Engineering/Systems Role Pack Rubric');

    const systemMessage = buildInterviewSystemMessage('mock', profile);
    expect(systemMessage.text).toContain('Engineering/Systems Core Expectations');
    expect(systemMessage.text).toContain('Engineering/Systems Role Pack');
  });

  it('builds QA role pack overlays for testing interviews', () => {
    const profile = {
      role: 'QA Lead',
      requirements: ['test strategy', 'risk-based testing'],
    };

    expect(buildRolePackModePrompt('case', profile)).toContain('QA/Testing Role Pack: Case');
    expect(buildRolePackRubric('mock', profile)).toContain('QA/Testing Role Pack Rubric');

    const prompt = buildRespondPrompt({
      mode: 'case',
      userMessage: 'Я проверю все сценарии вручную.',
      vacancyProfile: profile,
    });
    expect(prompt.text).toContain('QA/Testing role pack is active');
  });

  it('infers sales and operations tracks', () => {
    expect(
      inferRoleTrack({
        role: 'Account Executive',
        requirements: ['pipeline', 'quota'],
      })
    ).toBe('sales_commercial');

    expect(
      inferRoleTrack({
        role: 'SDR',
        responsibilities: ['outbound', 'discovery calls'],
      })
    ).toBe('sales_commercial');

    expect(
      inferRoleTrack({
        role: 'Project Manager',
        requirements: ['scrum', 'risk management', 'stakeholders'],
      })
    ).toBe('operations_delivery');

    expect(
      inferRoleTrack({
        role: 'Scrum Master',
        responsibilities: ['delivery', 'retrospectives'],
      })
    ).toBe('operations_delivery');
  });

  it('builds Sales role pack overlays for commercial interviews', () => {
    const profile = {
      role: 'Account Executive',
      requirements: ['discovery', 'objection handling', 'quota'],
    };

    expect(buildRolePackModePrompt('mock', profile)).toContain('Sales/Commercial Role Pack: Mock');
    expect(buildRolePackModePrompt('mock', profile)).toContain('role-play');
    expect(buildRolePackRubric('star', profile)).toContain('Sales/Commercial Role Pack Rubric');

    const prompt = buildRespondPrompt({
      mode: 'mock',
      userMessage: 'Я бы сразу рассказал про все функции продукта.',
      vacancyProfile: profile,
    });
    expect(prompt.text).toContain('Sales/Commercial role pack is active');
  });

  it('builds Operations role pack overlays for delivery interviews', () => {
    const profile = {
      role: 'Project Manager',
      requirements: ['dependencies', 'risk management', 'stakeholder communication'],
    };

    expect(buildRolePackModePrompt('case', profile)).toContain('Operations/Delivery Role Pack: Case');
    expect(buildRolePackRubric('mock', profile)).toContain('Operations/Delivery Role Pack Rubric');

    const systemMessage = buildInterviewSystemMessage('case', profile);
    expect(systemMessage.text).toContain('Operations/Delivery Core Expectations');
    expect(systemMessage.text).toContain('Operations/Delivery Role Pack');
  });

  it('infers design and leadership tracks', () => {
    expect(inferRoleTrack({ role: 'Senior Product Designer', requirements: ['figma', 'usability'] })).toBe(
      'design_ux'
    );
    expect(inferRoleTrack({ role: 'Director of Engineering', requirements: ['hiring', 'org design'] })).toBe(
      'leadership_behavioral'
    );
  });

  it('builds Design role pack overlays', () => {
    const profile = { role: 'UX Designer', requirements: ['user research', 'usability testing'] };
    expect(buildRolePackModePrompt('case', profile)).toContain('Design/UX Role Pack: Case');
    expect(buildRolePackRubric('mock', profile)).toContain('Design/UX Role Pack Rubric');
  });

  it('builds Leadership role pack overlays', () => {
    const profile = { role: 'Engineering Director', requirements: ['hiring', 'stakeholder management'] };
    expect(buildRolePackModePrompt('mock', profile)).toContain('Leadership/Behavioral Role Pack: Mock');
    expect(buildRolePackRubric('star', profile)).toContain('Leadership/Behavioral Role Pack Rubric');

    const prompt = buildRespondPrompt({
      mode: 'star',
      userMessage: 'Мы в целом улучшили процессы в команде.',
      vacancyProfile: profile,
    });
    expect(prompt.text).toContain('Leadership/Behavioral role pack is active');
  });

  it('infers marketing, customer success, and HR tracks', () => {
    expect(
      inferRoleTrack({ role: 'Growth Marketing Manager', requirements: ['paid media', 'attribution'] })
    ).toBe('marketing_growth');

    expect(
      inferRoleTrack({ role: 'Customer Success Manager', requirements: ['onboarding', 'churn'] })
    ).toBe('customer_success');

    expect(
      inferRoleTrack({ role: 'Technical Recruiter', requirements: ['sourcing', 'talent acquisition'] })
    ).toBe('hr_people');
  });

  it('builds Marketing role pack overlays', () => {
    const profile = { role: 'Performance Marketing Manager', requirements: ['cac', 'roas'] };
    expect(buildRolePackModePrompt('case', profile)).toContain('Marketing/Growth Role Pack: Case');
    expect(buildRolePackRubric('mock', profile)).toContain('Marketing/Growth Role Pack Rubric');
  });

  it('builds Customer Success and HR role pack overlays', () => {
    const csProfile = { role: 'CSM', requirements: ['renewal', 'health score'] };
    expect(buildRolePackModePrompt('star', csProfile)).toContain('Customer Success Role Pack: STAR');

    const hrProfile = { role: 'IT Recruiter', requirements: ['pipeline', 'closing'] };
    expect(buildRolePackModePrompt('case', hrProfile)).toContain('HR/People Role Pack: Case');

    const prompt = buildRespondPrompt({
      mode: 'case',
      userMessage: 'Я бы разместил вакансию на всех площадках.',
      vacancyProfile: hrProfile,
    });
    expect(prompt.text).toContain('HR/People role pack is active');
  });

  it('infers seniority from profile level', () => {
    expect(inferSeniority({ level: 'Senior' })).toBe('senior');
    expect(inferSeniority({ role: 'Lead Product Manager' })).toBe('lead');
  });

  it('resolveInterviewSeniority prefers explicit candidateSeniority', () => {
    expect(resolveInterviewSeniority({ level: 'Senior' }, 'junior')).toBe('junior');
  });

  it('buildSeniorityIntensityPrompt includes LAR matrix', () => {
    const prompt = buildSeniorityIntensityPrompt({ level: 'Junior' });
    expect(prompt).toContain('LAR Intensity');
    expect(prompt).toContain('Rescue attempts');
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

  it('includes seniority adjustments in prep plan prompt', () => {
    const block = buildPrepPlanSeniorityBlock({ level: 'Junior' });
    expect(block).toContain('Junior');

    const prompt = buildPrepPlanPrompt({
      vacancyProfile: { role: 'Engineer', level: 'Senior' },
      availableDays: 5,
      candidateSeniority: 'senior',
    });
    expect(prompt.text).toContain('5-Day Plan Adjustments (Senior)');
  });
});

describe('interviewPrepPhasePrompts', () => {
  it('builds coach and rescue protocol sections', () => {
    expect(buildCoachPersona()).toContain('LEO-Coach');
    expect(buildRescueProtocol()).toContain('Rescue Protocol');
  });

  it('builds phase system message for rescue', () => {
    const message = buildPhaseSystemMessage('case', { role: 'PM' }, 'rescue');
    expect(message.text).toContain('LEO-Coach');
    expect(message.text).toContain('Rescue Protocol');
  });

  it('builds phase respond prompt with response phase', () => {
    const prompt = buildPhaseRespondPrompt({
      mode: 'case',
      userMessage: 'слабый ответ',
      responsePhase: 'rescue',
      grading: {
        overallScore: 2,
        dimensionScores: {
          structure: 2,
          depth: 2,
          metrics: 2,
          tradeOffs: 2,
          communication: 2,
          seniorityFit: 2,
        },
        fatalGaps: ['нет метрик'],
        strengths: [],
        improvements: ['добавить цифры'],
        followUpToProbe: 'Какие метрики?',
        modelStructure: ['цель', 'метрика', 'результат'],
      },
    });
    expect(prompt.text).toContain('Response phase: rescue');
    expect(prompt.text).toContain('Rescue Protocol');
  });

  it('builds phase respond prompt with theory learn phase', () => {
    const prompt = buildPhaseRespondPrompt({
      mode: 'theory',
      userMessage: 'начать урок',
      responsePhase: 'theory_learn',
    });
    expect(prompt.text).toContain('Response phase: theory_learn');
    expect(prompt.text).toContain('NO verification question');
  });
});
