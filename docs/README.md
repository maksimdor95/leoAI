# LEO AI Documentation

База знаний проекта LEO AI. Публичный стенд: **https://leo-ai.ru**

## Текущий статус (2026-05-27)

| Область | Статус |
|---------|--------|
| MVP 0 (Jack + WannaNew E2E) | Завершён, стенд на VPS |
| OAuth (Google / Yandex) | Настроен на `leo-ai.ru` |
| TTS (озвучка LEO) | Yandex SpeechKit на сервере |
| STT (голосовой ввод) | Web Speech API в браузере (Chrome) |
| Мониторинг | Sentry + PostHog (при DSN/ключах в env) |
| Поддержка | Telegram [@leoaisupportbot](https://t.me/leoaisupportbot) |
| Альфа-тест / канал | См. [ALPHA_TEST.md](./ALPHA_TEST.md) |

---

## Основные разделы

| Документ | Описание |
|----------|----------|
| [PRODUCT.md](./PRODUCT.md) | Видение, сценарии (Jack, WannaNew, Interview Prep) |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Сервисы, порты, AI, голос, данные |
| [OPERATIONS.md](./OPERATIONS.md) | Локальный запуск, env, ops-чеклист |
| [ROADMAP.md](./ROADMAP.md) | Статус, ближайшие задачи, MVP 1 |
| [STAGING_DEPLOY.md](./STAGING_DEPLOY.md) | Деплой на VPS (`dev:deploy:staging`) |
| [ALPHA_TEST.md](./ALPHA_TEST.md) | Чеклист перед ссылкой в канал |
| [INTERVIEW_TRAINER_PROMPT_V2.md](./INTERVIEW_TRAINER_PROMPT_V2.md) | Interview Prep Prompt V2 |

### Guides

| Документ | Описание |
|----------|----------|
| [guides/CODE_STYLE.md](./guides/CODE_STYLE.md) | Стиль кода |
| [guides/DATABASE.md](./guides/DATABASE.md) | База данных |
| [guides/DIALOGUE_ENGINE.md](./guides/DIALOGUE_ENGINE.md) | Диалоговый движок |

### История и чеклисты

Архивные runbook'и и дневные чеклисты MVP0/MVP1: [HISTORY/](./HISTORY/)

| Документ | Описание |
|----------|----------|
| [HISTORY/DEVELOPMENT_PLAN.md](./HISTORY/DEVELOPMENT_PLAN.md) | Детальный план (снимок + статусы) |
| [HISTORY/CONFIGURATION.md](./HISTORY/CONFIGURATION.md) | Полный справочник переменных окружения |
| [HISTORY/WANNANEW.md](./HISTORY/WANNANEW.md) | Спецификация WannaNew |
| [HISTORY/MVP1_PRODUCT_PLATFORM_PLAN.md](./HISTORY/MVP1_PRODUCT_PLATFORM_PLAN.md) | План MVP 1 |
| [HISTORY/TEST_USERS_CHAT_ANSWERS.md](./HISTORY/TEST_USERS_CHAT_ANSWERS.md) | Готовые ответы для ручного теста чата |

### Сервисы (код)

| Сервис | README |
|--------|--------|
| Telegram Support | [services/telegram-support/README.md](../services/telegram-support/README.md) |

---

## Быстрые ссылки

- **Health (агрегатор):** https://leo-ai.ru/api/health
- **Сайт:** https://leo-ai.ru/
- **Staging deploy:** `ssh ubuntu@84.54.57.209` → `cd ~/leoAI` → `npm run dev:deploy:staging`
- **Smoke:** `npm run smoke:mvp0`

---

*Последнее обновление: 2026-05-27*
