# Эксплуатация и Настройка LEO AI

## 1. Локальная разработка (SETUP)

### Требования
- Node.js 18+, Docker, Docker Compose.

### Быстрый старт
1. `npm install` в корне и во всех `services/*`.
2. `docker compose up -d` (запуск Postgres и Redis).
3. `npm run dev:up` (запуск всех сервисов).
4. Открыть `http://localhost:3000`.

---

## 2. Конфигурация (.env)

Все сервисы требуют единый `JWT_SECRET`.

### Обязательные переменные
- `DB_PASSWORD`, `JWT_SECRET`.
- `YC_API_KEY`, `YC_FOLDER_ID` (для работы AI).
- `SMTP_USER`, `SMTP_PASSWORD` (для Email).

### Справочник портов
- Frontend: 3000
- User Profile: 3001
- Conversation: 3002
- AI/NLP: 3003
- Job Matching: 3004
- Email: 3005
- Report: 3007

---

## 3. Деплой на VPS (RUNBOOK)

Актуальный контур: **Cloud.ru VPS + Docker Compose + Caddy**.

### Команды для деплоя
```bash
# Синхронизация кода
rsync -avz --exclude ".git" --exclude "node_modules" ./ ubuntu@84.54.57.209:/home/ubuntu/leoAI/

# Запуск на сервере
ssh ubuntu@84.54.57.209 "cd /home/ubuntu/leoAI && docker compose up -d --build"
```

### Caddy (Reverse Proxy)
Конфиг `/etc/caddy/Caddyfile`:
```caddy
leo-ai.ru {
    reverse_proxy 127.0.0.1:3011
}
```

---

## 4. Операционный чеклист (Ops)

- **Статус:** `docker compose ps`.
- **Логи:** `docker compose logs --tail=100 -f`.
- **Health Check:** `https://leo-ai.ru/health`.
- **Бэкап:** Настроен cron для дампа PostgreSQL.
- **Безопасность:** Открыты только порты 22, 80, 443.
