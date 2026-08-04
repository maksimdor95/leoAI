/**
 * Пересечение обязанностей/опыта профиля с текстом вакансии (description + requirements + skills).
 * Детерминированный слой: без LLM, fail-open (0 баллов если мало сигналов).
 */

import { Job } from '../models/job';
import { CollectedData } from './userService';
import { skillAppearsInText, skillsMatchByAlias } from './skillLexicon';

/** Сигналы обязанностей — то, что ищем и в опыте кандидата, и в JD. */
const DUTY_SIGNALS: readonly { label: string; needles: readonly string[] }[] = [
  {
    label: 'бэклог и приоритеты',
    needles: ['бэклог', 'backlog', 'приоритизац', 'приоритет'],
  },
  {
    label: 'видение и стратегия продукта',
    needles: [
      'видени',
      'vision',
      'стратеги',
      'product strategy',
      'product vision',
      'go-to-market',
      'roadmap',
    ],
  },
  {
    label: 'продуктовые метрики и KPI',
    needles: ['метрик', 'kpi', 'mau', 'retention', 'nps', 'конверси', 'a/b', 'ab-тест', 'аналитик'],
  },
  {
    label: 'Agile/Scrum',
    needles: ['agile', 'scrum', 'kanban', 'спринт'],
  },
  {
    label: 'кросс-функциональные команды',
    needles: ['кросс-функционал', 'cross-functional', 'управлени командой', 'матричн'],
  },
  {
    label: 'исследования пользователей',
    needles: ['custdev', 'user research', 'исследован', 'jtbd', 'гипотез', 'discovery'],
  },
  {
    label: 'менторство и развитие команды',
    needles: ['ментор', 'наставни', 'развитие команды', 'ведение команды'],
  },
  {
    label: 'стейкхолдеры и ожидания',
    needles: ['стейкхолдер', 'stakeholder', 'ожидан', 'синхронизац'],
  },
];

const MAX_EXPERIENCE_OVERLAP_POINTS = 5;

function collectProfileExperienceText(data: CollectedData): string {
  const chunks: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) chunks.push(v.trim());
  };

  push(data.careerSummary);
  push(data.desiredRole);
  push(data.desired_role);
  push(data.about);
  push(data.additional_info);

  if (Array.isArray(data.skills)) {
    for (const s of data.skills) push(s);
  }
  push(data.skills_hard);
  push(data.skills_soft);

  for (let i = 1; i <= 5; i += 1) {
    push(data[`position_${i}_role`]);
    push(data[`position_${i}_responsibilities`]);
    push(data[`position_${i}_achievements`]);
    push(data[`position_${i}_projects`]);
    push(data[`position_${i}_team`]);
    push(data[`position_${i}_industry`]);
  }

  return chunks.join('\n').toLowerCase();
}

function jobDutyText(job: Job): string {
  return `${job.title} ${job.description} ${job.requirements} ${(job.skills || []).join(' ')}`.toLowerCase();
}

function signalHitsInText(text: string, needles: readonly string[]): boolean {
  return needles.some((n) => n.length >= 3 && text.includes(n.toLowerCase()));
}

export type ExperienceOverlapResult = {
  points: number;
  reason?: string;
  matchedLabels: string[];
};

/**
 * Баллы за пересечение обязанностей профиля с текстом вакансии (0–8).
 */
export function scoreExperienceOverlap(
  job: Job,
  collectedData: CollectedData
): ExperienceOverlapResult {
  const profileText = collectProfileExperienceText(collectedData);
  const vacancyText = jobDutyText(job);

  if (profileText.length < 40 || vacancyText.length < 40) {
    return { points: 0, matchedLabels: [] };
  }

  const matchedLabels: string[] = [];
  for (const signal of DUTY_SIGNALS) {
    const inProfile = signalHitsInText(profileText, signal.needles);
    const inJob = signalHitsInText(vacancyText, signal.needles);
    if (inProfile && inJob) {
      matchedLabels.push(signal.label);
    }
  }

  // Доп. пересечение через skill aliases по навыкам профиля vs JD
  const userSkills = Array.isArray(collectedData.skills)
    ? collectedData.skills.filter((s): s is string => typeof s === 'string')
    : [];
  let aliasHits = 0;
  for (const skill of userSkills) {
    if (skill.length > 2 && skillAppearsInText(skill, vacancyText)) {
      aliasHits += 1;
    } else {
      for (const jobSkill of job.skills || []) {
        if (skillsMatchByAlias(skill, jobSkill)) {
          aliasHits += 1;
          break;
        }
      }
    }
  }

  if (matchedLabels.length === 0 && aliasHits === 0) {
    return { points: 0, matchedLabels: [] };
  }

  // 1.5≈ округление: 2 за первый duty, +1 дальше; alias до +1 (раньше +2)
  const dutyPoints = matchedLabels.length > 0 ? Math.min(4, 2 + (matchedLabels.length - 1)) : 0;
  const aliasBonus = Math.min(1, Math.floor(aliasHits / 2));
  const points = Math.min(MAX_EXPERIENCE_OVERLAP_POINTS, dutyPoints + aliasBonus);

  const reason =
    matchedLabels.length > 0
      ? `Опыт пересекается с обязанностями: ${matchedLabels.slice(0, 3).join(', ')}`
      : `Опыт отражён в тексте вакансии (навыки)`;

  return { points, reason, matchedLabels };
}

/** Короткие буллеты опыта для LLM-rerank (без раздувания токенов). */
export function buildExperienceHighlights(data: CollectedData, maxBullets = 4): string[] {
  const bullets: string[] = [];
  for (let i = 1; i <= 5 && bullets.length < maxBullets; i += 1) {
    const role = data[`position_${i}_role`];
    const achievements = data[`position_${i}_achievements`];
    const responsibilities = data[`position_${i}_responsibilities`];
    const company = data[`position_${i}_company`];
    if (typeof role !== 'string' || !role.trim()) continue;
    const companyPart = typeof company === 'string' && company.trim() ? ` @ ${company.trim()}` : '';
    const detail =
      (typeof achievements === 'string' && achievements.trim()) ||
      (typeof responsibilities === 'string' && responsibilities.trim()) ||
      '';
    const line = `${role.trim()}${companyPart}${detail ? `: ${detail.slice(0, 180)}` : ''}`;
    bullets.push(line.slice(0, 220));
  }
  if (bullets.length === 0 && typeof data.careerSummary === 'string' && data.careerSummary.trim()) {
    bullets.push(data.careerSummary.trim().slice(0, 280));
  }
  return bullets;
}
