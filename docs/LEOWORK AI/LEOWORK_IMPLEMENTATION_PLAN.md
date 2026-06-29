# План реализации LEOWORK AI

**Версия:** 1.0  
**Дата:** 2026-06-24  
**Статус:** Рабочий план внедрения  
**Источник правды (методология):** [`LEOWORK_METHODOLOGY.md`](./LEOWORK_METHODOLOGY.md)  
**Техническая спека:** [`LEOWORK_AI.md`](./LEOWORK_AI.md)  
**Ветка:** `feature/leowork-b2b`  
**Оценка горizonta:** ~20–24 недели (2–3 человека) после Фазы 0

---

## 0. Текущая база (baseline, 2026-06)

| Слой | Сделано | Не сделано |
|------|---------|------------|
| **Документация** | `LEOWORK_AI.md` (архитектура, схема, roadmap) | Методология ✅ этот doc |
| **B2B код** | — | Весь стек employer |
| **B2C supply** | `CollectedData`, career tracks, job-matching | Opt-in consent, export для B2B |
| **Matching** | `matchJobs()` (вакансии → кандидат) | `searchCandidates()` (кандидаты → brief) |
| **AI** | embeddings, generation controllers | Brief parser, candidate summary |
| **Email** | SMTP/API сервис | Intro templates |
| **Frontend** | LEO `/chat` 🟢 | `/employer/*` 🔵 |

**Переиспользуем без форка:**

- `services/job-matching/src/services/matcher.ts` — инверсия скоринга
- `services/job-matching/src/services/roleFamily.ts`
- `services/ai-nlp/` — parse brief, summary, embeddings
- `services/email/`
- `services/conversation/` — `CollectedData`, сценарий consent (Фаза 3)
- `infrastructure/postgres/` — pgvector, pg_trgm

---

## 1. Целевая архитектура

```
Работодатель (API key)
        ↓
┌─────────────────────────────────────────────────────────┐
│  LEOWORK B2B — /employer/*                               │
│  Briefs · Shortlist · Pipeline · Analytics               │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  services/employer/ (NEW)                                │
│  auth · briefs · search · intros · pipeline · billing    │
└───────┬─────────────────────────────┬───────────────────┘
        ↓                             ↓
  job-matching (invert)          ai-nlp (parse + summary)
        ↓                             ↓
  PostgreSQL employer.*        LEO candidates (opt-in only)
        ↓
  email (intro)  ←→  B2C consent (conversation scenario)
```

---

## 2. Фазы реализации

### Фаза 0 — Ручная валидация (0 кода, 2–4 нед)

**Цель:** доказать willingness to pay до MVP.

| # | Задача | DoD |
|---|--------|-----|
| 0.1 | 50–100 кандидатов с полным профилем в LEO | SQL-выборка + checklist полей |
| 0.2 | 3–5 работодателей (Telegram, LinkedIn) | Контакты + brief текстом |
| 0.3 | Ручной шортлист (SQL + таблица) | 3 brief × 5–10 карточек |
| 0.4 | Ручные intro (email/TG) | ≥5 intro sent |
| 0.5 | Feedback + кейсы | 2 hire **или** 5 компanies in funnel |

**Критерий перехода к Фазе 1:** строка 0.5 выполнена.

**Артефакты:** Google Sheet / Notion pipeline, шаблон intro-письма, 1–2 case study.  
**Чеклист:** [`PHASE_0_CHECKLIST.md`](./PHASE_0_CHECKLIST.md) (SQL, Sheet, intro templates).

---

### Фаза 1 — MVP Backend (4–6 нед)

**Цель:** API для B2B-кабинета — brief + search + shortlist.

#### Epic L1: Data & Auth

| # | Задача | Файлы / заметки |
|---|--------|-----------------|
| L1.1 | Migration `employer.*` (companies, api_keys, briefs, shortlists, pipeline_events) | `infrastructure/postgres/migrations/002_leowork_employer_schema.sql` |
| L1.2 | Сервис `services/employer/` scaffold | Express/Fastify как sibling services |
| L1.3 | API-key auth middleware (`leowork_live_…`, bcrypt) | §5 LEOWORK_AI.md |
| L1.4 | CLI: `generate-api-key --company` | scripts/ |
| L1.5 | Rate limit 100 req/min (Redis) | |

**DoD L1:** `POST /employer/briefs` с ключом → 201; invalid key → 401.

#### Epic L2: Brief & Search

| # | Задача | Файлы |
|---|--------|-------|
| L2.1 | `parseHiringBrief()` via ai-nlp | `employer/src/services/briefParser.ts` |
| L2.2 | `searchCandidates(brief)` — invert matcher | `employer/src/services/candidateSearch.ts` |
| L2.3 | Pre-filter: role_family + pgvector + experience | reuse `roleFamily.ts` |
| L2.4 | AI rank top-20 → shortlist 5–10 | ai-nlp prompt |
| L2.5 | `generateCandidateSummary()` | strengths, concerns, summary |

**DoD L2:** brief text → JSON brief → ranked list с anonymous cards; unit tests на scorer.

#### Epic L3: Shortlist & Calibration API

| # | Задача |
|---|--------|
| L3.1 | CRUD briefs |
| L3.2 | GET shortlist по brief_id |
| L3.3 | POST calibration feedback (yes/no/maybe + comment) |
| L3.4 | Pipeline event `sourced` / `shortlisted` |

**DoD Фазы 1:** Postman/CLI flow: key → create brief → search → list → calibrate.

---

### Фаза 2 — MVP Frontend (4–6 нед)

**Цель:** работодатель делает всё без Postman.

#### Epic L4: Shell & Auth UI

| # | Задача | Путь |
|---|--------|------|
| L4.1 | `employer/layout.tsx` синяя тема | `frontend/app/employer/` |
| L4.2 | Auth page (ввод API-key → session) | `employer/auth/` |
| L4.3 | Feature flag `LEOWORK_ENABLED` | env + middleware |

#### Epic L5: Core screens

| # | Задача | Путь |
|---|--------|------|
| L5.1 | Dashboard (briefs + метрики заглушки) | `employer/dashboard/` |
| L5.2 | Create brief (textarea → AI parse preview) | `employer/briefs/new/` |
| L5.3 | Brief detail + shortlist cards | `employer/briefs/[id]/` |
| L5.4 | Calibration UI (Да/Нет/Может) | inline на карточке |

#### Epic L6: Pipeline

| # | Задача |
|---|--------|
| L6.1 | Kanban `employer/pipeline/` |
| L6.2 | Drag → PATCH pipeline stage |
| L6.3 | Analytics stub (counts 30d) |

**DoD Фазы 2:** founder может пройти E1–E4 из CJM без разработчика; mobile-readable cards.

---

### Фаза 3 — Intros & Consent (3–4 нед)

**Цель:** закрытый цикл intro с согласием кандидата.

#### Epic L7: B2C Consent

| # | Задача | Файлы |
|---|--------|-------|
| L7.1 | Шаг opt-in в Jack/wannanew сценарии | `conversation/src/scenario/` |
| L7.2 | Поле `employer_intro_opt_in` в profile/Redis | user-profile |
| L7.3 | Filter: только opt-in в `candidateSearch` | employer service |

#### Epic L8: Intro flow

| # | Задача |
|---|--------|
| L8.1 | POST intro request → consent task |
| L8.2 | In-app card для кандидата (LEO UI) |
| L8.3 | Email intro (employer + candidate templates) |
| L8.4 | 48h timeout job |
| L8.5 | Anonymization levels на reveal |

**DoD Фазы 3:** E2E: HR intro → candidate accept → оба получают email; decline без утечки причины.

---

### Фаза 4 — Billing & Scale (3–4 нед)

| # | Задача |
|---|--------|
| L9.1 | Success fee tracking (`hired` → invoice record) |
| L9.2 | Landing LEOWORK (если нет ключа) |
| L9.3 | Settings: company profile, key rotation |
| L9.4 | Calibration → weight tuning (v1 rules) |
| L9.5 | HuntFlow / Telegram (optional) |

**DoD Фазы 4:** 1 тестовый invoice flow; GTM landing live.

---

## 3. Зависимости

```
Фаза 0 ──gate──► Фаза 1 L1 ──► L2 ──► L3
                              │
                              ▼
                         Фаза 2 L4 ──► L5 ──► L6
                              │
                              ▼
                    Фаза 3 L7 (B2C) ──► L8
                              │
                              ▼
                         Фаза 4 L9
```

**Критично:** L7 (opt-in) блокирует legal launch, даже если L2 технически работает на всех кандидатах.

---

## 4. Параллельность с Interview Prep

| Работа | Конфликт | Рекомендация |
|--------|----------|--------------|
| Interview Prep deploy | Нет | Сначала commit Prep → main |
| LEOWORK branch | Изоляция | Отдельная ветка |
| Consent в B2C | Да | Фаза 3 LEOWORK после стабилизации Prep |
| Shared matcher | Низкий | Extract shared scoring utils при инверсии |

---

## 5. Definition of Done (продукт)

**MVP launch (конец Фазы 3):**

- [ ] Работодатель: brief → shortlist < 2 мин
- [ ] ≥3 calibration feedback на brief
- [ ] Intro с consent и email
- [ ] Pipeline до `interviewing`
- [ ] Opt-in у кандидатов documented + в UI
- [ ] Audit log consent events
- [ ] `LEOWORK_ENABLED` prod flag
- [ ] 1 pilot company end-to-end

---

## 6. Риски (кратко)

| Риск | Митигация |
|------|-----------|
| Пустая база кандидатов | Фаза 0; GTM на Prep users |
| Плохой match v1 | Calibration + manual review первых 10 briefs |
| Legal (ФЗ-152) | Consent-first; legal review до Фазы 3 prod |
| Scope creep (ATS, SaaS) | Фаза 4+ only |

---

## 7. Следующий шаг (рекомендация)

1. **Закрыть Interview Prep** — commit + deploy (supply для LEOWORK).
2. **Старт Фазы 0** — таблица кандидатов + 3 пилотных HR (2 нед).
3. **Параллельно** — migration draft `employer.*` в ветке (L1.1, без merge).

---

## История версий

| Версия | Изменения |
|--------|-----------|
| 1.0 | Фазы 0–4, epics L1–L9, DoD, зависимости, gap baseline |
