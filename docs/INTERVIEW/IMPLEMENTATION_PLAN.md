# План реализации LEO Interview Prep

**Версия:** 1.0  
**Дата:** 2026-06-22  
**Статус:** Рабочий план внедрения  
**Источник правды:** [`INTERVIEW_PREP_METHODOLOGY.md`](./INTERVIEW_PREP_METHODOLOGY.md) v1.3  
**Спеки:** [`INTERVIEW_PREP_MOCK_RITUAL_PROMPT_SPEC.md`](./INTERVIEW_PREP_MOCK_RITUAL_PROMPT_SPEC.md), [`INTERVIEW_PREP_RESCUE_PROMPT_SPEC.md`](./INTERVIEW_PREP_RESCUE_PROMPT_SPEC.md)

**Оценка горизонта:** ~8–12 недель (2–3 человека) при последовательном прохождении фаз.

---

## 0. Текущая база (baseline, 2026-06)

| Слой | Сделано | Не сделано |
|------|---------|------------|
| **Фазы 0, A, B, C** | Протокол мок/Rescue, theory learn/check, diagnostics PACK, PrepActivity, гейт мока, prep_complete, PDF, Pack UI | — |
| **Seniority §1.5** | `candidateSeniority`, rescue limits, `buildSeniorityIntensityPrompt` | — |
| **Frontend** | «Сегодня», артефакты, Pack-карточки, retention panel | — |
| **Role packs** | **11 семейств** (все кроме generalist) | — |
| **Retention E** | 2-я вакансия, STAR bank, shortened diagnostics, PDF v2 | — |
| **Документация** | `docs/INTERVIEW/` (методология, план, mock/rescue specs) | Merge 3 spec → один doc (опционально) |

**Ключевые файлы (уже в коде):**

- `services/conversation/src/utils/prepRetention.ts`
- `services/conversation/src/services/prepRetentionStore.ts`
- `services/conversation/src/services/dialogueEngine.ts` — `buildMockModeMessage`, Rescue в case/star
- `services/ai-nlp/src/services/interviewPrepPhasePrompts.ts`
- `services/ai-nlp/src/controllers/interviewPrepController.ts` — `responsePhase`

---

## 1. Целевая архитектура

```
Вакансия → vacancyProfile + prepPlan (структурированный)
                ↓
┌─────────────────────────────────────────────────────────┐
│  Подготовка (маршрут)                                    │
│  • Сегодня: LEARN / APPLY / PACK с чеклистами             │
│  • Прогресс % + гейт мока                                │
└───────────────────────┬─────────────────────────────────┘
                        ↓ клик на активность
┌─────────────────────────────────────────────────────────┐
│  Главная сцена + dialogueEngine                          │
│  LAR: Learn → Apply → Reflect → Pack                     │
│  Персоны: коуч | интервьюер | аналитик                   │
│  Фазы: theory_learn, rescue, mock_briefing/active/debrief │
└───────────────────────┬─────────────────────────────────┘
                        ↓
                   PDF / prep_complete
```

---

## 2. Фазы реализации

### Фаза 0 — Стабилизация сделанного ✅

| # | Задача | Статус |
|---|--------|--------|
| 0.1 | E2E мок: briefing → готов → rescue/mock flow | ✅ `interviewPrepModeFlow.test.ts` |
| 0.2 | E2E Rescue: слабый кейс → `rescue` | ✅ |
| 0.3 | Gap analysis актуален | ✅ v1.3+ |
| 0.4 | Доки в `docs/INTERVIEW/` | ✅ |

---

### Фаза A — Педагогика в промптах 🟡 (backend)

#### Epic A1: Теория = Learn → Check ✅ backend

- `lesson_phase` в `collectedData`
- `responsePhase: theory_learn | theory_check`
- `buildTheoryModeMessage` в dialogueEngine

#### Epic A2: Диагностика → PACK ✅ backend

- `diagnosticsHistory`, `diagnostics_pack` после 4 ответов или «итог»
- `buildDiagnosticsModeMessage`

#### Epic A3: Персоны в default path ✅

- `buildInterviewCorePersona(mode)` — coach vs interviewer

#### Epic A4: Seniority в рантайме ✅

- `candidateSeniority` при разборе вакансии ✅
- Rescue limits через `resolveCandidateSeniorityLevel` ✅
- Матрица интенсивности в промпт ✅
- Корректировка prepPlan по уровню (AI) ✅ `buildPrepPlanSeniorityBlock`

**Следующая фаза:** B1 `PrepActivity`

### Фаза B — Вкладка «Подготовка» (2–3 спринта)

**Цель:** маршрут в UI. CJM E1, E2, E7.

#### Epic B1: Модель `PrepActivity`

```typescript
type PrepActivity = {
  id: string;
  day: number;
  type: 'learn' | 'apply' | 'pack';
  title: string;
  mode: InterviewPrepMode;
  durationMin?: number;
  required: boolean;
};
```

| Задача | Детали |
|--------|--------|
| Генерация из `prepPlan` | Rule-based + AI enrich |
| API прогресса | `prepProgress` в session или endpoint |
| Персист | `collectedData.prepProgress` |

#### Epic B2: UI «Сегодня» (§6.1)

| Компонент | Содержание |
|-----------|------------|
| `PrepTodayPanel` | Цель дня, 🎓 / 🎯 / 📋 |
| Чеклисты | Клик → режим + стартовое сообщение §6.3 |
| Прогресс | `2/5 дней · N%` |

**Файлы:** `frontend/app/chat/page.tsx`, `PrepPlanCard.tsx`, новый `PrepTodayPanel.tsx`

#### Epic B3: Гейт мока

| Условие | Источник |
|---------|----------|
| Диагностика ✓ | `prepProgress` |
| ≥2 урока (junior: ≥3) | count theory completed |
| ≥1 STAR | star graded |

**UI:** disabled «Мок» + tooltip. **Backend:** проверка перед `mockPhase: briefing`.

#### Epic B4: UX мока и Rescue

| Задача | UI |
|--------|-----|
| «Начать мок» на сцене | Альтернатива «готов» |
| Бейдж «Разбор коуча» | `rescueTriggered` / `responsePhase` |
| «Вопрос 2/3» | `mockInterview.currentQuestionIndex` |

---

### Фаза C — Завершение и артефакты (1.5–2 спринта)

**Цель:** E8, Pack для кандидата.

#### Epic C1: `prep_complete`

- Info card / шаг сценария после мок + день 5
- Чеклист готовности §9.2
- CTA: PDF / новая вакансия

#### Epic C2: PDF-отчёт (§9)

| Слой | Задача |
|------|--------|
| API | `POST /api/report/interview-prep/:sessionId` |
| Агрегация | profile, gradings, STAR, rescue, mockSummary |
| Шаблон | HTML → PDF |
| UI | Кнопка в Подготовке |

**DoD:** 4–8 стр., резюме на 1-й странице, без дампа чата.

#### Epic C3: Pack в UI

- `packType` на message metadata
- Секция «Артефакты» в Подготовке
- Включение в PDF

---

### Фаза D — Role packs (2+ спринта, параллельно)

| P | Pack | Работа |
|---|------|--------|
| P0 | `engineering_systems` | ✅ Full pack × 6 режимов |
| P0 | `qa_quality` | ✅ `inferRoleTrack` + pack |
| P1 | `sales_commercial` | ✅ Ролевой мок, STAR, 6 режимов |
| P1 | `operations_delivery` | ✅ Full pack × 6 режимов |
| P2 | `leadership_behavioral` | ✅ Full pack × 6 режимов |
| P2 | `design_ux` | ✅ `inferRoleTrack` + pack |
| P3 | `marketing_growth` | ✅ Full pack × 6 режимов |
| P3 | `customer_success` | ✅ Full pack × 6 режимов |
| P3 | `hr_people` | ✅ Full pack × 6 режимов |

**DoD:** тест детекции + 6 mode prompts + §12.3 обновлён. **Фаза D закрыта.**

---

### Фаза E — Retention v1.1 ✅

См. методологию §13.4: вторая вакансия, STAR bank (Redis + `collectedData`), сокращённая диагностика, `PrepRetentionPanel`.

| Компонент | Статус |
|-----------|--------|
| `prepRetention.ts` + Redis star bank | ✅ |
| Welcome при 2-й вакансии | ✅ |
| `prepContext` в prep plan | ✅ |
| UI банк STAR / история | ✅ |
| PDF «было/стало» v2 | ✅ |
| `employer_questions` Pack auto-tag | ✅ |
| prepPlan seniority (AI) | ✅ |

---

## 3. Зависимости

```
Фаза 0 → B3, B4
A1 (теория) → B2
A2 (диагностика PACK) → B2
B1 (PrepActivity) → B2, B3, C2
B2 → B3
B3 → C1
B1 + A2 → C2 (PDF)
C1 → C2
```

**Критический путь:** `A1` → `B1` → `B2` → `B3` → `C1/C2`.

---

## 4. Роли

| Роль | Фазы |
|------|------|
| Backend / conversation | A (engine), B3, C1 |
| AI / prompts | A, D |
| Frontend | B, B4, C |
| Report | C2 |
| Контент | A1, A2, D |

---

## 5. Релизы и метрики

| Релиз | Must-have | Метрика §10 |
|-------|-----------|-------------|
| **R1** | Фаза 0 + A | ≥70% сессий с уроком |
| **R2** | Фаза B | >40% доходят до мока |
| **R3** | Фаза C | >50% скачивают PDF |
| **R4** | Фаза D P0 | Качество Dev/QA interviews |

---

## 6. Ближайшие 2 недели (старт внедрения)

| Неделя | Фокус |
|--------|-------|
| 1 | **0.1–0.2** стабилизация мок/Rescue; **A1** теория Learn/Check |
| 2 | **B1** PrepActivity model; **B2** начало «Сегодня»; **A2** диагностика PACK |

После R1-порога: **B3** гейт мока, **B4** UI polish.

---

## 7. Риски

| Риск | Митигация |
|------|-----------|
| LLM не держит Learn | Фаза в `collectedData`, не только промпт |
| Прогресс при refresh | Персист в session/DB |
| PDF scope | Снимок на mock complete |
| Доки расходятся | Один METHODLOGY + этот PLAN |

---

*Обновлять этот документ при закрытии эпиков. Синхронизировать с §11 методологии.*
