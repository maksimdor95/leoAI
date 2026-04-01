# wannanew — AI-агент для подготовки PM к собеседованиям

## Обзор

**wannanew** — это AI-агент, который помогает Product Manager подготовиться к собеседованиям:

1. Анализирует текущий опыт кандидата (через резюме и диалог)
2. Формирует профиль Product Manager
3. Проводит голосовое пробное интервью
4. Выдаёт PDF-отчёт с оценкой, рекомендациями и типовыми вопросами ✅

**Фокус MVP**: одна профессия — Product Manager.

---

## Ценность продукта

### Для кандидата
- Понимание своего реального уровня как PM
- Подготовка к реальным собеседованиям
- Конкретные рекомендации по развитию
- Список типовых интервью-вопросов

### Для системы (будущее)
- Стандартизированный профиль PM
- Структурированные сигналы навыков
- Основа для мэтчинга с вакансиями

---

## Сценарий диалога (MVP)

ID сценария: `wannanew-pm-v1`

### Шаги сценария

| # | Step ID | Тип | Описание |
|---|---------|-----|----------|
| 1 | `greeting` | question | Приветствие, объяснение продукта, готовность начать |
| 2 | `resume_or_intro` | question | Загрузка резюме или описание опыта текстом |
| 3 | `target_role` | question | Целевая PM-роль: Junior, Middle, Senior, Lead, VP |
| 4 | `product_type` | question | Тип продукта: B2C, B2B, SaaS, Marketplace, Hardware, Internal tools |
| 5 | `pm_experience` | question | Ключевой продуктовый кейс: что делал, метрики, результат |
| 6 | `interview_start` | info_card | Подготовка к голосовому интервью, советы |
| 7 | `interview_q1` | question | Вопрос о приоритизации задач/фич |
| 8 | `interview_q2` | question | Вопрос о продуктовых метриках |
| 9 | `interview_q3` | question | Вопрос о работе со стейкхолдерами |
| 10 | `report_ready` | info_card | Завершение, кнопка скачивания PDF-отчёта ✅ |

### Собираемые данные (`collectKey`)

```typescript
{
  readyToStart: string;       // Готовность начать
  resumeOrIntro: string;      // Резюме или описание опыта
  targetRole: string;         // Junior | Middle | Senior | Lead | VP
  targetProductType: string;  // B2C | B2B | SaaS | Marketplace | etc.
  pmCase: string;             // Ключевой продуктовый кейс
  interviewAnswer1: string;   // Ответ на вопрос о приоритизации
  interviewAnswer2: string;   // Ответ на вопрос о метриках
  interviewAnswer3: string;   // Ответ на вопрос о стейкхолдерах
}
```

---

## Техническая реализация

### Файлы

| Путь | Описание |
|------|----------|
| `services/conversation/src/scenario/wannanewScenario.ts` | Определение сценария |
| `services/conversation/src/services/dialogueEngine.ts` | Регистр сценариев, движок |
| `services/conversation/src/types/session.ts` | Типы `ProductType`, `SessionMetadata` |
| `services/conversation/src/services/integrationService.ts` | Условная логика интеграций |

### Регистр сценариев

```typescript
// dialogueEngine.ts
const SCENARIOS: Record<string, ScenarioDefinition> = {
  'jack-profile-v2': JACK_SCENARIO,
  'wannanew-pm-v1': WANNANEW_SCENARIO,  // ← wannanew
};
```

### Создание сессии

```typescript
// POST /api/chat/session
{
  "createNew": true,
  "product": "wannanew"  // ← указать продукт
}
```

Результат:
```typescript
session.metadata = {
  product: 'wannanew',
  scenarioId: 'wannanew-pm-v1',
  // ...
}
```

### Завершение диалога

При завершении диалога (`handleConversationCompletion`):

- **Jack**: вызывается Job Matching → Email Notification
- **wannanew**: вызывается Report Service для генерации PDF-отчёта ✅

```typescript
// integrationService.ts
if (product === 'wannanew' || scenarioId === 'wannanew-pm-v1') {
  // Report generation triggered by user clicking "Download PDF" button
  return; // Skip job matching and email
}
```

---

## Frontend

### URL параметры

| URL | Описание |
|-----|----------|
| `/chat?new=true` | Новый чат с экраном выбора продукта ✅ |
| `/chat?new=true&product=wannanew` | Новый чат wannanew (прямой переход) |
| `/chat?new=true&product=jack` | Новый чат Jack (прямой переход) |
| `/chat?sessionId=xxx` | Продолжение существующей сессии |

### UI различия

| Элемент | Jack (LEO) | wannanew |
|---------|------------|----------|
| Заголовок | «Чат с LEO» | «Чат с wannanew» |
| Цвет акцента | Зелёный (`green-500`) | Фиолетовый (`purple-500`) |
| Метка в списке чатов | LEO (зелёная) | wannanew (фиолетовая) |
| Placeholder | «Напишите ответ или задайте вопрос LEO...» | «Напишите ответ или задайте вопрос...» |

### Страница списка чатов

**Единая кнопка создания чата** ✅:
- **«Новый чат»** → `/chat?new=true` → Экран выбора продукта

Каждая карточка чата отображает метку продукта (LEO — зелёная, wannanew — фиолетовая).

### Экран выбора продукта (NEW) ✅

При создании нового чата пользователь видит приветственный экран:
- Заголовок: «Привет! Я LEO, AI-помощник. Выбери с чего хочешь начать.»
- Две карточки:
  - **«Подбор вакансий»** → Jack сценарий
  - **«Подготовка к собеседованию»** → wannanew сценарий

---

## Голосовое интервью

wannanew использует **существующий голосовой стек**:

- **STT**: Web Speech API (`ru-RU`)
- **TTS**: Web Speech API для озвучки вопросов
- **Кнопки**: микрофон, mute

На этапах `interview_*` отображается подсказка:
> «Рекомендуем голосовой режим для интервью»

---

## Roadmap

### MVP (реализовано) ✅

- [x] Сценарий `wannanew-pm-v1` с 10 шагами
- [x] Регистр сценариев в `dialogueEngine.ts`
- [x] Поле `product` в сессиях
- [x] Условная логика интеграций (skip Job Matching для wannanew)
- [x] Frontend: выбор продукта, метки, брендинг

### PDF-отчёты (реализовано) ✅

- [x] Report Service (`services/report/`)
- [x] Генерация контента отчёта (reportGenerator.ts)
- [x] HTML-шаблон → PDF через Puppeteer (pdfGenerator.ts)
- [x] Хранение в Yandex Object Storage (storageService.ts)
- [x] Кнопка «Скачать PDF-отчёт» на последнем шаге
- [x] Signed URLs для безопасного скачивания

### Единая точка входа (реализовано) ✅

- [x] Экран выбора продукта (ProductSelectionScreen)
- [x] Единая кнопка «Новый чат» на странице списка
- [x] Динамический выбор сценария внутри чата

### Следующие этапы

1. **Загрузка файла резюме** (PDF/DOCX)
   - Endpoint `POST /api/wannanew/resume`
   - Парсинг текста (pdf-parse, mammoth)
   - UI компонент drag-and-drop

2. **Расширенное интервью**
   - Больше вопросов (5-7)
   - Follow-up логика на основе ответов
   - Адаптация под уровень PM

3. **AI-оценка ответов**
   - Интеграция с YandexGPT для анализа качества ответов
   - Персонализированные рекомендации
   - Сравнение с лучшими практиками

4. **Gap Analysis Agent**
   - Сравнение с идеальным профилем PM
   - Выявление пробелов
   - Диалоговое закрытие гэпов

---

## API Reference

### Создание сессии wannanew

```bash
curl -X POST https://api.example.com/api/chat/session \
  -H "X-Auth-Token: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "createNew": true,
    "product": "wannanew"
  }'
```

Response:
```json
{
  "sessionId": "uuid",
  "messages": [...],
  "metadata": {
    "product": "wannanew",
    "scenarioId": "wannanew-pm-v1",
    "status": "active",
    "collectedData": {}
  }
}
```

### Получение списка чатов

```bash
curl https://api.example.com/api/conversations \
  -H "X-Auth-Token: Bearer <token>"
```

Response:
```json
{
  "conversations": [
    {
      "id": "uuid",
      "product": "wannanew",
      "scenarioId": "wannanew-pm-v1",
      "preview": "...",
      "messageCount": 5,
      "updatedAt": "2025-01-24T..."
    }
  ]
}
```

### Генерация PDF-отчёта

```bash
# Запросить генерацию отчёта
curl -X POST https://api.example.com/api/chat/session/{sessionId}/report \
  -H "X-Auth-Token: Bearer <token>"
```

Response:
```json
{
  "reportId": "uuid",
  "status": "pending"
}
```

```bash
# Проверить статус и получить URL
curl https://api.example.com/api/chat/session/{sessionId}/report/{reportId} \
  -H "X-Auth-Token: Bearer <token>"
```

Response:
```json
{
  "reportId": "uuid",
  "status": "ready",
  "url": "https://storage.yandexcloud.net/..."
}
```

---

## Report Service

### Структура PDF-отчёта

1. **Заголовок** — данные кандидата, дата
2. **Профиль PM** — целевой уровень, тип продукта
3. **Общая оценка** — балл 1-10
4. **Оценка по категориям**:
   - Приоритизация
   - Метрики
   - Работа со стейкхолдерами
5. **Сильные стороны и зоны роста**
6. **Рекомендации по подготовке**
7. **Типовые вопросы** под уровень PM

### Технологии

- **Puppeteer** — генерация PDF из HTML
- **Handlebars** — шаблонизация HTML
- **AWS SDK S3** — совместимо с Yandex Object Storage
- **Redis** — хранение статуса генерации

### Файлы

| Путь | Описание |
|------|----------|
| `services/report/src/index.ts` | Точка входа сервиса |
| `services/report/src/services/reportGenerator.ts` | Генерация контента |
| `services/report/src/services/pdfGenerator.ts` | HTML → PDF |
| `services/report/src/services/storageService.ts` | Yandex Object Storage |

---

## Связанные документы

- [ARCHITECTURE.md](./ARCHITECTURE.md) — общая архитектура платформы
- [services/conversation/README.md](../services/conversation/README.md) — документация Conversation Service
- [План реализации](.cursor/plans/wannanew_pivot_additive_1ada3969.plan.md) — детальный план пивота
