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
    lower.includes('слишком низкий')
  ) {
    return 'negative';
  }
  if (
    lower.includes('совпад') ||
    lower.includes('бонус') ||
    lower.includes('идеальн') ||
    lower.includes('направление') ||
    lower.includes('удалён') ||
    lower.includes('зарплата совпадает') ||
    lower.includes('должность совпадает')
  ) {
    return 'positive';
  }
  return 'neutral';
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

  return { text: trimmed, tone: toneFromText(trimmed) };
}

export function humanizeMatchReasons(reasons: string[] | undefined): HumanizedReason[] {
  const all = (reasons || []).filter(Boolean).map(humanizeMatchReason);
  const meaningful = all.filter((item) => {
    if (item.tone !== 'neutral') return true;
    return !NEUTRAL_NOISE.test(item.text);
  });
  return (meaningful.length > 0 ? meaningful : all).slice(0, 5);
}
