# Prompt Spec: Mock Interview Ritual (§4.5)

**Версия:** 1.0  
**Связь:** `INTERVIEW_PREP_METHODOLOGY.md` §4.5  
**Код:** `interviewPrepPhasePrompts.ts`, `interviewPrepProtocol.ts`, `dialogueEngine.ts`  
**План:** [`IMPLEMENTATION_PLAN.md`](./IMPLEMENTATION_PLAN.md) — фазы 0, B3, B4

---

## Цель

Снять страх мока (CJM E6): не начинать с жёсткого интервьюера. Три фазы: **briefing → active → debrief**.

## State machine

| `mockPhase` | Персона | Триггер входа | Триггер выхода |
|-------------|---------|---------------|----------------|
| `briefing` | LEO-коуч | `interview_mode:mock` / «Начать режим: Мок» | Пользователь: «готов» |
| `active` | LEO-интервьюер | После «готов» | 3 ответа с grading |
| `debrief` | Коуч → аналитик | 3-й ответ | Итог отправлен |
| `complete` | — | debrief done | Новый мок (сброс) |

## M0 — Briefing (статический шаблон, без LLM)

```
Сейчас начнём пробное собеседование. Я переключусь в роль нанимающего менеджера по вакансии «{role}».

Это безопасная среда: цель — увидеть пробелы до реального собеса, а не получить оффер.

Формат: 3 вопроса, по одному. После каждого — короткий разбор. В конце — итоговый отчёт.

Когда будете готовы — напишите «готов».
```

## Active — System prompt overlay (`mock_active`)

- Behave as hiring manager only.
- Ask exactly ONE interview question per turn.
- After answer: 1–2 sentences of tough feedback OR one probe — then next question if < 3 answers.
- Do NOT soften weak answers; do NOT teach at length (micro-rescue handles structure hint).
- No markdown headers or bullet lists.

## Micro-rescue (`mock_micro_rescue`)

When `overallScore < 4` between mock questions:

- Max 1 sentence of answer structure hint.
- Then immediately the next interview question OR probe.
- Do NOT switch to full coach mode.

## M2 — Debrief (`mock_debrief`)

System: coach + analyst personas.

User payload includes mock summary JSON from `generate-mock-summary`.

Output structure (conversational, no ### headers):

1. «Мок завершён. Выхожу из роли интервьюера.»
2. Честный итог: 3 сильные стороны, 3 пробела, 3 действия до собеса.
3. Короткое закрытие: что повторить в теории / STAR / кейсе.

## `collectedData` keys

| Key | Type | Описание |
|-----|------|----------|
| `mockPhase` | `briefing \| active \| deburb \| complete` | Текущая фаза |
| `mockAnswers` | `array` | Ответы + grading |
| `mockSummary` | `string` | Итог после debrief |

## API

`POST /api/ai/interview/respond` — поле `responsePhase`:

- `mock_active`
- `mock_micro_rescue`
- `mock_debrief`

`mock_briefing` не вызывает API — статический текст в `dialogueEngine`.
