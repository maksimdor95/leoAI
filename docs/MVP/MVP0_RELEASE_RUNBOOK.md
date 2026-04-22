# MVP 0 Release Runbook

Этот документ используется как единый шаблон выкатки для solo-founder режима.

## 1) Pre-flight (T-1 день)

- Убедиться, что `JWT_SECRET` одинаковый во всех сервисах.
- Убедиться, что `USE_MOCK_JOBS=false` для production.
- Проверить, что все production ключи заданы (`YC_API_KEY`, `SMTP_*`, `HH_*`/`SUPERJOB_*`).
- Проверить CORS домен (`CORS_ORIGIN`) для production frontend.

## 2) Staging rehearsal (T-0)

1. Поднять staging environment с production-like env.
2. Прогнать smoke:

```bash
npm run smoke:mvp0
```

3. Пройти релизный сценарий вручную:
   - регистрация/логин;
   - диалог до конца;
   - финальный результат (email или PDF report).
4. Зафиксировать результат в таблице ниже.

| Проверка | Статус | Комментарий |
|---|---|---|
| Smoke gate | PASS/FAIL |  |
| Auth + session creation | PASS/FAIL |  |
| Completion flow | PASS/FAIL |  |
| Final artifact delivery | PASS/FAIL |  |
| Error handling (negative case) | PASS/FAIL |  |

## 3) Production rollout

1. Выполнить деплой сервисов.
2. Проверить `GET /health` для каждого сервиса.
3. Выполнить целевой user-flow сразу после деплоя.
4. Проверить ошибки в логах за первые 30 минут.

## 4) Rollback trigger

Откатываемся немедленно, если:
- не проходит login/session;
- не формируется финальный результат;
- 5xx растут и не стабилизируются в течение 15 минут.

## 5) Rollback steps

- Serverless: вернуться на предыдущую стабильную revision.
- PM2: переключиться на предыдущий commit/tag и перезапустить сервисы.
- Подтвердить восстановление через smoke и один ручной сценарий.
