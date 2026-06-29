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
5. **Не коммитить** `.env`, `.env.staging.local`, секреты, credentials
6. **Минимальный diff** — не рефакторить и не менять несвязанный код

## Куда смотреть за контекстом

| Задача | Документ |
|--------|----------|
| Продукт и сценарии | `docs/PRODUCT.md` |
| Архитектура | `docs/ARCHITECTURE.md` |
| Dialogue Engine, агенты | `docs/guides/DIALOGUE_ENGINE.md` |
| Interview Prep prompts | `docs/INTERVIEW_TRAINER_PROMPT_V2.md` |
| Env-переменные | `docs/HISTORY/CONFIGURATION.md` |
| Тест-персоны | `docs/HISTORY/TEST_USERS_CHAT_ANSWERS.md` |
| Стиль кода | `docs/guides/CODE_STYLE.md` |
| Roadmap | `docs/ROADMAP.md` |
