import { CAREER_COACH_KNOWLEDGE_BASE, RQG_SCORING_CRITERIA } from './careerCoachKnowledge';

export type ProfileSummaryScoreItem = {
  criterion: string;
  score: number;
  maxScore: number;
  comment: string;
};

export type ProfileSummaryResult = {
  professionalSummary: string;
  score: number;
  scoreBreakdown: ProfileSummaryScoreItem[];
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};

function asString(value: unknown): string {
  if (value == null) return '';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value).trim();
}

export function aggregatePositionsForSummary(data: Record<string, unknown>): string {
  const positions: string[] = [];

  for (let i = 1; i <= 5; i++) {
    const company = data[`position_${i}_company`];
    const role = data[`position_${i}_role`];
    const industry = data[`position_${i}_industry`];
    const achievements = data[`position_${i}_achievements`];
    const responsibilities = data[`position_${i}_responsibilities`];
    const team = data[`position_${i}_team`];

    if (company && role) {
      let posStr = `${role} в ${company}`;
      if (industry) posStr += ` (${industry})`;
      if (team) posStr += `. Команда: ${team}`;
      if (responsibilities) posStr += `. Обязанности: ${responsibilities}`;
      if (achievements) posStr += `. Достижения: ${achievements}`;
      positions.push(posStr);
    }
  }

  return positions.join('\n');
}

export function buildProfileTextForAnalysis(collectedData: Record<string, unknown>): string {
  const desiredRole =
    asString(collectedData.desiredRole) ||
    asString(collectedData.desired_role) ||
    asString(collectedData.targetRole);

  const sections = [
    `Желаемая должность: ${desiredRole || 'не указана'}`,
    `Общий обзор карьеры: ${asString(collectedData.careerSummary) || 'не указан'}`,
    `Общий опыт (лет): ${asString(collectedData.totalExperience) || 'не указан'}`,
    `Индустрия: ${asString(collectedData.industry) || asString(collectedData.targetIndustry) || 'не указана'}`,
    `Локация и формат: ${asString(collectedData.location) || asString(collectedData.workMode) || 'не указаны'}`,
    `Зарплатные ожидания: ${asString(collectedData.salary) || asString(collectedData.salaryExpectation) || 'не указаны'}`,
    '',
    'Опыт работы:',
    aggregatePositionsForSummary(collectedData) || 'не указан',
    '',
    `Hard skills: ${asString(collectedData.skills_hard) || asString(collectedData.skills) || 'не указаны'}`,
    `Soft skills: ${asString(collectedData.skills_soft) || 'не указаны'}`,
    `Образование: ${asString(collectedData.education_main) || asString(collectedData.education) || 'не указано'}`,
    `Сертификаты: ${asString(collectedData.education_certs) || asString(collectedData.certifications) || 'не указаны'}`,
    `Языки: ${asString(collectedData.languages) || 'не указаны'}`,
    `Что важно в работе: ${asString(collectedData.workValues) || asString(collectedData.priorities) || 'не указано'}`,
  ];

  return sections.join('\n');
}

export function buildProfileSummarySystemPrompt(): string {
  return `# Роль: Карьерный аналитик и коуч

Ты карьерный аналитик. Проанализируй профиль кандидата по методологии RQG и сформируй профессиональное саммари с оценкой.

${CAREER_COACH_KNOWLEDGE_BASE}

${RQG_SCORING_CRITERIA}

## Задача:
1. Оцени профиль по 10 критериям (0–2 каждый, итого 0–10)
2. Сформируй профессиональное саммари (3–5 полных предложений, без обрыва)
3. Выдели сильные стороны, зоны роста и рекомендации

## Формат professionalSummary:
- [X] лет опыта в [области]: [этапы карьеры с компаниями/ролями]
- [Специализация и ключевые компетенции]
- [2–3 оцифрованных достижения или масштаб работы]
- Пиши в третьем лице, деловым языком
- Используй ТОЛЬКО факты из данных. Не додумывай опыт, цифры, компании
- Если в данных указано 9 лет — пиши 9 лет, не 3

## Формат ответа:
Верни ТОЛЬКО JSON без markdown:
{
  "professionalSummary": "полный текст саммари, 3-5 предложений",
  "score": 7.5,
  "scoreBreakdown": [
    { "criterion": "Желаемая должность", "score": 2, "maxScore": 2, "comment": "краткий комментарий" }
  ],
  "strengths": ["сильная сторона 1", "сильная сторона 2"],
  "weaknesses": ["зона роста 1", "зона роста 2"],
  "recommendations": ["рекомендация 1", "рекомендация 2"]
}`;
}

export function buildProfileSummaryUserMessage(profileText: string): string {
  return `Проанализируй профиль кандидата и верни JSON по структуре выше.

Профиль кандидата:
${profileText}`;
}

export function parseProfileSummaryResponse(raw: string): ProfileSummaryResult {
  let clean = raw.trim().replace(/```json\s*|\s*```/g, '').trim();
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (jsonMatch) clean = jsonMatch[0];

  try {
    const parsed = JSON.parse(clean) as Partial<ProfileSummaryResult>;
    const professionalSummary = asString(parsed.professionalSummary);
    if (!professionalSummary) throw new Error('Missing professionalSummary');

    return {
      professionalSummary,
      score: typeof parsed.score === 'number' ? Math.min(10, Math.max(0, parsed.score)) : 5,
      scoreBreakdown: Array.isArray(parsed.scoreBreakdown)
        ? parsed.scoreBreakdown.map((item) => ({
            criterion: asString(item?.criterion) || 'Критерий',
            score: typeof item?.score === 'number' ? item.score : 0,
            maxScore: typeof item?.maxScore === 'number' ? item.maxScore : 2,
            comment: asString(item?.comment),
          }))
        : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(asString).filter(Boolean) : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.map(asString).filter(Boolean) : [],
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations.map(asString).filter(Boolean)
        : [],
    };
  } catch {
    return {
      professionalSummary: raw.trim(),
      score: 5,
      scoreBreakdown: [],
      strengths: [],
      weaknesses: [],
      recommendations: [],
    };
  }
}
