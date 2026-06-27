import { Request, Response } from 'express';
import { z } from 'zod';
import { callYandexModel } from '../services/yandexClient';
import { buildUserMessage } from '../services/promptService';
import {
  buildGradePrompt,
  buildGradingRubric,
  buildInterviewSystemMessage,
  buildJsonOnlyInstruction,
  buildMockSummaryPrompt,
  buildPrepPlanPrompt,
  buildRespondPrompt,
  buildVacancyExtractionPrompt,
  inferRoleTrack,
  InterviewAnswerGrade,
  InterviewPrepMode,
  InterviewRespondPromptParams,
  parseJsonObject,
  PromptVacancyProfile,
} from '../services/interviewPrepPrompts';
import {
  buildPhaseRespondPrompt,
  buildPhaseSystemMessage,
  InterviewResponsePhase,
} from '../services/interviewPrepPhasePrompts';
import { logger } from '../utils/logger';

const modeSchema = z.enum([
  'diagnostics',
  'theory',
  'case',
  'mock',
  'star',
  'employer_questions',
]);

const vacancyProfileSchema = z.object({
  role: z.string().optional(),
  level: z.string().optional(),
  location: z.string().optional(),
  format: z.string().optional(),
  interviewLanguage: z.string().optional(),
  stack: z.array(z.string()).optional(),
  domain: z.string().optional(),
  responsibilities: z.array(z.string()).optional(),
  requirements: z.array(z.string()).optional(),
  softSkills: z.array(z.string()).optional(),
  metrics: z.array(z.string()).optional(),
  gaps: z.array(z.string()).optional(),
  assumptions: z.array(z.string()).optional(),
});

const prepPlanDaySchema = z.object({
  day: z.number(),
  focus: z.string(),
  tasks: z.array(z.string()),
});

const dimensionScoresSchema = z.object({
  structure: z.number().min(1).max(10),
  depth: z.number().min(1).max(10),
  metrics: z.number().min(1).max(10),
  tradeOffs: z.number().min(1).max(10),
  communication: z.number().min(1).max(10),
  seniorityFit: z.number().min(1).max(10),
});

const interviewGradeSchema = z.object({
  overallScore: z.number().min(1).max(10),
  dimensionScores: dimensionScoresSchema,
  fatalGaps: z.array(z.string()),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  followUpToProbe: z.string(),
  modelStructure: z.array(z.string()).min(1),
});

const extractVacancySchema = z.object({
  vacancyText: z.string().min(1).max(30000),
  source: z.enum(['url', 'text', 'summary']).optional(),
});

const generatePlanSchema = z.object({
  vacancyProfile: vacancyProfileSchema,
  availableDays: z.number().min(1).max(14).optional(),
  candidateSeniority: z.string().optional(),
  prepContext: z
    .object({
      priorFatalGaps: z.array(z.string()).optional(),
      prepSessionNumber: z.number().min(1).optional(),
      sameRoleTrack: z.boolean().optional(),
    })
    .optional(),
});

const respondSchema = z.object({
  mode: modeSchema,
  userMessage: z.string().min(1),
  vacancyProfile: vacancyProfileSchema.optional(),
  prepPlan: z.array(prepPlanDaySchema).optional(),
  collectedData: z.record(z.any()).optional(),
  conversationHistory: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string() }))
    .optional(),
  grading: interviewGradeSchema.optional(),
  responsePhase: z
    .enum([
      'default',
      'mock_active',
      'mock_micro_rescue',
      'mock_debrief',
      'rescue',
      'theory_learn',
      'theory_check',
      'diagnostics_pack',
      'employer_questions_pack',
    ])
    .optional(),
});

const gradeAnswerSchema = z.object({
  mode: modeSchema,
  answer: z.string().min(1).max(15000),
  vacancyProfile: vacancyProfileSchema.optional(),
  collectedData: z.record(z.any()).optional(),
});

const mockSummarySchema = z.object({
  vacancyProfile: vacancyProfileSchema.optional(),
  answers: z.array(z.any()).min(1),
});

type VacancyProfile = z.infer<typeof vacancyProfileSchema>;
type PrepPlanDay = z.infer<typeof prepPlanDaySchema>;

const fallbackProfile: VacancyProfile = {
  role: 'Роль требует уточнения',
  level: 'Middle/Senior',
  location: 'Не указано',
  format: 'Не указано',
  interviewLanguage: 'ru',
  stack: [],
  domain: 'Не указан',
  responsibilities: [],
  requirements: [],
  softSkills: ['коммуникация', 'аналитическое мышление'],
  metrics: [],
  gaps: ['Недостаточно данных в описании вакансии.'],
  assumptions: ['Часть профиля нужно уточнить у пользователя.'],
};

const fallbackGrade: InterviewAnswerGrade = {
  overallScore: 5,
  dimensionScores: {
    structure: 5,
    depth: 5,
    metrics: 4,
    tradeOffs: 4,
    communication: 6,
    seniorityFit: 5,
  },
  fatalGaps: ['Ответ не дотягивает по конкретике или глубине.'],
  strengths: ['Есть попытка ответить по существу.'],
  improvements: ['Нужны структура, конкретика, метрики и явные trade-offs.'],
  followUpToProbe: 'Какие метрики, ограничения и альтернативы ты бы назвал в этом ответе?',
  modelStructure: [
    'Кратко сформулируй контекст и цель',
    'Назови 2-3 ключевых решения или действия',
    'Покажи метрики, ограничения и trade-offs',
    'Заверши итогом и результатом',
  ],
};

function getFallbackGrade(profile?: PromptVacancyProfile): InterviewAnswerGrade {
  if (inferRoleTrack(profile) === 'product_business') {
    return {
      overallScore: 5,
      dimensionScores: {
        structure: 5,
        depth: 5,
        metrics: 4,
        tradeOffs: 4,
        communication: 6,
        seniorityFit: 5,
      },
      fatalGaps: ['Не хватает product sense: цели, метрик, ограничений или trade-offs.'],
      strengths: ['Есть попытка рассуждать как продакт, но решение пока недостаточно обосновано.'],
      improvements: [
        'Сначала обозначь цель и пользователя, затем выбери метрику успеха.',
        'Покажи приоритизацию и почему ты выбираешь именно этот шаг.',
        'Добавь experiment design, ограничения и риски.',
      ],
      followUpToProbe:
        'Какую метрику ты выберешь основной, какие будут guardrails и почему именно такой приоритет?',
      modelStructure: [
        'Сформулируй цель, пользователя и проблему',
        'Назови North Star или primary metric и guardrails',
        'Предложи варианты решения и приоритизируй их',
        'Опиши experiment or rollout plan',
        'Покажи trade-offs, риски и ожидаемый результат',
      ],
    };
  }
  if (inferRoleTrack(profile) === 'analytics_data') {
    return {
      overallScore: 5,
      dimensionScores: {
        structure: 5,
        depth: 5,
        metrics: 4,
        tradeOffs: 4,
        communication: 6,
        seniorityFit: 5,
      },
      fatalGaps: ['Не хватает аналитической строгости: гипотез, определения метрик, ограничений данных или корректной интерпретации.'],
      strengths: ['Есть попытка рассуждать через данные, но логика пока недостаточно строгая.'],
      improvements: [
        'Сначала сформулируй business question и гипотезу.',
        'Дай точное определение ключевой метрики и guardrails.',
        'Покажи ограничения данных, риск смещения и уровень уверенности в выводе.',
      ],
      followUpToProbe:
        'Какую гипотезу ты проверяешь, как определишь метрику, и какие ограничения данных могут изменить твой вывод?',
      modelStructure: [
        'Сформулируй business question и гипотезу',
        'Определи основную метрику и guardrails',
        'Опиши данные, ограничения и возможные bias',
        'Предложи метод анализа или experiment design',
        'Сформулируй рекомендацию и уровень уверенности',
      ],
    };
  }
  if (inferRoleTrack(profile) === 'engineering_systems') {
    return {
      overallScore: 5,
      dimensionScores: {
        structure: 5,
        depth: 5,
        metrics: 4,
        tradeOffs: 4,
        communication: 6,
        seniorityFit: 5,
      },
      fatalGaps: [
        'Не хватает инженерной глубины: требований, масштаба, trade-offs, failure modes или операционной ответственности.',
      ],
      strengths: ['Есть попытка технического рассуждения, но решение пока недостаточно обосновано.'],
      improvements: [
        'Сначала уточни требования и допущения по нагрузке/масштабу.',
        'Покажи архитектурные trade-offs и что сломается первым.',
        'Добавь observability, rollout и план эксплуатации.',
      ],
      followUpToProbe:
        'Какие требования и масштаб ты заложишь, и какие trade-offs сделаешь между latency, cost и complexity?',
      modelStructure: [
        'Уточни требования и scale assumptions',
        'Опиши API/контракты и data model',
        'Предложи архитектуру и ключевые компоненты',
        'Назови bottlenecks и failure modes',
        'Объясни trade-offs и план наблюдаемости/релиза',
      ],
    };
  }
  if (inferRoleTrack(profile) === 'qa_quality') {
    return {
      overallScore: 5,
      dimensionScores: {
        structure: 5,
        depth: 5,
        metrics: 4,
        tradeOffs: 4,
        communication: 6,
        seniorityFit: 5,
      },
      fatalGaps: [
        'Не хватает QA-мышления: risk-based стратегии, приоритизации, критериев релиза или чёткой коммуникации дефектов.',
      ],
      strengths: ['Есть попытка говорить о тестировании, но стратегия пока слишком общая.'],
      improvements: [
        'Начни с рисков и критичных сценариев, а не с «проверю всё».',
        'Опиши типы тестов, пирамиду и что автоматизируешь первым.',
        'Добавь entry/exit criteria и go/no-go для релиза.',
      ],
      followUpToProbe:
        'Какие риски ты приоритизируешь первыми и по каким критериям примешь решение о релизе?',
      modelStructure: [
        'Уточни scope фичи и ограничения релиза',
        'Выдели highest-risk области',
        'Опиши test strategy и coverage',
        'Определи automation scope и данные/окружения',
        'Сформулируй release recommendation и метрики качества',
      ],
    };
  }
  if (inferRoleTrack(profile) === 'sales_commercial') {
    return {
      overallScore: 5,
      dimensionScores: {
        structure: 5,
        depth: 5,
        metrics: 4,
        tradeOffs: 4,
        communication: 6,
        seniorityFit: 5,
      },
      fatalGaps: [
        'Не хватает sales-мышления: discovery, квалификации, работы с возражениями, next step или цифр по сделке/пайплайну.',
      ],
      strengths: ['Есть попытка продавать, но структура разговора и доказательства пока слабые.'],
      improvements: [
        'Начни с вопросов о боли, контексте и критериях решения, а не с питча продукта.',
        'Квалифицируй fit, бюджет, ЛПР и сроки.',
        'Заверши конкретным next step и назови метрики: размер сделки, конверсия, quota.',
      ],
      followUpToProbe:
        'Какие discovery-вопросы ты задашь первыми и как поймёшь, что сделка реальна?',
      modelStructure: [
        'Уточни контекст покупателя и цель разговора',
        'Проведи discovery и квалификацию',
        'Свяжи ценность с болью клиента',
        'Отработай ключевое возражение',
        'Зафиксируй next step и метрики сделки',
      ],
    };
  }
  if (inferRoleTrack(profile) === 'operations_delivery') {
    return {
      overallScore: 5,
      dimensionScores: {
        structure: 5,
        depth: 5,
        metrics: 4,
        tradeOffs: 4,
        communication: 6,
        seniorityFit: 5,
      },
      fatalGaps: [
        'Не хватает delivery-мышления: зависимостей, рисков, приоритизации, эскалации или коммуникации со стейкхолдерами.',
      ],
      strengths: ['Есть попытка описать процесс, но план восстановления и trade-offs пока слабые.'],
      improvements: [
        'Сначала уточни scope, дедлайн, зависимости и стейкхолдеров.',
        'Выдели top risks и critical path.',
        'Покажи, что descope/эскалируешь и как сообщишь плохие новости.',
      ],
      followUpToProbe:
        'Что ты сдвинешь в первую очередь при срыве дедлайна и кому эскалируешь?',
      modelStructure: [
        'Уточни scope, сроки и стейкхолдеров',
        'Составь карту зависимостей и critical path',
        'Приоритизируй риски и действия recovery',
        'Определи trade-offs scope/time/quality',
        'Опиши коммуникацию и меры против повторения',
      ],
    };
  }
  if (inferRoleTrack(profile) === 'design_ux') {
    return {
      overallScore: 5,
      dimensionScores: {
        structure: 5,
        depth: 5,
        metrics: 4,
        tradeOffs: 4,
        communication: 6,
        seniorityFit: 5,
      },
      fatalGaps: [
        'Не хватает UX-мышления: пользователя, доказательств, usability trade-offs, метрик успеха или handoff.',
      ],
      strengths: ['Есть попытка говорить о дизайне, но решение пока недостаточно обосновано.'],
      improvements: [
        'Сначала сформулируй user problem и business goal.',
        'Покажи research/evidence и trade-offs между вариантами.',
        'Добавь метрики успеха и план валидации.',
      ],
      followUpToProbe:
        'Какую пользовательскую проблему ты решаешь и как измеришь успех дизайна?',
      modelStructure: [
        'Уточни пользователя и job-to-be-done',
        'Опиши evidence/research',
        'Предложи варианты и trade-offs',
        'Назови usability риски и edge cases',
        'Определи метрики и план валидации',
      ],
    };
  }
  if (inferRoleTrack(profile) === 'leadership_behavioral') {
    return {
      overallScore: 5,
      dimensionScores: {
        structure: 5,
        depth: 5,
        metrics: 4,
        tradeOffs: 4,
        communication: 6,
        seniorityFit: 5,
      },
      fatalGaps: [
        'Не хватает leadership-сигналов: личной ответственности, влияния, trade-offs, делегирования или измеримого результата для команды/организации.',
      ],
      strengths: ['Есть попытка leadership-нарратива, но ownership и impact пока слабые.'],
      improvements: [
        'Говори от первого лица: что именно ТЫ решил и сделал.',
        'Покажи конфликт/stakeholder trade-off и как ты повлиял на исход.',
        'Добавь метрики команды или бизнеса.',
      ],
      followUpToProbe:
        'Какое конкретное решение ты принял и какой измеримый результат получила команда?',
      modelStructure: [
        'Контекст и stakes',
        'Твоя роль и ответственность',
        'Решение и trade-offs',
        'Действия по влиянию/делегированию',
        'Измеримый результат и урок',
      ],
    };
  }
  if (inferRoleTrack(profile) === 'marketing_growth') {
    return {
      overallScore: 5,
      dimensionScores: {
        structure: 5,
        depth: 5,
        metrics: 4,
        tradeOffs: 4,
        communication: 6,
        seniorityFit: 5,
      },
      fatalGaps: [
        'Не хватает marketing-мышления: метрик воронки, channel trade-offs, гипотез, attribution или ROI.',
      ],
      strengths: ['Есть попытка говорить о маркетинге, но измеримость и стратегия пока слабые.'],
      improvements: [
        'Начни с цели, аудитории и primary metric.',
        'Покажи channel mix и budget trade-offs.',
        'Добавь план измерения и attribution caveats.',
      ],
      followUpToProbe: 'Какую метрику возьмёшь главной и как докажешь вклад канала?',
      modelStructure: [
        'Цель и аудитория',
        'Метрика и baseline',
        'Гипотезы и каналы',
        'Бюджет/trade-offs',
        'Измерение и итерация',
      ],
    };
  }
  if (inferRoleTrack(profile) === 'customer_success') {
    return {
      overallScore: 5,
      dimensionScores: {
        structure: 5,
        depth: 5,
        metrics: 4,
        tradeOffs: 4,
        communication: 6,
        seniorityFit: 5,
      },
      fatalGaps: [
        'Не хватает CS-мышления: диагностики риска, эскалации, плана действий или метрик retention/expansion.',
      ],
      strengths: ['Есть попытка говорить о клиентах, но проактивность и метрики пока слабые.'],
      improvements: [
        'Диагностируй риск и root cause, а не только «свяжусь с клиентом».',
        'Покажи план действий и вовлечение внутренних команд.',
        'Добавь метрики health, adoption, churn или expansion.',
      ],
      followUpToProbe:
        'Какие сигналы риска ты увидишь первыми и что сделаешь в первые 48 часов?',
      modelStructure: [
        'Контекст аккаунта и impact',
        'Сигналы риска',
        'План действий и owners',
        'Коммуникация с клиентом',
        'Метрики и follow-up',
      ],
    };
  }
  if (inferRoleTrack(profile) === 'hr_people') {
    return {
      overallScore: 5,
      dimensionScores: {
        structure: 5,
        depth: 5,
        metrics: 4,
        tradeOffs: 4,
        communication: 6,
        seniorityFit: 5,
      },
      fatalGaps: [
        'Не хватает HR/recruiting-мышления: калибровки роли, sourcing, оценки, pipeline-метрик или работы с hiring manager.',
      ],
      strengths: ['Есть попытка описать найм, но процесс и метрики пока слабые.'],
      improvements: [
        'Сначала откалибруй профиль и success criteria.',
        'Опиши sourcing + assessment plan.',
        'Добавь pipeline metrics и партнёрство с hiring manager.',
      ],
      followUpToProbe:
        'Как ты откалибруешь роль и какие метрики pipeline будешь отслеживать?',
      modelStructure: [
        'Профиль и success criteria',
        'Sourcing plan',
        'Assessment/scorecard',
        'Pipeline metrics',
        'Риски и candidate experience',
      ],
    };
  }
  return fallbackGrade;
}

function validateProfile(value: PromptVacancyProfile): VacancyProfile {
  const parsed = vacancyProfileSchema.parse({
    ...fallbackProfile,
    ...value,
    gaps: value.gaps && value.gaps.length > 0 ? value.gaps : fallbackProfile.gaps,
  });
  const lang = (parsed.interviewLanguage ?? 'ru').toLowerCase();
  if (!lang || lang === 'unknown') {
    parsed.interviewLanguage = 'ru';
  }
  return parsed;
}

function validateGrade(
  value: InterviewAnswerGrade,
  profile?: PromptVacancyProfile
): InterviewAnswerGrade {
  const fallback = getFallbackGrade(profile);
  return interviewGradeSchema.parse({
    ...fallback,
    ...value,
    dimensionScores: {
      ...fallback.dimensionScores,
      ...(value.dimensionScores || {}),
    },
    fatalGaps: value.fatalGaps?.length ? value.fatalGaps : fallback.fatalGaps,
    strengths: value.strengths?.length ? value.strengths : fallback.strengths,
    improvements: value.improvements?.length ? value.improvements : fallback.improvements,
    followUpToProbe: value.followUpToProbe || fallback.followUpToProbe,
    modelStructure: value.modelStructure?.length ? value.modelStructure : fallback.modelStructure,
  });
}

export async function extractVacancyProfile(req: Request, res: Response) {
  try {
    const parsed = extractVacancySchema.parse(req.body);
    const messages = [
      buildInterviewSystemMessage(),
      buildVacancyExtractionPrompt({
        vacancyText: parsed.vacancyText,
        source: parsed.source,
      }),
      buildJsonOnlyInstruction(`{
  "profile": {
    "role": "likely role title",
    "level": "Junior/Middle/Senior/Lead or a range",
    "location": "location / timezone or Не указано",
    "format": "офис / гибрид / удаленка / Не указано",
    "interviewLanguage": "ru / en / unknown",
    "stack": ["technologies or tools"],
    "domain": "business or technical domain",
    "responsibilities": ["key responsibilities"],
    "requirements": ["must-have expectations"],
    "softSkills": ["soft skills and communication signals"],
    "metrics": ["likely success metrics or evaluation areas"],
    "gaps": ["missing information for precise preparation"],
    "assumptions": ["explicit assumptions"]
  }
}`),
    ];

    const aiResponse = await callYandexModel({
      sessionId: `interview-extract-${Date.now()}`,
      userId: 'interview-prep',
      messages,
      completionOptions: { temperature: 0.15, maxTokens: 1300 },
    });
    const parsedJson = parseJsonObject<{ profile: PromptVacancyProfile }>(aiResponse.message.text, {
      profile: fallbackProfile,
    });

    res.json({
      status: 'success',
      profile: validateProfile(parsedJson.profile || fallbackProfile),
    });
  } catch (error: unknown) {
    logger.error('Failed to extract vacancy profile:', error);
    res.status(500).json({ status: 'error', message: 'Failed to extract vacancy profile' });
  }
}

export async function generatePrepPlan(req: Request, res: Response) {
  try {
    const parsed = generatePlanSchema.parse(req.body);
    const days = parsed.availableDays ?? 5;
    const messages = [
      buildInterviewSystemMessage(undefined, parsed.vacancyProfile),
      buildPrepPlanPrompt({
        vacancyProfile: parsed.vacancyProfile,
        availableDays: days,
        candidateSeniority: parsed.candidateSeniority,
        prepContext: parsed.prepContext,
      }),
      buildJsonOnlyInstruction(`{
  "plan": [
    { "day": 1, "focus": "highest-value focus area in the response language", "tasks": ["2-4 specific tasks in the response language"] }
  ]
}`),
    ];

    const aiResponse = await callYandexModel({
      sessionId: `interview-plan-${Date.now()}`,
      userId: 'interview-prep',
      messages,
      completionOptions: { temperature: 0.3, maxTokens: 1400 },
    });
    const parsedJson = parseJsonObject<{ plan: PrepPlanDay[] }>(aiResponse.message.text, {
      plan: [],
    });
    const plan = z.array(prepPlanDaySchema).parse(parsedJson.plan).slice(0, days);

    res.json({ status: 'success', plan });
  } catch (error: unknown) {
    logger.error('Failed to generate interview prep plan:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate interview prep plan' });
  }
}

function resolveRetentionPromptParams(collectedData?: Record<string, unknown>): {
  starBank?: InterviewRespondPromptParams['starBank'];
  shortenedDiagnostics?: boolean;
} {
  if (!collectedData) {
    return {};
  }
  const prepRetention = collectedData.prepRetention as { shortenedDiagnostics?: boolean } | undefined;
  const starBankRaw = collectedData.starBank;
  const starBank = Array.isArray(starBankRaw)
    ? starBankRaw
        .filter((entry) => entry && typeof entry === 'object')
        .map((entry) => {
          const row = entry as {
            role?: string;
            userMessage?: string;
            modelStructure?: string[];
            overallScore?: number;
          };
          return {
            role: row.role,
            userMessage: row.userMessage ?? '',
            modelStructure: row.modelStructure,
            overallScore: row.overallScore,
          };
        })
        .filter((entry) => entry.userMessage.trim().length > 0)
    : undefined;

  return {
    starBank,
    shortenedDiagnostics: Boolean(prepRetention?.shortenedDiagnostics),
  };
}

export async function respondToInterviewMode(req: Request, res: Response) {
  try {
    const parsed = respondSchema.parse(req.body);
    const responsePhase: InterviewResponsePhase = parsed.responsePhase ?? 'default';
    const usePhasePrompts = responsePhase !== 'default';
    const candidateSeniority =
      typeof parsed.collectedData?.candidateSeniority === 'string'
        ? parsed.collectedData.candidateSeniority
        : undefined;
    const retentionParams = resolveRetentionPromptParams(parsed.collectedData);

    const messages = [
      usePhasePrompts
        ? buildPhaseSystemMessage(
            parsed.mode,
            parsed.vacancyProfile,
            responsePhase,
            candidateSeniority
          )
        : buildInterviewSystemMessage(parsed.mode, parsed.vacancyProfile, candidateSeniority),
      usePhasePrompts
        ? buildPhaseRespondPrompt({
            mode: parsed.mode,
            userMessage: parsed.userMessage,
            vacancyProfile: parsed.vacancyProfile,
            prepPlan: parsed.prepPlan,
            conversationHistory: parsed.conversationHistory,
            grading: parsed.grading,
            responsePhase,
            candidateSeniority,
            ...retentionParams,
          })
        : buildRespondPrompt({
            mode: parsed.mode,
            userMessage: parsed.userMessage,
            vacancyProfile: parsed.vacancyProfile,
            prepPlan: parsed.prepPlan,
            conversationHistory: parsed.conversationHistory,
            grading: parsed.grading,
            ...retentionParams,
          }),
    ];

    const aiResponse = await callYandexModel({
      sessionId: `interview-respond-${Date.now()}`,
      userId: 'interview-prep',
      messages,
      completionOptions: { temperature: 0.35, maxTokens: 1800 },
    });

    res.json({ status: 'success', text: aiResponse.message.text.trim() });
  } catch (error: unknown) {
    logger.error('Failed to generate interview response:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate interview response' });
  }
}

export async function gradeInterviewAnswer(req: Request, res: Response) {
  try {
    const parsed = gradeAnswerSchema.parse(req.body);
    const messages = [
      buildInterviewSystemMessage(parsed.mode, parsed.vacancyProfile),
      buildUserMessage(buildGradingRubric(parsed.mode)),
      buildGradePrompt({
        mode: parsed.mode as InterviewPrepMode,
        answer: parsed.answer,
        vacancyProfile: parsed.vacancyProfile,
      }),
      buildJsonOnlyInstruction(`{
  "grade": {
    "overallScore": 1,
    "dimensionScores": {
      "structure": 1,
      "depth": 1,
      "metrics": 1,
      "tradeOffs": 1,
      "communication": 1,
      "seniorityFit": 1
    },
    "fatalGaps": ["severe gaps"],
    "strengths": ["what works"],
    "improvements": ["what must improve"],
    "followUpToProbe": "one sharp follow-up question",
    "modelStructure": ["3-6 bullets with the ideal answer structure"]
  }
}`),
    ];

    const aiResponse = await callYandexModel({
      sessionId: `interview-grade-${Date.now()}`,
      userId: 'interview-prep',
      messages,
      completionOptions: { temperature: 0.15, maxTokens: 1400 },
    });
    const roleAwareFallback = getFallbackGrade(parsed.vacancyProfile);
    const parsedJson = parseJsonObject<{ grade: InterviewAnswerGrade }>(aiResponse.message.text, {
      grade: roleAwareFallback,
    });

    res.json({
      status: 'success',
      grade: validateGrade(parsedJson.grade || roleAwareFallback, parsed.vacancyProfile),
    });
  } catch (error: unknown) {
    logger.error('Failed to grade interview answer:', error);
    res.status(500).json({ status: 'error', message: 'Failed to grade interview answer' });
  }
}

export async function generateMockSummary(req: Request, res: Response) {
  try {
    const parsed = mockSummarySchema.parse(req.body);
    const messages = [
      buildInterviewSystemMessage('mock', parsed.vacancyProfile),
      buildMockSummaryPrompt({
        vacancyProfile: parsed.vacancyProfile,
        answers: parsed.answers,
      }),
    ];

    const aiResponse = await callYandexModel({
      sessionId: `interview-mock-summary-${Date.now()}`,
      userId: 'interview-prep',
      messages,
      completionOptions: { temperature: 0.25, maxTokens: 1200 },
    });

    res.json({ status: 'success', summary: aiResponse.message.text.trim() });
  } catch (error: unknown) {
    logger.error('Failed to generate mock summary:', error);
    res.status(500).json({ status: 'error', message: 'Failed to generate mock summary' });
  }
}
