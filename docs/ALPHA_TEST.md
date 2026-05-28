# Альфа-тест — чеклист перед ссылкой в канал

*Для закрытого теста на https://leo-ai.ru (10–50 человек)*

## Готовность платформы (2026-05-27)

| Критерий | Статус |
|----------|--------|
| Сайт доступен | ✅ `https://leo-ai.ru/` |
| Health всех сервисов | ✅ `https://leo-ai.ru/api/health` |
| OAuth Google / Yandex | ✅ (проверить вход **внешним** аккаунтом) |
| WannaNew → PDF | ✅ |
| Jack → чат + matching | ⚠️ нужен `HH_API_KEY` для живых вакансий |
| Поддержка | ✅ [@leoaisupportbot](https://t.me/leoaisupportbot) |
| Privacy / Terms | ✅ `/privacy`, `/terms` |

---

## Перед публикацией (15 минут)

1. **Health:** `curl -s https://leo-ai.ru/api/health` → `"status":"ok"` (или осознанный `degraded` с понятной причиной).
2. **OAuth:** войти с Google и Yandex с аккаунта, которого нет в тестовом allowlist.
3. **Один полный сценарий:** WannaNew до PDF **или** Jack до панели вакансий / email.
4. **Telegram:** написать боту `/start` — ответ и карточка в группе LEO Support (для операторов).
5. **Smoke (на VPS или Mac со стеком):** `npm run smoke:mvp0`

Готовые ответы для ручного прогона: [HISTORY/TEST_USERS_CHAT_ANSWERS.md](./HISTORY/TEST_USERS_CHAT_ANSWERS.md)

---

## Текст для поста в канал (шаблон)

```
LEO AI — альфа-тест карьерного AI-помощника

🔗 https://leo-ai.ru

Что попробовать:
1. Регистрация (Google / Яндекс или email)
2. «Новый чат» → «Подготовка к собеседованию» (PM-интервью + PDF-отчёт)
   или «Подбор вакансий» (диалог + подбор)

Важно:
• Лучше Chrome (голосовой ввод)
• Баги и вопросы → @leoaisupportbot

Это ранняя версия — возможны сбои. Спасибо за фидбек!
```

---

## Известные ограничения

- Голосовой **ввод** — браузерный (Chrome); не Safari/Firefox без fallback.
- **Вакансии Jack** — без ключей HH/SuperJob выдача может быть пустой.
- Один VPS — при пиковой нагрузке возможны задержки.
- OAuth Google: приложение должно быть в production mode (не только test users).

---

## Сбор фидбека

| Канал | Назначение |
|-------|------------|
| Telegram бот | Баги, вопросы, связь user ↔ оператор |
| PostHog | Воронки, события (если ключ в env) |
| Sentry | Ошибки backend/frontend |

После альфы — приоритеты в [ROADMAP.md](./ROADMAP.md) (E2E, HH API, server STT, MVP 1).
