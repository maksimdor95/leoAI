export type HumanizedReason = {
  text: string;
  tone: 'positive' | 'negative' | 'neutral';
};

const FAMILY_RU: Record<string, string> = {
  product: 'продукт',
  project: 'проект',
  analytics: 'аналитика',
  data: 'данные',
  ml: 'ML/AI',
  design: 'дизайн',
  marketing: 'маркетинг',
  sales: 'продажи',
  hr: 'HR',
  wellbeing: 'well-being',
  finance: 'финансы',
  legal: 'юриспруденция',
  support: 'поддержка',
  qa: 'QA',
  devops: 'DevOps',
  backend: 'backend',
  frontend: 'frontend',
  fullstack: 'fullstack',
  mobile: 'мобильная разработка',
  systems: 'системное администрирование',
  management: 'менеджмент',
};

const NEUTRAL_NOISE = /не указан|не указана|локация не указана|опыт пользователя не указан/i;

/** HH-мета без явного совпадения/конфликта — не должна вытеснять роль и навыки. */
const LOW_VALUE_META =
  /^(график:|рабочие часы:|график вакансии:|рабочие часы вакансии:|оформление:)/i;

const DISPLAY_LIMIT = 6;

function familyRu(code: string): string {
  return FAMILY_RU[code.toLowerCase()] ?? code;
}

function toneFromText(text: string): HumanizedReason['tone'] {
  const lower = text.toLowerCase();
  if (
    lower.includes('несовпад') ||
    lower.includes('ниже') ||
    lower.includes('выше вашего') ||
    lower.includes('выше:') ||
    lower.includes('другое направление') ||
    lower.includes('другой тип продаж') ||
    lower.includes('офис в другом') ||
    lower.includes('слишком низкий') ||
    lower.includes('нет совпадающих')
  ) {
    return 'negative';
  }
  if (
    lower.startsWith('ai:') ||
    lower.includes('совпад') ||
    lower.includes('бонус') ||
    lower.includes('идеальн') ||
    lower.includes('направление') ||
    lower.includes('удалён') ||
    lower.includes('зарплата совпадает') ||
    lower.includes('должность совпадает') ||
    lower.includes('навыки')
  ) {
    return 'positive';
  }
  return 'neutral';
}

/**
 * Приоритет для «Почему матч»: суть fit (AI / роль / навыки / направление),
 * затем локация и опыт; HH-график/часы — в конец или скрыть.
 */
export function reasonDisplayPriority(text: string): number {
  const lower = text.toLowerCase();
  if (lower.startsWith('ai:')) return 0;
  if (
    lower.includes('должность') ||
    lower.includes('совпадение фраз') ||
    lower.includes('частичное совпадение по должности')
  ) {
    return 1;
  }
  if (
    lower.includes('навык') ||
    lower.includes('семантическая близость') ||
    lower.includes('не хватает') ||
    lower.includes('опыт пересекается') ||
    lower.includes('обязанност')
  ) {
    return 2;
  }
  if (
    lower.includes('направление') ||
    lower.includes('семейство')
  ) {
    return 3;
  }
  if (lower.includes('локац') || lower.includes('удалён')) return 4;
  if (lower.includes('опыт')) return 5;
  if (lower.includes('формат') || lower.includes('режим') || lower.includes('гибрид')) {
    return 6;
  }
  if (lower.includes('зарплат') || lower.includes('домен') || lower.includes('бонус')) {
    return 7;
  }
  if (
    lower.includes('график совпадает') ||
    lower.includes('рабочие часы совпадают') ||
    lower.includes('занятость')
  ) {
    return 8;
  }
  if (LOW_VALUE_META.test(lower)) return 90;
  if (lower.includes('понижено') || lower.includes('исключено')) return 9;
  return 10;
}

export function humanizeMatchReason(raw: string): HumanizedReason {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  if (lower.startsWith('семейство роли совпадает:')) {
    const code = trimmed.split(':').slice(1).join(':').trim();
    return {
      text: `Подходит по направлению: ${familyRu(code)}`,
      tone: 'positive',
    };
  }

  if (lower.startsWith('смежное семейство:')) {
    const code = trimmed.split(':').slice(1).join(':').trim();
    return {
      text: `Смежное направление: ${familyRu(code)}`,
      tone: 'positive',
    };
  }

  if (lower.startsWith('другое семейство')) {
    const match = trimmed.match(/\(([^)]+)\)/);
    const code = match?.[1] ?? '';
    return {
      text: code
        ? `Другое направление (${familyRu(code)}), поэтому скор ниже`
        : 'Другое направление, поэтому скор ниже',
      tone: 'negative',
    };
  }

  if (lower.startsWith('overqualified:') || lower.startsWith('ваш уровень выше')) {
    return {
      text: 'Уровень вакансии ниже вашего опыта',
      tone: 'negative',
    };
  }

  if (lower.startsWith('совпадение фраз в должности:')) {
    return {
      text: 'Должность совпадает с вашим запросом',
      tone: 'positive',
    };
  }

  if (lower.startsWith('совпадение по локации:')) {
    const place = trimmed.split(':').slice(1).join(':').trim();
    return {
      text: place ? `Локация: ${place}` : 'Подходит по локации',
      tone: 'positive',
    };
  }

  if (lower.startsWith('направление совпадает:')) {
    return { text: trimmed, tone: 'positive' };
  }

  if (lower.startsWith('смежное направление:')) {
    return { text: trimmed, tone: 'positive' };
  }

  if (lower.startsWith('совпадающие навыки:')) {
    const list = trimmed.split(':').slice(1).join(':').trim();
    return {
      text: list ? `Совпадающие навыки: ${list}` : 'Есть совпадающие навыки',
      tone: 'positive',
    };
  }

  if (lower.startsWith('навыки найдены в тексте') || lower.startsWith('навыки встречаются')) {
    return { text: trimmed, tone: 'positive' };
  }

  if (lower.startsWith('не хватает в профиле:')) {
    const list = trimmed.split(':').slice(1).join(':').trim();
    return {
      text: list ? `Не хватает в профиле: ${list}` : 'Есть пробелы по навыкам вакансии',
      tone: 'negative',
    };
  }

  return { text: trimmed, tone: toneFromText(trimmed) };
}

export type MatchSkillHints = {
  matched?: string[];
  missing?: string[];
};

export function humanizeMatchReasons(
  reasons: string[] | undefined,
  skillHints?: MatchSkillHints
): HumanizedReason[] {
  const raw = [...(reasons || []).filter(Boolean)];

  const hasMatchedReason = raw.some((r) => /совпадающие навыки|навыки найдены|навыки встречаются/i.test(r));
  const hasMissingReason = raw.some((r) => /не хватает/i.test(r));

  if (!hasMatchedReason && skillHints?.matched && skillHints.matched.length > 0) {
    raw.push(`Совпадающие навыки: ${skillHints.matched.slice(0, 3).join(', ')}`);
  }
  if (!hasMissingReason && skillHints?.missing && skillHints.missing.length > 0) {
    raw.push(`Не хватает в профиле: ${skillHints.missing.slice(0, 3).join(', ')}`);
  }

  const all = raw.map(humanizeMatchReason);
  const meaningful = all.filter((item) => {
    if (LOW_VALUE_META.test(item.text)) return false;
    if (item.tone !== 'neutral') return true;
    return !NEUTRAL_NOISE.test(item.text);
  });
  const pool = meaningful.length > 0 ? meaningful : all.filter((i) => !LOW_VALUE_META.test(i.text));
  return [...pool]
    .sort((a, b) => reasonDisplayPriority(a.text) - reasonDisplayPriority(b.text))
    .slice(0, DISPLAY_LIMIT);
}
