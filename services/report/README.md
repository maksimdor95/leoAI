# Report Service

Сервис генерации PDF-отчётов для платформы AIheroes (wannanew).

## Назначение

Report Service отвечает за:
- Сбор данных из сессии диалога
- Генерацию контента отчёта (оценка, рекомендации)
- Создание PDF-документа
- Хранение файлов в облачном хранилище
- Предоставление безопасных ссылок для скачивания

## Технологии

- **Node.js** (TypeScript) + Express
- **Puppeteer** — генерация PDF из HTML
- **Handlebars** — шаблонизация HTML
- **AWS SDK S3** — совместимо с Yandex Object Storage
- **Redis** — хранение статуса генерации

## Структура

```
services/report/
├── src/
│   ├── index.ts                    # Точка входа
│   ├── config/
│   │   └── redis.ts                # Конфигурация Redis
│   ├── controllers/
│   │   └── reportController.ts     # HTTP handlers
│   ├── routes/
│   │   └── reportRoutes.ts         # API routes
│   ├── services/
│   │   ├── reportService.ts        # Оркестратор генерации
│   │   ├── reportGenerator.ts      # Генерация контента
│   │   ├── pdfGenerator.ts         # HTML → PDF
│   │   └── storageService.ts       # Object Storage
│   ├── middleware/
│   │   ├── auth.ts                 # JWT авторизация
│   │   └── errorHandler.ts         # Обработка ошибок
│   ├── types/
│   │   └── report.ts               # TypeScript типы
│   └── utils/
│       ├── logger.ts               # Логирование
│       └── healthCheck.ts          # Health endpoint
├── package.json
├── tsconfig.json
└── Dockerfile
```

## API Endpoints

### POST /api/report/generate

Запустить генерацию отчёта.

**Request:**
```json
{
  "sessionId": "uuid",
  "userId": "uuid"
}
```

**Response:**
```json
{
  "reportId": "uuid",
  "status": "pending"
}
```

### GET /api/report/:reportId/status

Получить статус генерации.

**Response:**
```json
{
  "reportId": "uuid",
  "status": "ready",
  "url": "https://storage.yandexcloud.net/..."
}
```

Возможные статусы: `pending`, `generating`, `ready`, `error`

### GET /api/report/:reportId/download

Скачать PDF (redirect на signed URL).

## Структура PDF-отчёта

1. **Заголовок** — логотип wannanew, дата
2. **Профиль кандидата** — целевой уровень, тип продукта
3. **Общая оценка** — балл 1-10
4. **Оценка по категориям**:
   - Приоритизация
   - Метрики
   - Работа со стейкхолдерами
5. **Сильные стороны** — список достоинств
6. **Зоны для развития** — что улучшить
7. **Рекомендации** — советы по подготовке
8. **Типовые вопросы** — под уровень PM

## Переменные окружения

```env
# Сервер
PORT=3007
NODE_ENV=development

# Redis
REDIS_URL=redis://localhost:6379

# JWT (должен совпадать с другими сервисами)
JWT_SECRET=your-secret-key

# Conversation Service (для получения данных сессии)
CONVERSATION_SERVICE_URL=http://localhost:3002

# Yandex Object Storage
YC_STORAGE_ENDPOINT=https://storage.yandexcloud.net
YC_STORAGE_REGION=ru-central1
YC_STORAGE_BUCKET=aiheroes-reports
YC_STORAGE_ACCESS_KEY=your-access-key
YC_STORAGE_SECRET_KEY=your-secret-key

# Puppeteer (для Docker)
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
```

### Настройка YC (mark2) и Object Storage

В корне репо выполнить (нужны `yc` CLI и каталог mark2):

```powershell
.\scripts\setup-yc-mark2.ps1
```

Скрипт создаёт в каталоге **mark2**:
- SA `ai-nlp-sa` с ролью `ai.languageModels.user`, API key → обновляет `services/ai-nlp/.env` (YC_API_KEY);
- SA `aiheroes-storage` с ролью `storage.editor`, access key, бакет → пишет `services/report/.env` (YC_STORAGE_*).

## Запуск

### Локальная разработка

```bash
cd services/report
npm install
npm run dev
```

### Docker

```bash
docker build -t report-service .
docker run -p 3007:3007 --env-file .env report-service
```

## Интеграция с Conversation Service

Report Service вызывается через проксирующий endpoint в Conversation Service:

```bash
# Клиент вызывает
POST /api/chat/session/{sessionId}/report

# Conversation Service проксирует на
POST http://report-service:3007/api/report/generate
```

## Генерация контента

### Данные из сессии

Сервис получает `collectedData` из сессии:
- `targetRole` — уровень PM (Junior, Middle, Senior, Lead, VP)
- `targetProductType` — тип продукта (B2C, B2B, SaaS, etc.)
- `pmCase` — ключевой продуктовый кейс
- `interviewAnswer1..3` — ответы на интервью-вопросы
- `resumeOrIntro` — описание опыта

### Алгоритм оценки

Простой алгоритм на основе длины и качества ответов:
- Короткие ответы (<50 символов) → низкий балл
- Средние ответы (100-300 символов) → средний балл
- Развёрнутые ответы (>400 символов) → высокий балл

В будущем: интеграция с YandexGPT для семантического анализа.

### Типовые вопросы

Список вопросов генерируется на основе `targetRole`:
- **Junior**: базовые вопросы о продуктовом мышлении
- **Middle**: вопросы о метриках и приоритизации
- **Senior**: стратегические вопросы, лидерство
- **Lead/VP**: вопросы о масштабировании и организации

## Мониторинг

### Health check

```bash
curl http://localhost:3007/health
```

Response:
```json
{
  "status": "ok",
  "service": "report-service",
  "timestamp": "2025-01-24T..."
}
```

### Логи

Все важные события логируются:
- Начало/завершение генерации
- Ошибки
- Загрузка в Object Storage
- Генерация signed URL

## Связанные документы

- [ARCHITECTURE.md](../../docs/ARCHITECTURE.md) — общая архитектура
- [WANNANEW.md](../../docs/WANNANEW.md) — документация wannanew
- [Conversation Service](../conversation/README.md) — интеграция
