import type { EnrichedProfile, JobPreferences } from '../types/enrichedProfile';

export function buildProfileEnrichmentSystemPrompt(phase: number): string {
  const base = `Ты — аналитик карьерного профиля LEO AI. Отвечай ТОЛЬКО валидным JSON без markdown.
Не выдумывай метрики и цифры, которых нет в исходных данных.
Не указывай вероятности отклика или проценты успеха на рынке.`;

  if (phase === 1) {
    return `${base}
Извлеки мягкие карьерные предпочтения из текста профиля.
Верни JSON:
{
  "domains": ["..."],
  "company_types": ["..."],
  "motivation": "кратко",
  "red_flags": ["..."],
  "seniority_target": "junior|middle|senior|lead или null"
}`;
  }

  if (phase === 4) {
    return `${base}
Составь краткий обзор рынка для кандидата (3–5 предложений на русском).
Обращайся к пользователю напрямую на «вы» (тет-а-тет), как LEO в чате.
Запрещено: третье лицо, имя кандидата («Марина…», «её опыт…», «делает её…»).
Можно: «у вас», «ваш опыт», «рекомендуем вам искать…».
Без оценочных суждений о личности и без процентов успеха.
Верни JSON: { "market_fit_summary": "..." }
Пример тона: «На рынке сильный спрос на product leadership. Ваш опыт в крупных IT-компаниях делает вас конкурентоспособным кандидатом. Рекомендуем вам смотреть роли Head of Product, Product Lead или CPO.»`;
  }

  if (phase === 5) {
    return `${base}
Извлеки достижения с метриками ТОЛЬКО если они явно указаны в тексте.
Верни JSON:
{
  "achievements_with_metrics": [
    {
      "position_index": 1,
      "company": "...",
      "role": "...",
      "achievement": "...",
      "metric_before": null,
      "metric_after": null,
      "timeframe": null,
      "ownership": null,
      "confidence": "user|inferred"
    }
  ]
}
Если метрик нет — metric_before и metric_after должны быть null, confidence: inferred только для переформулировки без цифр.`;
  }

  return base;
}

export function buildProfileEnrichmentUserPrompt(
  collectedData: Record<string, unknown>,
  ruleSignals?: Partial<EnrichedProfile>,
  marketContext?: { missingSkillsTop?: string[]; role_family?: string | null }
): string {
  const parts: string[] = ['Данные профиля (JSON):', JSON.stringify(collectedData, null, 0).slice(0, 12000)];
  if (ruleSignals) {
    parts.push('Уже выведено правилами:', JSON.stringify(ruleSignals, null, 0));
  }
  if (marketContext) {
    parts.push('Контекст рынка:', JSON.stringify(marketContext, null, 0));
  }
  return parts.join('\n\n');
}

export function mergeEnrichmentLlmPhase1(
  prefs: JobPreferences | undefined,
  llm: {
    domains?: string[];
    company_types?: string[];
    motivation?: string;
    red_flags?: string[];
    seniority_target?: string;
  }
): JobPreferences {
  return {
    ...prefs,
    domains: llm.domains?.length ? llm.domains : prefs?.domains,
    company_types: llm.company_types?.length ? llm.company_types : prefs?.company_types,
    motivation: llm.motivation?.trim() || prefs?.motivation,
    red_flags: llm.red_flags?.length ? llm.red_flags : prefs?.red_flags,
    seniority_target: llm.seniority_target?.trim() || prefs?.seniority_target,
  };
}
