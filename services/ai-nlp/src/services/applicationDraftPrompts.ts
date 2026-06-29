export const APPLICATION_DRAFT_PROMPT_VERSION = 'application-draft-v2';

export const APPLICATION_DRAFT_TONES = [
  'neutral',
  'formal',
  'concise',
  'casual',
  'human',
  'warm',
  'metrics',
  'detailed',
  'job_fit',
] as const;

export type ApplicationDraftTone = (typeof APPLICATION_DRAFT_TONES)[number];

export function isApplicationDraftTone(value: unknown): value is ApplicationDraftTone {
  return (
    typeof value === 'string' &&
    (APPLICATION_DRAFT_TONES as readonly string[]).includes(value)
  );
}

export interface ApplicationDraftJobInput {
  title: string;
  company: string;
  description?: string;
  requirements?: string;
  skills?: string[];
  location?: string[];
  workMode?: string | null;
  conditions?: Record<string, unknown> | null;
}

export interface ApplicationDraftModelResult {
  headline: string;
  coverLetter: string;
  bullets: string[];
}

const FORBIDDEN_PHRASES = [
  'Уважаемый представитель',
  'Меня заинтересовала вакансия',
  'подходящим кандидатом',
  'значительный опыт',
  'глубокое понимание',
  'обладающий навыками',
];

const TONE_HINT: Record<ApplicationDraftTone, string> = {
  neutral:
    'уверенно и по делу, 100–140 слов, 3 коротких абзаца',
  formal:
    'деловой тон, «Добрый день» допустимо, без канцелярита, 110–150 слов',
  concise: '80–100 слов, 2–3 абзаца, каждое предложение несёт факт',
  casual:
    'простой разговорный язык, можно «Привет», короткие фразы, без официоза',
  human:
    'живой тон одного человека, одна естественная деталь, без HR-шаблонов',
  warm:
    'дружелюбно, лёгкий интерес к продукту или домену компании, без лести',
  metrics:
    '1–2 достижения с цифрами из профиля, цифры только если есть в данных',
  detailed:
    '150–200 слов, больше контекста по релевантным проектам, без воды',
  job_fit:
    'зеркаль 2–3 формулировки из описания вакансии, покажи fit через примеры',
};

export function temperatureForApplicationDraftTone(tone: ApplicationDraftTone): number {
  if (tone === 'concise' || tone === 'formal') return 0.32;
  if (tone === 'human' || tone === 'warm' || tone === 'casual') return 0.48;
  return 0.42;
}

export function maxTokensForApplicationDraftTone(tone: ApplicationDraftTone): number {
  return tone === 'detailed' ? 900 : 650;
}

export function parseApplicationDraftJson(
  raw: string,
  fallback: ApplicationDraftModelResult
): ApplicationDraftModelResult {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const headline = typeof parsed.headline === 'string' ? parsed.headline.trim() : '';
    const coverLetter = typeof parsed.coverLetter === 'string' ? parsed.coverLetter.trim() : '';
    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => item.trim())
          .slice(0, 5)
      : [];

    if (!coverLetter) {
      return fallback;
    }

    return {
      headline,
      coverLetter,
      bullets,
    };
  } catch {
    return fallback;
  }
}

function formatProfileFacts(collectedData: Record<string, unknown>): string {
  const lines: string[] = [];
  const labels: Record<string, string> = {
    desired_role: 'Желаемая роль',
    desiredRole: 'Желаемая роль',
    totalExperience: 'Опыт (лет)',
    location: 'Локация',
    desired_location: 'Локация',
    workMode: 'Формат работы',
    skills_hard: 'Hard skills',
    skills_soft: 'Soft skills',
    careerSummary: 'Краткое резюме',
  };

  for (const [key, label] of Object.entries(labels)) {
    const value = collectedData[key];
    if (value == null || value === '') continue;
    if (Array.isArray(value)) {
      lines.push(`- ${label}: ${value.join(', ')}`);
    } else {
      lines.push(`- ${label}: ${String(value)}`);
    }
  }

  for (let i = 1; i <= 5; i += 1) {
    const role = collectedData[`position_${i}_role`];
    const achievements = collectedData[`position_${i}_achievements`];
    if (typeof role === 'string' && role.trim()) {
      lines.push(`- Опыт ${i}: ${role.trim()}`);
    }
    if (typeof achievements === 'string' && achievements.trim()) {
      lines.push(`  Достижения: ${achievements.trim().slice(0, 400)}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'Профиль заполнен частично.';
}

function formatJobBlock(job: ApplicationDraftJobInput): string {
  const parts = [
    `Должность: ${job.title}`,
    `Компания: ${job.company}`,
  ];
  if (job.location?.length) parts.push(`Локация: ${job.location.join(', ')}`);
  if (job.workMode) parts.push(`Формат: ${job.workMode}`);
  if (job.skills?.length) parts.push(`Ключевые навыки вакансии: ${job.skills.join(', ')}`);
  if (job.description?.trim()) parts.push(`\nОписание:\n${job.description.trim().slice(0, 3500)}`);
  if (job.requirements?.trim()) {
    parts.push(`\nТребования:\n${job.requirements.trim().slice(0, 1500)}`);
  }
  if (job.conditions && Object.keys(job.conditions).length > 0) {
    parts.push(`\nУсловия HH: ${JSON.stringify(job.conditions)}`);
  }
  return parts.join('\n');
}

export function buildApplicationDraftPrompt(params: {
  collectedData: Record<string, unknown>;
  job: ApplicationDraftJobInput;
  tone: ApplicationDraftTone;
  matchHighlights?: string[];
}): { system: string; user: string } {
  const toneHint = TONE_HINT[params.tone];
  const matchBlock =
    params.matchHighlights && params.matchHighlights.length > 0
      ? `\nСильные стороны матча (можно использовать 1, не перечисляй все):\n${params.matchHighlights.map((r) => `- ${r}`).join('\n')}`
      : '';

  const system = `Ты редактор сопроводительных писем LEO. Пишешь короткий текст для поля «сопроводительное» на hh.ru — его прочитает рекрутер за 20 секунд.

Верни ТОЛЬКО валидный JSON без markdown:
{"coverLetter":"текст plain text"}

Структура coverLetter:
1) Зацепка — почему вы на эту роль (1–2 предложения, сразу по делу).
2) Доказательство — 1–2 конкретных результата из профиля, связанных с доменом вакансии.
3) Закрытие — одно короткое предложение о готовности к диалогу.

Стиль: ${toneHint}.

Жёсткие правила:
- только факты из профиля, не выдумывай;
- не перечисляй инструменты и навыки списком (Jira, Agile, Confluence) — покажи результат;
- не дублируй название вакансии и компании в каждом абзаце;
- 2–3 абзаца через \\n\\n, без маркированных списков;
- НЕ пиши headline, bullets, тему письма — только coverLetter.

Запрещённые формулировки (и близкие): ${FORBIDDEN_PHRASES.join('; ')}.

Хороший заход: «7 лет в product/project в FinTech — запускал B2B-продукты с выручкой от …» или «Добрый день! В ${params.job.company} откликаюсь на ${params.job.title}: в прошлом году …».
Плохой заход: «Меня заинтересовала вакансия …» / «Уважаемый представитель …».`;

  const user = `Профиль кандидата:
${formatProfileFacts(params.collectedData)}

Вакансия:
${formatJobBlock(params.job)}${matchBlock}`;

  return { system, user };
}
