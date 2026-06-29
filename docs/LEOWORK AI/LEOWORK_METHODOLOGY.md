# Методология LEOWORK AI

**Версия:** 1.0  
**Дата:** 2026-06-24  
**Статус:** Продуктовая методология (B2B для работодателей)  
**Аудитория:** продукт, sales, промпт-инженерия, UX, backend, legal/compliance  
**Техническая спека:** [`LEOWORK_AI.md`](./LEOWORK_AI.md)  
**План внедрения:** [`LEOWORK_IMPLEMENTATION_PLAN.md`](./LEOWORK_IMPLEMENTATION_PLAN.md)

---

## Манифест

LEOWORK AI — **не доска резюме**, а AI-рекрутер на стороне работодателя.

Работодатель описывает роль одним текстом — LEOWORK за минуты находит **pre-vetted** кандидатов из базы LEO AI, объясняет *почему* они подходят (не только *что* в CV), и организует **тёплое интро** только после согласия кандидата.

LEO AI (B2C) собирает то, чего нет в резюме: цели, мотивацию, зарплатные ожидания, культуру, сильные/слабые стороны из mock-интервью. LEOWORK продаёт работодателю **контекст + скорость**, а не доступ к HH.

**Consent-first:** кандидат никогда не передаётся без явного согласия (ФЗ-152, этика, доверие к бренду LEO).

---

## 0. Зачем этот документ

LEOWORK — двусторонний продукт. Методология отвечает на четыре вопроса:

1. **Что** продаём работодателю — шортлист с AI-контекстом и интро, не «100 резюме».
2. **Как** принимаем решение о match — brief → pre-filter → score → AI rank → summary.
3. **Где** в продукте — B2B-кабинет `/employer/*`, pipeline, consent в B2C.
4. **Когда** можно показывать PII — только после per-intro consent.

[`LEOWORK_AI.md`](./LEOWORK_AI.md) — архитектура, схема БД, API. Этот документ — **поведение продукта и правила**.

---

## 1. Философия продукта

### 1.1. Принцип «Brief — источник правды»

Каждый поиск начинается с **Hiring Brief** — структурированного разбора роли (аналог `vacancyProfile` в Interview Prep, но со стороны работодателя).

| Вход работодателя | Что строим |
|-------------------|------------|
| Свободный текст / JD | `HiringBrief`: title, skills, level, location, salary, work_mode, role_family |
| Уточнения в UI | Калибровка весов и must-have |
| Feedback «Да/Нет» | `calibration_feedback` для следующего поиска |

### 1.2. Модель цикла: **Brief → Search → Review → Intro → Hire**

```
Brief     — работодатель описывает роль; AI парсит и показывает preview базы
Search    — обратный матчинг: кандидаты под brief (не вакансии под профиль)
Review    — анонимные карточки + AI-summary; калибровка
Intro     — запрос consent → раскрытие контактов → intro-текст обеим сторонам
Hire      — pipeline до offer/hired; success fee
```

Калибровка (3 бесплатных кандидата на старте) — обязательный этап **до** массовых интро.

### 1.3. Две персоны LEOWORK (промпты)

| Персона | Когда | Тон | Запрещено |
|---------|-------|-----|-----------|
| **LEOWORK-Sourcer** | Парсинг brief, preview «~N в базе» | Бизнес-ясный, без воды | Выдумывать кандидатов |
| **LEOWORK-Analyst** | AI-summary, strengths/concerns на карточке | Честный hiring manager | Скрывать red flags |
| **LEOWORK-Matchmaker** | Intro-текст для HR и кандидата | Тёплый, персонализированный | Раскрывать PII до consent |

### 1.4. Три уровня данных кандидата

| Уровень | Что видит работодатель | Когда |
|---------|------------------------|-------|
| `anonymous` | «Кандидат #N», роль, опыт, навыки, AI-summary | Шортлист, до intro |
| `partial` | Имя, без текущей компании | После consent (partial) |
| `full` | Контакты, текущая компания | После consent (full) |

---

## 2. Роли в продукте (поверхности)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         LEO AI (B2C) + LEOWORK AI (B2B)                   │
├─────────────────────────────┬────────────────────────────────────────────┤
│   LEO — кандидат            │   LEOWORK — работодатель                   │
│   🟢 /chat                  │   🔵 /employer/*                           │
│   • Профиль, цели, mock     │   • Briefs, шортлист, pipeline             │
│   • Opt-in на интро         │   • Intro, аналитика, billing              │
└─────────────────────────────┴────────────────────────────────────────────┘
```

### 2.1. B2B-кабинет — что это

**Операционная система найма** для HR/фounder, не лендинг.

Содержит:

1. **Briefs** — вакансии работодателя.
2. **Shortlist** — анонимные карточки с AI-контекстом.
3. **Pipeline** — kanban: sourced → shortlisted → intro → interview → offer → hired.
4. **Analytics** — конверсия, time-to-intro, calibration accuracy.

### 2.2. Связь с B2C

| Данные LEO (B2C) | Использование LEOWORK |
|------------------|------------------------|
| `CollectedData` / career track | Скоринг, summary |
| Interview Prep / mock | strengths, gaps для HR |
| `employer_intro_opt_in` | Допуск в пул поиска |
| Per-intro consent | Раскрытие карточки |

---

## 3. CJM: двусторонний путь

### 3.1. Работодатель (primary)

| Этап | Действие | Ценность | Риск |
|------|----------|----------|------|
| E1 | Получил API-key / demo | Вход в кабинет | Сложная регистрация |
| E2 | Создал brief (текст → AI parse) | Preview «N в базе» | Пустая база → churn |
| E3 | Получил шортлист 5–10 | AI-summary за минуты | Плохой match → недоверие |
| E4 | Калибровка Да/Нет (3 free) | Обучение модели | Без feedback — повтор ошибок |
| E5 | Запросил intro | Тёплый кандидат | Долгий consent |
| E6 | Pipeline → interview → hire | Success fee | Нет visibility статуса |

### 3.2. Кандидат (secondary, но критичный)

| Этап | Действие | Ценность | Риск |
|------|----------|----------|------|
| C1 | Opt-in «получать предложения» | Контроль | Спам-ощущение |
| C2 | In-app / email: запрос intro | Релевантная роль | Непрозрачность employer |
| C3 | Accept / Decline | Автономия | Утечка текущему работодателю |
| C4 | Intro состоялось | Экономия времени | Плохой match после accept |

### 3.3. Персоны работодателя (GTM)

| Персона | JTBD | Что важно в UI |
|---------|------|----------------|
| Founder/CEO (≤50) | Быстро закрыть ключевую роль | Скорость, 3 free calibration |
| HR generalist | Поток кандидатов, отчётность | Pipeline, analytics |
| Hiring manager | Качество fit | strengths/concerns, калибровка |

---

## 4. Ядро методологии: обратный матчинг

> Алгоритм и веса — §6 [`LEOWORK_AI.md`](./LEOWORK_AI.md). Здесь — **продуктовый контракт**.

### 4.1. Pipeline скоринга (5 шагов)

1. **Brief Parser** — raw → `HiringBrief` + embedding.
2. **Pre-filter** — role_family, pgvector, experience band → 50–200 кандидатов.
3. **Detailed score** — role 30 + skills 25 + location 20 + experience 15 + format 10 (+ bonus).
4. **AI rank** — топ-20 с учётом мотивации, salary fit, «горячести».
5. **Summary** — `ai_summary`, `ai_strengths`, `ai_concerns` на карточке.

### 4.2. Калибровка (обязательна на Фазе 1)

После первого шортлиста работодатель помечает карточки:

- **Да** — усилить похожие сигналы.
- **Нет** — negative signal (+ опциональный комментарий).
- **Может быть** — soft signal.

Минимум **3 feedback** перед unlock полного intro-пакета (GTM: «3 бесплатных кандидата»).

### 4.3. «Горячесть» кандидата

| Сигнал | Вес в rank |
|--------|------------|
| Активность в LEO за 14 дней | Высокий |
| Заполненность профиля | Средний |
| Mock / interview-prep complete | Средний |
| Explicit «ищу работу» | Высокий |

---

## 5. Consent Flow (методология)

### 5.1. Два уровня

1. **Глобальный opt-in** (B2C) — шаг в сценарии LEO после профиля.
2. **Per-intro consent** — на каждый запрос intro от работодателя.

Без (1) кандидат **не попадает** в search. Без (2) работодатель видит только `anonymous`.

### 5.2. SLA intro

| Событие | Срок | Действие |
|---------|------|----------|
| Intro запрошен | 0 | Push/email/in-app кандидату |
| Нет ответа | 48 ч | Auto-decline |
| Decline | — | HR видит «не заинтересован» (без причины) |
| Accept | — | Раскрытие по уровню + intro email |

### 5.3. Каналы (приоритет)

1. In-app LEO  
2. Email (`services/email`)  
3. Telegram (Фаза 4+)

---

## 6. Pipeline найма (стадии)

Единый enum для API, UI и аналитики:

| Стадия | Кто двигает | Триггер |
|--------|-------------|---------|
| `sourced` | System | Попал в шортлист |
| `shortlisted` | Employer | Явно в shortlist |
| `intro_sent` | System | Запрос intro |
| `intro_accepted` | Candidate | Consent |
| `intro_declined` | Candidate / timeout | Decline |
| `interviewing` | Employer | Ручной drag kanban |
| `offer_extended` | Employer | |
| `hired` | Employer | Success fee |
| `rejected` | Employer | |

---

## 7. Метрики успеха

### 7.1. Продуктовые (B2B)

| Метрика | Цель (MVP) |
|---------|------------|
| Time to shortlist | < 2 мин после brief |
| Calibration rate | > 70% briefs с ≥3 feedback |
| Intro accept rate | > 40% |
| Brief → hired | baseline TBD (Фаза 0) |

### 7.2. Качество match

| Метрика | Как мерить |
|---------|------------|
| «Да» после калибровки | % карточек marked yes |
| Repeat search quality | Δ yes-rate на 2-м поиске |
| Employer NPS | Опрос после 1-го hire |

### 7.3. B2C / supply

| Метрика | Цель |
|---------|------|
| Opt-in rate | > 30% активных профилей |
| Intro response < 48h | > 60% |

---

## 8. Gap analysis: методология vs текущий код

> Детальный план: [`LEOWORK_IMPLEMENTATION_PLAN.md`](./LEOWORK_IMPLEMENTATION_PLAN.md)

| Требование | Статус | Фаза |
|------------|--------|------|
| B2B-сервис `employer/` | ❌ | 1 |
| Schema `employer.*` | ❌ | 1 |
| API-key auth | ❌ | 1 |
| Brief parser (AI) | ❌ | 1 |
| Обратный matcher | ❌ | 1 (invert `matcher.ts`) |
| AI summary на карточке | ❌ | 1 |
| Frontend `/employer/*` | ❌ | 2 |
| Pipeline kanban | ❌ | 2 |
| Global opt-in (B2C) | ❌ | 3 |
| Per-intro consent | ❌ | 3 |
| Intro emails | ❌ | 3 |
| Success fee billing | ❌ | 4 |
| **Прямой матчинг B2C** (`matchJobs`) | ✅ | reuse |
| **Role family** | ✅ | reuse |
| **Embeddings** | ✅ | reuse |
| **Email service** | ✅ | reuse |
| **CollectedData** | ✅ | reuse |

**Легенда:** ✅ есть · 🟡 частично · ❌ не начато

---

## 9. Принципы разработки

1. **Ветка `feature/leowork-b2b`** — не мержить в main до Фазы 2 DoD.
2. **Feature flag** `LEOWORK_ENABLED` — B2B-роуты off по умолчанию.
3. **Изоляция B2C** — consent-шаги не ломают Jack / interview-prep.
4. **Фаза 0 без кода** — 2+ hire или 5 компаний в воронке перед MVP backend.
5. **Anonymous by default** — PII только после consent audit log.

---

## 10. Связь с LEO Interview Prep

Interview Prep повышает **качество supply** для LEOWORK:

| Interview Prep | LEOWORK |
|----------------|---------|
| `vacancyProfile` | паттерн для `HiringBrief` |
| Mock + grading | `ai_strengths` / concerns |
| `fatalGaps` | honest concerns на карточке |
| PDF отчёт | опционально «Candidate pack» для HR (Фаза 4+) |

---

## Приложение A. Глоссарий

| Термин | Определение |
|--------|-------------|
| Hiring Brief | Структурированная вакансия работодателя |
| Shortlist | 5–10 анонимных карточек после search |
| Intro | Запрос на знакомство с consent |
| Calibration | Feedback Да/Нет для обучения ранжирования |
| Success fee | 8–10% годовой ЗП при hire |
| Supply | Кандидаты LEO с opt-in |

## Приложение B. Ссылки

- [`LEOWORK_AI.md`](./LEOWORK_AI.md) — архитектура, БД, API, wireframes
- [`LEOWORK_IMPLEMENTATION_PLAN.md`](./LEOWORK_IMPLEMENTATION_PLAN.md) — фазы, DoD, файлы
- [`../INTERVIEW/INTERVIEW_PREP_METHODOLOGY.md`](../INTERVIEW/INTERVIEW_PREP_METHODOLOGY.md) — эталон методологии B2C

---

## История версий

| Версия | Изменения |
|--------|-----------|
| 1.0 | Манифест, CJM, цикл Brief→Hire, consent, pipeline, gap analysis |
