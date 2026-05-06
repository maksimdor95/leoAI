# LeoAI VPS Staging Runbook (Cloud.ru + Docker Compose + Caddy)

Последнее обновление: 2026-05-06.

Документ фиксирует рабочий контур, который уже проверен на практике:
- VPS в Cloud.ru (Ubuntu 22.04, Free Tier);
- запуск сервисов через `docker compose`;
- reverse proxy и TLS через Caddy;
- публичный домен `leo-ai.ru` -> `84.54.57.209`;
- health endpoint: `https://leo-ai.ru/health`.

---

## 1. Целевая схема

- Хост: один VPS (Ubuntu 22.04).
- Контейнеры: `resume-parser`, `postgres`, `redis`.
- Публичный вход: только `22`, `80`, `443` и временно `3011` (для отладки).
- TLS: Caddy, автосертификат Let's Encrypt.

Рекомендуемое целевое состояние после стабилизации:
- оставить внешние порты `22`, `80`, `443`;
- закрыть прямой публичный доступ к `3011`;
- не публиковать наружу `5432/6379`.

---

## 2. Минимальный bootstrap сервера

```bash
sudo apt update && sudo apt upgrade -y
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

---

## 3. Деплой проекта на VPS

Вариант с локальной синхронизацией текущего состояния:

```bash
rsync -avz --exclude ".git" --exclude "node_modules" --exclude ".next" /Users/maxim/Project/leoAI/ ubuntu@84.54.57.209:/home/ubuntu/leoAI/
```

На сервере:

```bash
cd /home/ubuntu/leoAI
docker compose up -d --build
docker compose ps
```

---

## 4. Caddy + HTTPS

`/etc/caddy/Caddyfile`:

```caddy
leo-ai.ru {
    reverse_proxy 127.0.0.1:3011
}
```

Применение:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl restart caddy
sudo systemctl status caddy --no-pager
```

Проверка:

```bash
curl https://leo-ai.ru/health
```

Ожидаемо:

```json
{"status":"ok"}
```

---

## 5. Post-deploy checklist (операционная гигиена)

- [ ] В security group открыты только нужные входящие порты (`22/80/443`, опционально `3011` временно).
- [ ] `docker compose ps` показывает `Up`/`healthy` для критичных контейнеров.
- [ ] Health доступен по HTTPS: `https://leo-ai.ru/health`.
- [ ] Логи Caddy и контейнеров читаются без ошибок при старте.
- [ ] Настроен минимальный backup PostgreSQL (cron + retention).
- [ ] Подготовлен rollback-сценарий (последний рабочий compose + restart).
- [ ] Документированы команды для on-call (см. раздел ниже).

---

## 6. Шесть полезных команд (быстрый ops-набор)

```bash
# 1) Статус контейнеров
docker compose ps

# 2) Логи (последние 200 строк)
docker compose logs --tail=200

# 3) Перезапуск стека
docker compose down && docker compose up -d

# 4) Перезапуск только проблемного сервиса
docker compose restart resume-parser

# 5) Статус Caddy
sudo systemctl status caddy --no-pager

# 6) Быстрая проверка публичного health
curl -fsS https://leo-ai.ru/health
```

---

## 7. Обновление стенда за 1-2 минуты

```bash
cd /home/ubuntu/leoAI
docker compose pull
docker compose up -d --build
docker compose ps
```

Если код синхронизируется с ноутбука:

```bash
rsync -avz --exclude ".git" --exclude "node_modules" --exclude ".next" /Users/maxim/Project/leoAI/ ubuntu@84.54.57.209:/home/ubuntu/leoAI/
ssh -i ~/.ssh/id_ed25519 ubuntu@84.54.57.209 "cd /home/ubuntu/leoAI && docker compose up -d --build"
```

---

## 8. Известные нюансы

- После смены/делегирования NS домен может стать доступен не сразу (до 24 часов, иногда дольше).
- `curl -I /health` может вернуть `405` (HEAD не поддержан backend); для проверки используйте `GET`.
- Проверку внешних портов делайте с осторожностью: `nc -z` может давать шумные результаты; итоговый источник истины — `ss`/`docker ps` на сервере + прикладные проверки (`curl`, протокольные запросы).

