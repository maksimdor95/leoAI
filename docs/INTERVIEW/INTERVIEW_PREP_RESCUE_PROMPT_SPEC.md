# Prompt Spec: Rescue Protocol (§4.6)

**Версия:** 1.0  
**Связь:** `INTERVIEW_PREP_METHODOLOGY.md` §4.6  
**Код:** `interviewPrepPhasePrompts.ts`, `interviewPrepProtocol.ts`, `dialogueEngine.ts`

---

## Цель

Предотвратить отвал после слабого ответа (CJM E5): переключение интервьюер → коуч, структура, вторая попытка.

## Триггеры (`shouldTriggerFullRescue`)

| Условие | Порог |
|---------|-------|
| `overallScore` | < 4 |
| `fatalGaps.length` | ≥ 2 |
| Явный сигнал | «не знаю», «затрудняюсь», ответ < 25 символов |

**Режимы:** `case`, `star` — полный Rescue.  
**Мок:** только `mock_micro_rescue` (§ MOCK_RITUAL), не полный Rescue.

## Лимит попыток (`getRescueAttemptLimit`)

| Seniority | Попыток |
|-----------|---------|
| junior | 3 |
| middle | 2 |
| senior | 2 |
| lead | 1 |

Источник: `vacancyProfile.level` → `inferSeniority()`.

## Алгоритм (dialogueEngine)

```
1. grade answer (case/star)
2. if shouldTriggerFullRescue && rescueCount < limit:
     responsePhase = 'rescue'
     rescueCount++
3. else responsePhase = 'default'
4. generate response with grading in prompt
```

## System prompt overlay (`rescue`)

- LEO-коуч ONLY (not interviewer).
- Follow 7-step Rescue protocol in user instructions.
- No markdown headers; conversational tone.
- End with ONE narrow retry ask.

## User prompt template (`buildRescueRespondPrompt`)

Steps for the model:

1. СТОП — выхожу из режима интервьюера.
2. НОРМАЛИЗАЦИЯ — типичная точка роста, не провал.
3. ДИАГНОЗ — 1–2 fatalGap.
4. СКЕЛЕТ — modelStructure (3 пункта).
5. МИКРО-LEARN — 2 предложения рамки.
6. ПОВТОР — узкий аспект для retry.
7. Pack hint — мини-шпаргалка в конце (3 строки).

## `collectedData` keys

| Key | Type |
|-----|------|
| `{mode}RescueCount` | number (e.g. `caseRescueCount`) |
| `lastRescueAt` | ISO string |
| `lastInterviewGrade` | grading object |

## API

`POST /api/ai/interview/respond` — `responsePhase: 'rescue'`

Grading обязателен при `responsePhase === 'rescue'`.
