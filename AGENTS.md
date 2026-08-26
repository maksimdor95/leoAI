# LEO AI — правила для coding agent

AI-платформа карьерного развития: **Jack** (подбор вакансий), **WannaNew** (PM-интервью + PDF), **Interview Prep**. Стенд: https://leo-ai.ru

**Стек:** Next.js 14, Express/TypeScript microservices, YandexGPT, PostgreSQL, Redis.

## Границы сервисов

| Сервис | Путь | Ответственность |
|--------|------|-----------------|
| `frontend` | `frontend/` | UI, чат, WebSocket-клиент |
| `conversation` | `services/conversation/` | Dialogue Engine, сценарии (`scenario/*.ts`), оркестрация |
| `ai-nlp` | `services/ai-nlp/` | YandexGPT, промпты, агенты (Validator, Context, Profile Analyst) |
| `job-matching` | `services/job-matching/` | Matcher, role family, scraping, LLM enrichment |
| `user-profile` | `services/user-profile/` | Auth, JWT, OAuth, резюме |
| `report` | `services/report/` | PDF-отчёты |
| `email` | `services/email/` | Email-дайджесты |

**Не дублировать:** промпты и вызовы YandexGPT — только в `ai-nlp`. Сценарии и state machine — только в `conversation`.

## Ключевые файлы

- Диалог: `services/conversation/src/services/dialogueEngine.ts`
- Сценарии: `services/conversation/src/scenario/` (`jack-profile-v2`, `wannanew-pm-v1`, `interview-prep-v1`)
- AI-клиент: `services/conversation/src/services/aiClient.ts`
- Интеграции (matching, PDF, email): `services/conversation/src/services/integrationService.ts`
- Промпты Interview Prep: `services/ai-nlp/src/services/interviewPrepPrompts.ts`
- Расширение источников вакансий: `docs/JOB_SOURCES_EXPANSION.md`, `services/job-matching/src/services/connectors/`
- Extended-only ingest (без HH): `scrapeExtendedOnly` / `POST /api/jobs/scrape/extended` (см. §10 pipeline refactor)
- Scrape worker: `services/job-matching` → `npm run worker:scrape` (dev:up поднимает `job-matching-worker`; API с `SCRAPE_INLINE_WORKER=false`)
- Hygiene revalidate: cron `revalidate-jobs` @:45 — HH + SJ + Getmatch + Habr + Geekjob + career_*; archive только явный gone (404/410); `JOB_REVALIDATE_SOURCES` для поэтапного rollout
- Match: softCap≤97; LLM rerank top-N (`MATCH_LLM_RERANK_*`, meta `matchLayers.llmRerank`); Redis cache (`MATCH_CACHE_*`, `?fresh=1`); slim/capped response (`MATCH_RETURN_*`)
- Insight (вакансии): one-click add gaps → `skills_hard`/`skills_soft` + rematch; `profileSignals.missingSkillsDetails`; courses carousel from static catalog; phase-4 `next_actions`
- LEO Med (Phase 0–3): `services/job-matching/src/services/med/` + `data/med/`; taxonomy `med_taxonomy.json` from `docs/med/taxonomy_meditsina_rf.md`; `ENABLE_MED_VERTICAL`; `GET\|POST /api/jobs/med/*`
- LEO Med вход — только чат: авто-детект по `desired_role` (`GET /api/jobs/med/map-role`) → ветка шагов `med_*` в `jackScenario` → consent A → `med_specialists`; вакансии в той же панели (`getMatchedJobs` берёт `findMedFeed` при `medRoleId`). Отдельных страниц `/med` нет
- LEO Med taxonomy source: `docs/med/taxonomy_meditsina_rf.md` (Phase 2 input)
- LEO Med DoD: skill `.cursor/skills/leo-med-phase-dod/` (`verify` / `ready` после каждой Phase)

## Команды

```bash
npm run dev:up              # локальный запуск всех сервисов
npm run dev:status          # статус сервисов
npm run smoke:mvp0          # smoke-тест MVP0
npm run lint                # ESLint (корень)
```

Тесты по сервису: `cd services/<name> && npm test`

**CI gate** (`.github/workflows/ci.yml`): перед merge должны проходить Jest в `conversation`, `ai-nlp`, `job-matching`, `user-profile` и light smoke (`mvp0-smoke.sh` с TOKEN).

**Eval harness** (`services/conversation/src/evals/`): автопрогон Jack personas. Новый шаг сценария → обновить fixture в `evals/fixtures/`.

## Hard rules

1. **Новый шаг сценария** → обновить `dialogueEngine.test.ts` + persona в `docs/HISTORY/TEST_USERS_CHAT_ANSWERS.md`
2. **Fail-open fallbacks** (Validator → `good`, Context → `onTopic`) — не менять без обновления `docs/guides/DIALOGUE_ENGINE.md`
3. **Промпты YandexGPT** — только в `services/ai-nlp/`, не в `conversation`
4. **Matching rules** — правки в `matcher.ts` / `roleFamily.ts` → тесты в `services/job-matching/src/services/__tests__/`
5. **Extended job sources** — только additive + `ENABLE_EXTENDED_JOB_SOURCES`; не ломать HH/SJ (`docs/JOB_SOURCES_EXPANSION.md`)
6. **Не коммитить** `.env`, `.env.staging.local`, секреты, credentials
7. **Минимальный diff** — не рефакторить и не менять несвязанный код
8. **Agreed plan = full delivery** — согласованный план из N пунктов доводить до DoD по всем пунктам; не сдавать частичный срез как «готово» и не урезать scope молча (см. `.cursor/rules/agreed-plan-full-delivery.mdc`)
9. **DoD целиком или режем scope** — либо закрываем DoD полностью, либо явно согласовываем урезание; запрещены «готово с оговорками» / done with caveats (см. `.cursor/rules/dod-or-cut-scope.mdc`)

## Куда смотреть за контекстом

| Задача | Документ |
|--------|----------|
| Продукт и сценарии | `docs/PRODUCT.md` |
| Архитектура | `docs/ARCHITECTURE.md` |
| Dialogue Engine, агенты | `docs/guides/DIALOGUE_ENGINE.md` |
| Источники вакансий (M7+) | `docs/JOB_SOURCES_EXPANSION.md` |
| Interview Prep prompts | `docs/INTERVIEW_TRAINER_PROMPT_V2.md` |
| Env-переменные | `docs/HISTORY/CONFIGURATION.md` |
| Тест-персоны | `docs/HISTORY/TEST_USERS_CHAT_ANSWERS.md` |
| Стиль кода | `docs/guides/CODE_STYLE.md` |
| Roadmap | `docs/ROADMAP.md` |
