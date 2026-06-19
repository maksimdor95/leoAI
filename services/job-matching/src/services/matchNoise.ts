import { Job } from '../models/job';
import { CollectedData } from './userService';
import { extractSalaryFromText } from './quickPathEnrichment';

export type SalesChannel = 'inbound' | 'outbound' | 'unknown';

const INBOUND_MARKERS =
  /(inbound|входящ|колл[\s-]?центр|call[\s-]?center|оператор\s+call|линия\s+поддержки|техподдержк|customer\s+support|support\s+line)/i;

const OUTBOUND_MARKERS =
  /(outbound|исходящ|холодн\w*\s+звонк|cold\s+call|b2b\s+sales|enterprise\s+sales|аккаунт[\s-]?менеджер|account\s+executive|business\s+development|bdm|field\s+sales|key\s+account)/i;

const LEVEL_RU: Record<string, string> = {
  intern: 'стажёр',
  junior: 'junior',
  middle: 'middle',
  senior: 'senior',
  lead: 'руководитель',
};

const SENIORITY_RANK: Record<string, number> = {
  intern: 0,
  junior: 1,
  middle: 2,
  senior: 3,
  lead: 4,
};

function profileText(data: CollectedData): string {
  const chunks: string[] = [];
  const push = (v: unknown) => {
    if (typeof v === 'string' && v.trim()) chunks.push(v);
  };
  push(data.desiredRole);
  push(data.desired_role);
  push(data.careerSummary);
  push(data.desired_role);
  for (let i = 1; i <= 5; i += 1) {
    push(data[`position_${i}_role` as keyof CollectedData]);
    push(data[`position_${i}_responsibilities` as keyof CollectedData]);
  }
  return chunks.join(' ').toLowerCase();
}

function jobText(job: Job): string {
  return `${job.title} ${job.description} ${job.requirements}`.toLowerCase();
}

export function detectSalesChannel(text: string): SalesChannel {
  const hasInbound = INBOUND_MARKERS.test(text);
  const hasOutbound = OUTBOUND_MARKERS.test(text);
  if (hasInbound && !hasOutbound) return 'inbound';
  if (hasOutbound && !hasInbound) return 'outbound';
  if (hasOutbound) return 'outbound';
  return 'unknown';
}

export function profileSalesChannel(data: CollectedData): SalesChannel {
  return detectSalesChannel(profileText(data));
}

export function jobSalesChannel(job: Job): SalesChannel {
  return detectSalesChannel(jobText(job));
}

export function isSalesChannelMismatch(data: CollectedData, job: Job): boolean {
  const profileChannel = profileSalesChannel(data);
  const jobChannel = jobSalesChannel(job);
  if (profileChannel === 'unknown' || jobChannel === 'unknown') return false;
  return profileChannel !== jobChannel;
}

export function salesChannelMismatchReason(data: CollectedData, job: Job): string | null {
  if (!isSalesChannelMismatch(data, job)) return null;
  const profileChannel = profileSalesChannel(data);
  const jobChannel = jobSalesChannel(job);
  if (profileChannel === 'outbound' && jobChannel === 'inbound') {
    return 'Другой тип продаж: вам ближе исходящие B2B, вакансия на входящие';
  }
  if (profileChannel === 'inbound' && jobChannel === 'outbound') {
    return 'Другой тип продаж: вам ближе входящие, вакансия на исходящие';
  }
  return 'Другой тип продаж относительно вашего профиля';
}

export function seniorityLevelLabel(level: string): string {
  return LEVEL_RU[level] ?? level;
}

export function isSeniorityTierNoise(
  userLevel: string | null,
  jobLevel: string | null
): boolean {
  if (!userLevel || !jobLevel) return false;
  const userRank = SENIORITY_RANK[userLevel] ?? 2;
  const jobRank = SENIORITY_RANK[jobLevel] ?? 2;
  const gap = userRank - jobRank;
  if (gap >= 2) return true;
  if (gap <= -2) return true;
  if (userRank >= 3 && jobRank <= 1) return true;
  return false;
}

export function seniorityMismatchReason(
  userLevel: string | null,
  jobLevel: string | null
): string | null {
  if (!userLevel || !jobLevel) return null;
  const userRank = SENIORITY_RANK[userLevel] ?? 2;
  const jobRank = SENIORITY_RANK[jobLevel] ?? 2;
  const gap = userRank - jobRank;
  if (gap >= 2) {
    return `Ваш уровень выше: вы ${seniorityLevelLabel(userLevel)}, вакансия для ${seniorityLevelLabel(jobLevel)}`;
  }
  if (gap <= -2) {
    return `Вакансия выше вашего уровня: вы ${seniorityLevelLabel(userLevel)}, нужен ${seniorityLevelLabel(jobLevel)}`;
  }
  if (userRank >= 3 && jobRank <= 1) {
    return `Слишком низкий грейд вакансии для вашего опыта (${seniorityLevelLabel(jobLevel)})`;
  }
  return null;
}

export function parseSalaryMinRub(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
  if (typeof raw !== 'string' || !raw.trim()) return null;

  const extracted = extractSalaryFromText(raw);
  const source = extracted || raw;
  const fromMatch = source.match(/(?:от|from)\s*(\d[\d\s]*)/i);
  const digitMatch = source.match(/(\d[\d\s]{4,})/);
  const kMatch = source.match(/(\d{2,3})\s*(?:к|k)\b/i);

  let amount: number | null = null;
  if (fromMatch?.[1]) {
    amount = parseInt(fromMatch[1].replace(/\s/g, ''), 10);
  } else if (kMatch?.[1]) {
    amount = parseInt(kMatch[1], 10) * 1000;
  } else if (digitMatch?.[1]) {
    amount = parseInt(digitMatch[1].replace(/\s/g, ''), 10);
  }

  if (!amount || !Number.isFinite(amount) || amount < 10_000) return null;
  return amount;
}

export function formatRub(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} ₽`;
}

export function matchSalaryExpectation(
  job: Job,
  collectedData: CollectedData
): { points: number; reason?: string; hardMismatch: boolean } {
  const userMin =
    parseSalaryMinRub(collectedData.salaryExpectation) ??
    parseSalaryMinRub(collectedData.desired_salary);

  if (!userMin) {
    return { points: 4, reason: 'Зарплата в профиле не указана', hardMismatch: false };
  }

  const jobMax = job.salary_max ?? job.salary_min;
  const jobMin = job.salary_min ?? job.salary_max;

  if (!jobMax && !jobMin) {
    return { points: 4, hardMismatch: false };
  }

  const effectiveJobTop = jobMax ?? jobMin!;
  const effectiveJobBottom = jobMin ?? jobMax!;

  if (effectiveJobTop < userMin * 0.85) {
    const hardMismatch = effectiveJobTop < userMin * 0.7;
    return {
      points: hardMismatch ? -10 : -5,
      reason: `Зарплата ниже ожиданий: до ${formatRub(effectiveJobTop)}, вы ждёте от ${formatRub(userMin)}`,
      hardMismatch,
    };
  }

  if (effectiveJobBottom >= userMin * 0.9) {
    return {
      points: 8,
      reason: `Зарплата совпадает с ожиданиями (от ${formatRub(effectiveJobBottom)})`,
      hardMismatch: false,
    };
  }

  return {
    points: 3,
    reason: 'Зарплата в вакансии без явного совпадения с ожиданиями',
    hardMismatch: false,
  };
}

export function shouldDemoteFromRecommended(
  job: Job,
  collectedData: CollectedData,
  userLevel: string | null,
  jobLevel: string | null,
  salaryHardMismatch: boolean
): boolean {
  if (salaryHardMismatch) return true;
  if (isSeniorityTierNoise(userLevel, jobLevel)) return true;
  if (isSalesChannelMismatch(collectedData, job)) return true;
  return false;
}
