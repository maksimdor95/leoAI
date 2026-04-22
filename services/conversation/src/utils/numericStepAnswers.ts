/**
 * Детерминированный разбор коротких числовых ответов в анкете Jack,
 * чтобы не гонять их через LLM validate-answer (избегаем ложных «unclear»).
 */

const RU_NUMBER_WORDS: ReadonlyArray<[RegExp, number]> = [
  [/\b(один|одна|одно|одну)\b/i, 1],
  [/\b(два|две|двух|пару|пара|пары)\b/i, 2],
  [/\bтри\b/i, 3],
  [/\bчетыре\b/i, 4],
  [/\bпять\b/i, 5],
];

/**
 * Сколько последних мест работы описать (сценарий: positions_count, collectKey positionsCount).
 * Допустимый диапазон 1–5 (сценарий рекомендует 2–4, но 1 и 5 допустимы как явный выбор).
 */
const MAX_REASONABLE_EXPERIENCE_YEARS = 55;

/**
 * Ищет в свободном тексте (ответ на «карьерный путь») явное указание стажа: «7 лет», «10+ лет», «1 год».
 * Используется, чтобы не задавать отдельный шаг total_experience, если годы уже сказаны вместе с ролью.
 */
export function parseTotalExperienceYearsFromText(raw: string): number | null {
  const t = raw.trim().toLowerCase().replace(/ё/g, 'е');
  if (!t) return null;

  const afterYearsNotExperience = (slice: string) =>
    /^\s*(назад|тому|ранее|до\s)/.test(slice);

  const tryCapture = (m: RegExpMatchArray | null): number | null => {
    if (!m || m[1] === undefined) return null;
    const full = m[0];
    const idx = m.index ?? 0;
    const tail = t.slice(idx + full.length, idx + full.length + 24);
    if (afterYearsNotExperience(tail)) return null;
    const n = parseInt(m[1], 10);
    if (!Number.isFinite(n) || n < 0 || n > MAX_REASONABLE_EXPERIENCE_YEARS) return null;
    return n;
  };

  // Не используем \b после кириллиики: в JS без /u границы «слова» для русских букв ненадёжны.
  const plus = t.match(/(?:^|\s)(\d{1,2})\s*\+\s*(?:лет|года|год)(?:\s|$|[,.!?]|(?=[A-Za-zА-Яа-яЁё]))/);
  const fromPlus = tryCapture(plus);
  if (fromPlus !== null) return fromPlus;

  const withLet = t.match(
    /(?:^|\s)(?:около|примерно|где-то)\s+(\d{1,2})\s*(?:лет|года|год)(?:\s|$|[,.!?]|(?=[A-Za-zА-Яа-яЁё]))/
  );
  const fromApprox = tryCapture(withLet);
  if (fromApprox !== null) return fromApprox;

  const withLetPlain = t.match(
    /(?:^|\s)(\d{1,2})\s*(?:лет|года|год)(?:\s|$|[,.!?]|(?=[A-Za-zА-Яа-яЁё]))/
  );
  const fromLet = tryCapture(withLetPlain);
  if (fromLet !== null) return fromLet;

  const wordLet = t.match(
    /(?:^|\s)(один|одна|одну|два|две|три|четыре|пять|шесть|семь|восемь|девять|десять)\s+(год|года|лет)(?:\s|$|[,.!?]|(?=[A-Za-zА-Яа-яЁё]))/
  );
  if (wordLet) {
    const idx = wordLet.index ?? 0;
    const tail = t.slice(idx + wordLet[0].length, idx + wordLet[0].length + 24);
    if (afterYearsNotExperience(tail)) return null;
    const w = wordLet[1];
    const map: Record<string, number> = {
      один: 1,
      одна: 1,
      одну: 1,
      два: 2,
      две: 2,
      три: 3,
      четыре: 4,
      пять: 5,
      шесть: 6,
      семь: 7,
      восемь: 8,
      девять: 9,
      десять: 10,
    };
    const n = map[w];
    if (n !== undefined && n >= 0 && n <= MAX_REASONABLE_EXPERIENCE_YEARS) return n;
  }

  return null;
}

export function parsePositionsCountAnswer(raw: string): number | null {
  const t = raw.trim().toLowerCase().replace(/ё/g, 'е');
  if (!t) return null;

  if (/^\d$/.test(t)) {
    const n = parseInt(t, 10);
    return n >= 1 && n <= 5 ? n : null;
  }

  const range = t.match(/(\d)\s*[-–]\s*(\d)/);
  if (range) {
    const lo = Math.min(parseInt(range[1], 10), parseInt(range[2], 10));
    const hi = Math.max(parseInt(range[1], 10), parseInt(range[2], 10));
    if (lo >= 1 && hi <= 5) {
      return Math.round((lo + hi) / 2);
    }
  }

  const digits = t.match(/\d+/g);
  if (digits?.length) {
    for (const d of digits) {
      const n = parseInt(d, 10);
      if (n >= 1 && n <= 5) return n;
    }
  }

  for (const [re, value] of RU_NUMBER_WORDS) {
    if (re.test(t)) return value;
  }

  return null;
}

/**
 * Значение для записи в collectedData: числовые шаги — число, иначе trim строки.
 */
export function resolveCollectValueForStep(
  collectKey: string | undefined,
  raw: string
): string | number {
  if (collectKey === 'positionsCount') {
    const n = parsePositionsCountAnswer(raw);
    if (n !== null) return n;
  }
  if (collectKey === 'totalExperience') {
    const y = parseTotalExperienceYearsFromText(raw);
    if (y !== null) return y;
  }
  return raw.trim();
}
