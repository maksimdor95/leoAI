# LEOWORK — Фаза 0: чеклист ручной валидации

**Версия:** 1.0  
**Дата:** 2026-06-24  
**Статус:** Операционный чеклист (0 кода)  
**Методология:** [`LEOWORK_METHODOLOGY.md`](./LEOWORK_METHODOLOGY.md)  
**План:** [`LEOWORK_IMPLEMENTATION_PLAN.md`](./LEOWORK_IMPLEMENTATION_PLAN.md) § Фаза 0

---

## Цель

Доказать **willingness to pay** до MVP: работодатель получает ценность от анонимного шортлиста с контекстом и соглашается на intro / success fee.

**Gate в Фазу 1 (код):** выполнено **0.5** — **2 hire** *или* **5 компаний** в воронке (brief + шортлист + ≥1 intro).

---

## Неделя 1 — Supply (кандидаты)

### 0.1. Пул 50–100 «полных» профилей

**Критерий «полный профиль» (минимум для ручного шортлиста):**

| Поле | Источник | Обязательно |
|------|----------|-------------|
| Роль / target_role | `jack.career_tracks` | ✅ |
| Опыт (лет) | `experience_years` | ✅ |
| Навыки (≥5) | `jack.user_skills` + `jack.skills` | ✅ |
| Резюме (текст) | `jack.resumes` | ✅ желательно |
| Город / формат | Redis `CollectedData` или ручной допрос | желательно |
| ЗП ожидания | Redis / интервью | желательно |

> **Примечание:** структурированные данные LEO (мотивация, mock) живут в Redis-сессиях. На Фазе 0 допустимо **дополнять вручную** из чата LEO или тестовых персон ([`TEST_PERSONAS_CASE_STUDY.md`](../TEST_PERSONAS_CASE_STUDY.md)).

#### SQL: сколько кандидатов с базовым профилем

```sql
-- Подключение: docker exec -it leoai-postgres-1 psql -U postgres -d jack_ai

SELECT COUNT(DISTINCT u.id) AS users_with_track_and_skills
FROM jack.users u
JOIN jack.career_tracks ct ON ct.user_id = u.id AND ct.is_default = true
JOIN jack.user_skills us ON us.user_id = u.id
WHERE ct.target_role IS NOT NULL
  AND ct.experience_years IS NOT NULL;
```

#### SQL: экспорт пула для ручного отбора (анонимные карточки)

```sql
SELECT
  u.id AS candidate_user_id,
  'Кандидат #' || ROW_NUMBER() OVER (ORDER BY ct.updated_at DESC) AS display_name,
  ct.target_role,
  ct."current_role",
  ct.experience_years,
  ct.ai_readiness_score,
  STRING_AGG(DISTINCT s.skill_name, ', ' ORDER BY s.skill_name) AS skills,
  LEFT(r.resume_text, 500) AS resume_excerpt,
  u.created_at AS registered_at,
  ct.updated_at AS profile_updated_at
FROM jack.users u
JOIN jack.career_tracks ct ON ct.user_id = u.id AND ct.is_default = true
LEFT JOIN jack.user_skills us ON us.user_id = u.id
LEFT JOIN jack.skills s ON s.id = us.skill_id
LEFT JOIN LATERAL (
  SELECT resume_text
  FROM jack.resumes
  WHERE user_id = u.id
  ORDER BY created_at DESC
  LIMIT 1
) r ON true
WHERE ct.target_role IS NOT NULL
GROUP BY u.id, ct.id, r.resume_text
ORDER BY ct.updated_at DESC
LIMIT 100;
```

#### SQL: фильтр по role family (ручной pre-filter)

Подставьте `%product%`, `%backend%`, `%analytics%` и т.д.:

```sql
SELECT
  u.id,
  ct.target_role,
  ct.experience_years,
  STRING_AGG(DISTINCT s.skill_name, ', ') AS skills
FROM jack.users u
JOIN jack.career_tracks ct ON ct.user_id = u.id AND ct.is_default = true
LEFT JOIN jack.user_skills us ON us.user_id = u.id
LEFT JOIN jack.skills s ON s.id = us.skill_id
WHERE (
  ct.target_role ILIKE '%product%'
  OR ct."current_role" ILIKE '%product%'
)
AND ct.experience_years BETWEEN 3 AND 8
GROUP BY u.id, ct.id
ORDER BY ct.experience_years DESC
LIMIT 20;
```

**DoD 0.1:** таблица ≥50 строк с заполненными role + experience + skills; чеклист полей отмечен.

---

## Неделя 2 — Demand (работодатели)

### 0.2. 3–5 работодателей

| # | Компания | Контакт | Канал | Brief получен |
|---|----------|---------|-------|---------------|
| 1 | | | TG / LinkedIn / warm intro | ☐ |
| 2 | | | | ☐ |
| 3 | | | | ☐ |
| 4 | | | | ☐ |
| 5 | | | | ☐ |

**Шаблон запроса brief (копипаст в TG/LinkedIn):**

> Привет! Мы тестируем LEOWORK — AI-рекрутера, который за минуты собирает шортлист из pre-vetted кандидатов LEO (не HH).  
> Нужен один текст: роль, стек/навыки, уровень, формат, вилка ЗП, город.  
> В ответ пришлём 5–10 анонимных карточек с AI-summary и причинами match.  
> Первые 3 кандидата — бесплатно для калибровки. Интересно?

**DoD 0.2:** ≥3 brief в свободном тексте сохранены в папке/Notion.

---

## Неделя 2–3 — Ручной шортлист

### 0.3. 3 brief × 5–10 карточек

**Google Sheet / Notion — колонки:**

| brief_id | company | brief_title | candidate_ref | display_name | match_score (1-100) | strengths | concerns | verdict_hr |
|----------|---------|-------------|---------------|--------------|---------------------|-----------|----------|------------|
| B1 | | | uuid (внутр.) | Кандидат #3 | 85 | … | … | yes/no/maybe |

**Процесс на каждый brief:**

1. Прочитать brief → выписать must-have (роль, уровень, навыки, локация).
2. SQL pre-filter → 15–20 кандидатов.
3. Вручную отранжировать → топ 5–10.
4. Написать AI-summary вручную (или через ChatGPT/YandexGPT с промптом Analyst из методологии).
5. Отправить работодателю **только анонимные** карточки.
6. Собрать калибровку: минимум 3 verdict (Да/Нет/Может быть).

**Промпт для summary (копипаст):**

```
Ты hiring analyst LEOWORK. По brief и профилю кандидата верни JSON:
{
  "summary": "2-3 предложения для HR",
  "strengths": ["...", "..."],
  "concerns": ["...", "..."]
}
Brief: <текст>
Профиль: <роль, опыт, навыки, резюме excerpt>
Без выдуманных фактов. Concerns — честно.
```

**DoD 0.3:** 3 brief закрыты, ≥15 карточек отправлено, ≥9 feedback от HR.

---

## Неделя 3–4 — Intro

### 0.4. ≥5 ручных intro

**Перед intro — обязательно:**

1. Устное/письменное согласие кандидата (Фаза 0: вместо in-app consent).
2. Зафиксировать в таблице: `consent_at`, канал (TG/email/звонок).

**Таблица intro:**

| intro_id | brief | candidate | consent | sent_at | employer_reply | candidate_reply | outcome |
|----------|-------|-----------|---------|---------|----------------|-----------------|---------|
| I1 | B1 | uuid | ✅ | | interested/passed | accepted/declined | |

#### Шаблон: запрос согласия кандидату

**Тема:** Предложение о знакомстве с работодателем

> Привет, {имя}!  
>  
> Компания **{company}** ищет **{role}** ({format}, {location}). По твоему профилю в LEO это выглядит релевантно: {1 строка почему}.  
>  
> Можем сделать тёплое интро (имя + контакт HR) — без рассылки резюме на HH.  
> **Согласен(на)?** Ответь «да» / «нет» в течение 48 часов.  
>  
> Если «нет» — ничего не отправляем, работодатель не узнает причину.

#### Шаблон: intro письмо HR + кандидату (после consent)

**Кому:** HR + кандидат (отдельные письма или один thread)

**HR:**

> **Интро: {candidate_name} ↔ {company} · {role}**  
>  
> {candidate_name} — {target_role}, {experience_years} лет опыта.  
>  
> **Сильные стороны:** {strengths}  
> **На что обратить внимание:** {concerns}  
>  
> Контакт кандидата: {email/telegram}  
> Контакт HR: {contact_name}, {contact_email}  
>  
> Предлагаем созвон 20–30 мин. LEO AI только знакомит стороны.

**Кандидат:**

> **Интро с {company}**  
>  
> Роль: **{role}**  
> О компании: {1-2 предложения из brief}  
>  
> Контакт HR: {contact_name}, {contact_email}  
>  
> Удачи! Если не подойдёт — напиши нам, подберём дальше.

**DoD 0.4:** ≥5 intro sent, ≥3 с ответом хотя бы одной стороны.

---

## Неделя 4 — Итог

### 0.5. Feedback и кейсы

| Метрика | Цель | Факт |
|---------|------|------|
| Briefs | ≥3 | |
| Карточек отправлено | ≥15 | |
| Calibration feedback | ≥9 | |
| Intro sent | ≥5 | |
| Hire / offer | ≥2 **или** компаний в воронке | ≥5 |

**Вопросы для debrief с HR (5 мин звонок):**

1. Шортлист полезнее, чем HH? (1–10)
2. AI-summary попадало в реальность?
3. Сколько заплатили бы за 1 успешный hire (% от годовой ЗП)?
4. Что сломалось в процессе?

**Артефакты Фазы 0:**

- [ ] Google Sheet: pipeline + intro log
- [ ] 1–2 case study (анонимизированные) → `docs/LEOWORK AI/case-studies/`
- [ ] Список must-have для MVP (из боли HR)

---

## Связь с Фазой 1

После gate:

1. Ветка `feature/leowork-b2b` — миграция `employer.*` ([`002_leowork_employer_schema.sql`](../../infrastructure/postgres/migrations/002_leowork_employer_schema.sql)).
2. Ручные карточки из Sheet → эталон для тестов `searchCandidates()`.
3. Intro-шаблоны → `services/email/` (Фаза 3).

---

## Changelog

| Версия | Дата | Изменения |
|--------|------|-----------|
| 1.0 | 2026-06-24 | Первый чеклист: SQL, Sheet, intro templates, gate criteria |
