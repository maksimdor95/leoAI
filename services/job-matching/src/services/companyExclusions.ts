/**
 * Исключения компаний / отраслей из свободного текста профиля.
 * Примеры: «не рассматриваю банки», «убери ВТБ», «исключи Сбер».
 */

import type { Job } from '../models/job';
import type { CollectedData } from './userService';

export interface CompanyExclusionRule {
  /** Человекочитаемая метка для reason. */
  label: string;
  /** Подстроки (lowercase) в company / title / description. */
  needles: string[];
}

/** Каталог отраслевых исключений. */
const EXCLUSION_CATALOG: Array<{ triggers: string[]; label: string; needles: string[] }> = [
  {
    triggers: ['банк', 'банки', 'банках', 'banking', 'banks', 'финтех банк'],
    label: 'банки',
    needles: [
      'банк',
      'bank',
      'сбер',
      'sber',
      'втб',
      'vtb',
      'тинькофф',
      'tinkoff',
      't-bank',
      'т-банк',
      'альфа-банк',
      'alfabank',
      'alfa-bank',
      'газпромбанк',
      'росбанк',
      'райффайзен',
      'raiffeisen',
      'совкомбанк',
      'открытие',
      'домклик',
      'domclick',
      'сбербанк',
      'sberbank',
      'мтс банк',
      'otkritie',
    ],
  },
  {
    triggers: ['гембл', 'gambling', 'казино', 'ставки', 'букмекер'],
    label: 'гемблинг',
    needles: ['казино', 'casino', 'букмекер', 'betting', 'gambling', 'гембл'],
  },
];

/** Известные компании → aliases для точечного исключения. */
const KNOWN_COMPANIES: Array<{ label: string; aliases: string[] }> = [
  { label: 'ВТБ', aliases: ['втб', 'vtb'] },
  { label: 'Сбер', aliases: ['сбер', 'sber', 'сбербанк', 'sberbank'] },
  { label: 'Тинькофф', aliases: ['тинькофф', 'tinkoff', 't-bank', 'т-банк', 'тбанк'] },
  { label: 'Альфа-Банк', aliases: ['альфа', 'альфа-банк', 'alfabank', 'alfa-bank'] },
  { label: 'Домклик', aliases: ['домклик', 'domclick'] },
  { label: 'Яндекс', aliases: ['яндекс', 'yandex'] },
  { label: 'VK', aliases: ['vk', 'вконтакте', 'mail.ru', 'мэйл'] },
  { label: 'Ozon', aliases: ['ozon', 'озон'] },
  { label: 'Wildberries', aliases: ['wildberries', 'вайлдберриз', 'wb'] },
  { label: 'МТС', aliases: ['мтс', 'mts'] },
  { label: 'Газпромбанк', aliases: ['газпромбанк', 'gazprombank'] },
];

const ACTION_PREFIX =
  /(?:убери|убрать|исключи|исключить|не\s+рассматрива(?:ю|ем|ет|ть)?|не\s+хочу|не\s+интерес(?:уют|ны|но)?|без|мимо|не\s+готов(?:а|ы)?\s+к|не\s+смотрю|не\s+предлагай|не\s+бери|уберите)/i;

/** Слова, которые не считаем именем компании. */
const NAMED_STOPWORDS = new Set([
  'банк',
  'банки',
  'банках',
  'работу',
  'работы',
  'вакансии',
  'вакансию',
  'меня',
  'пожалуйста',
  'компанию',
  'компании',
  'из',
  'списка',
  'рекомендаций',
  'топа',
  'гембл',
  'казино',
]);

function collectPreferenceTexts(data: CollectedData): string[] {
  const keys = [
    'additional_info',
    'additionalNotes',
    'additional',
    'desired_culture',
    'desiredCulture',
    'preferencesNotes',
  ] as const;
  const out: string[] = [];
  for (const key of keys) {
    const v = data[key];
    if (typeof v === 'string' && v.trim()) out.push(v.trim());
  }
  return out;
}

function normalizeText(s: string): string {
  return s.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveKnownCompany(token: string): { label: string; needles: string[] } | null {
  const t = normalizeText(token).replace(/[«»"'.,!?]/g, '');
  if (t.length < 2 || NAMED_STOPWORDS.has(t)) return null;

  for (const company of KNOWN_COMPANIES) {
    if (company.aliases.some((a) => a === t || t.includes(a) || a.includes(t))) {
      return { label: company.label, needles: company.aliases };
    }
  }

  // Произвольное имя компании (≥3 символа)
  if (t.length >= 3 && !/^\d+$/.test(t)) {
    return { label: token.trim(), needles: [t] };
  }
  return null;
}

function parseCatalogExclusions(combined: string): CompanyExclusionRule[] {
  const rules: CompanyExclusionRule[] = [];
  const seen = new Set<string>();

  for (const entry of EXCLUSION_CATALOG) {
    for (const trigger of entry.triggers) {
      const t = normalizeText(trigger);
      const negatedNear =
        new RegExp(
          `${ACTION_PREFIX.source}\\s+(?:работы\\s+(?:в|на)\\s+)?[\\wа-яё-]*${escapeRegExp(t)}|[\\wа-яё-]*${escapeRegExp(t)}\\s+${ACTION_PREFIX.source}`,
          'i'
        ).test(combined) ||
        new RegExp(`(?:не\\s+)?рассматрива\\w*\\s+[^.\\n]{0,40}${escapeRegExp(t)}`, 'i').test(
          combined
        );

      const simpleNegation =
        combined.includes(`не рассматриваю ${t}`) ||
        combined.includes(`не рассматриваем ${t}`) ||
        combined.includes(`без ${t}`) ||
        combined.includes(`убери ${t}`) ||
        combined.includes(`убрать ${t}`) ||
        combined.includes(`исключи ${t}`) ||
        combined.includes(`${t} не рассматри`) ||
        (combined.includes('не рассматриваю') && combined.includes(t));

      if (negatedNear || simpleNegation) {
        if (!seen.has(entry.label)) {
          seen.add(entry.label);
          rules.push({ label: entry.label, needles: entry.needles });
        }
        break;
      }
    }
  }

  return rules;
}

/** Точечные компании: «убери ВТБ», «исключи Сбер», «ВТБ не рассматриваю». */
function parseNamedCompanyExclusions(combined: string): CompanyExclusionRule[] {
  const rules: CompanyExclusionRule[] = [];
  const seen = new Set<string>();

  const actionThenName = new RegExp(
    `${ACTION_PREFIX.source}\\s+(?:компани[юя]\\s+|из\\s+)?([a-zа-яё0-9t\\-]{2,40})`,
    'gi'
  );
  let m: RegExpExecArray | null;
  while ((m = actionThenName.exec(combined)) !== null) {
    const resolved = resolveKnownCompany(m[1]);
    if (!resolved) continue;
    // Если это триггер отрасли — уже покрыто catalog
    if (EXCLUSION_CATALOG.some((c) => c.triggers.some((t) => normalizeText(t) === normalizeText(m![1])))) {
      continue;
    }
    const key = normalizeText(resolved.label);
    if (seen.has(key)) continue;
    seen.add(key);
    rules.push({ label: resolved.label, needles: resolved.needles });
  }

  // «ВТБ не рассматриваю» / «Сбер убери»
  for (const company of KNOWN_COMPANIES) {
    for (const alias of company.aliases) {
      const nameThenAction = new RegExp(
        `${escapeRegExp(alias)}\\s+(?:не\\s+рассматрива\\w*|убери|убрать|исключи|исключить|не\\s+хочу|мимо)`,
        'i'
      );
      if (nameThenAction.test(combined)) {
        const key = normalizeText(company.label);
        if (!seen.has(key)) {
          seen.add(key);
          rules.push({ label: company.label, needles: company.aliases });
        }
        break;
      }
    }
  }

  return rules;
}

/**
 * Извлекает правила исключения из текста профиля.
 */
export function parseCompanyExclusions(data: CollectedData | null | undefined): CompanyExclusionRule[] {
  if (!data) return [];
  const texts = collectPreferenceTexts(data);
  if (texts.length === 0) return [];

  const combined = normalizeText(texts.join('\n'));
  const catalog = parseCatalogExclusions(combined);
  const named = parseNamedCompanyExclusions(combined);

  const byLabel = new Map<string, CompanyExclusionRule>();
  for (const rule of [...catalog, ...named]) {
    const key = normalizeText(rule.label);
    const prev = byLabel.get(key);
    if (!prev) {
      byLabel.set(key, rule);
    } else {
      byLabel.set(key, {
        label: prev.label,
        needles: [...new Set([...prev.needles, ...rule.needles])],
      });
    }
  }
  return [...byLabel.values()];
}

export function jobMatchesCompanyExclusion(job: Job, rule: CompanyExclusionRule): boolean {
  const hay = normalizeText(
    [job.company, job.title, job.description?.slice(0, 800) || ''].join(' ')
  );
  return rule.needles.some((n) => {
    const needle = normalizeText(n);
    if (needle.length < 2) return false;
    // Короткие aliases (втб, vk) — word-ish match, чтобы не ловить мусор
    if (needle.length <= 3) {
      return new RegExp(`(?:^|[^a-zа-яё0-9])${escapeRegExp(needle)}(?:[^a-zа-яё0-9]|$)`, 'i').test(
        hay
      );
    }
    return hay.includes(needle);
  });
}

/** Первое сработавшее исключение для вакансии (или null). */
export function findMatchingCompanyExclusion(
  job: Job,
  data: CollectedData | null | undefined
): CompanyExclusionRule | null {
  const rules = parseCompanyExclusions(data);
  for (const rule of rules) {
    if (jobMatchesCompanyExclusion(job, rule)) return rule;
  }
  return null;
}
