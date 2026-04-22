# Мультиагентная система Dialogue Engine

## Обзор

Мультиагентная система диалогового движка автоматически валидирует ответы пользователя, анализирует полноту профиля и отслеживает отклонения от темы. Все агенты работают через YandexGPT.

## Архитектура

```
Dialogue Engine (handleUserReply)
    |
    +---> Context Manager Agent (проверка отклонений от темы)
    |     POST /api/ai/check-context
    |     YandexGPT -> { onTopic, deviation, shouldRedirect, importantInfo }
    |
    +---> Validator Agent (валидация качества ответа)
    |     POST /api/ai/validate-answer
    |     YandexGPT -> { quality, reason, suggestion }
    |     Если quality !== 'good' -> переход на шаг 'clarify'
    |
    +---> Profile Analyst Agent (анализ полноты профиля)
          POST /api/ai/analyze-profile (при завершении диалога)
          YandexGPT -> { completeness, hasGaps, criticalGaps, readyForMatching }
          Если hasGaps && criticalGaps.length > 0 -> переход на шаг 'completion_gap'
```

## Агенты

### 1. Validator Agent

Валидация качества ответов пользователя. Вызывается после каждого ответа (кроме шагов `clarify` и `completion_gap`).

**Эндпоинт**: `POST /api/ai/validate-answer`

**Параметры**: `{ question, answer, collectedData?, stepId }`

**Ответ**: `{ quality: 'good' | 'unclear' | 'irrelevant', reason, suggestion? }`

**Поведение**:
- `unclear` / `irrelevant` — переход на шаг `clarify`, ответ не сохраняется
- `good` — продолжение, ответ сохраняется в `collectedData`

| Вопрос | Ответ | Результат |
|--------|-------|-----------|
| "Какую должность вы ищете?" | "Product Manager" | `good` — продолжение |
| "Какую должность вы ищете?" | "да" | `irrelevant` — `clarify` |
| "Какой у вас опыт?" | "немного" | `unclear` — `clarify` |

**Файлы**: `ai-nlp/src/controllers/validationController.ts`, `conversation/src/services/aiClient.ts`

---

### 2. Profile Analyst Agent

Анализ полноты профиля кандидата. Вызывается при завершении диалога (шаг `additional` или `nextStepId === null`).

**Эндпоинт**: `POST /api/ai/analyze-profile`

**Параметры**: `{ collectedData?, completedSteps?, currentStepId }`

**Ответ**: `{ completeness (0-1), hasGaps, criticalGaps[], missingFields[], contradictions[], readyForMatching }`

**Критичные поля**: `desiredRole`, `totalExperience`, `location`

**Поведение**:
- Есть критичные пробелы — переход на `completion_gap`
- `readyForMatching: true` — завершение, переход к matching

**Файлы**: `ai-nlp/src/controllers/profileController.ts`, `conversation/src/services/aiClient.ts`

---

### 3. Context Manager Agent

Отслеживание отклонений от темы. Вызывается перед валидацией ответа.

**Эндпоинт**: `POST /api/ai/check-context`

**Параметры**: `{ conversationHistory?, currentStep, userMessage }`

**Ответ**: `{ onTopic, deviation, shouldRedirect, importantInfo[] }`

**Поведение**:
- Отклонение — сохраняет подсказку в `contextRedirectHint` для следующего вопроса
- Важная информация из отклонения сохраняется
- Не блокирует flow

**Файлы**: `ai-nlp/src/controllers/contextController.ts`, `conversation/src/services/aiClient.ts`

---

## Порядок обработки ответа

```
1. Пользователь отвечает
   |
2. Context Manager проверяет отклонение
   +-- Отклонение: сохраняет подсказку
   +-- Продолжает flow
   |
3. Validator валидирует качество
   +-- unclear/irrelevant: переход на clarify
   +-- good: продолжает
   |
4. Сохранение ответа в collectedData
   |
5. Определение следующего шага (resolveNextStep)
   |
6. При завершении:
   +-- Profile Analyst анализирует полноту
       +-- Пробелы: completion_gap
       +-- Готов: завершение и matching
```

## Настройки YandexGPT по агентам

| Агент | Temperature | MaxTokens | Причина |
|-------|-------------|-----------|---------|
| Validator | 0.3 | 200 | Детерминированные оценки |
| Profile Analyst | 0.2 | 500 | Структурированный анализ |
| Context Manager | 0.3 | 300 | Баланс точности и гибкости |

## Обработка ошибок (fallback)

Все агенты имеют fallback при недоступности YandexGPT:

- **Validator**: `{ quality: 'good' }` — не блокирует flow
- **Profile Analyst**: `{ completeness: 0.5, hasGaps: true }` — предполагает неполный профиль
- **Context Manager**: `{ onTopic: true, shouldRedirect: false }` — предполагает ответ в теме

## Специальные шаги

### Шаг `clarify`
Уточнение неясного ответа. Возвращает на предыдущий шаг после получения качественного ответа. Может повторяться.

### Шаг `completion_gap`
Предложение заполнить критичные пробелы в профиле при завершении диалога. Пользователь выбирает: заполнить сейчас или продолжить как есть.

## Расширение системы

Для добавления нового агента:

1. Создать контроллер в `ai-nlp/src/controllers/`
2. Добавить роут в `ai-nlp/src/index.ts`
3. Создать клиент в `conversation/src/services/aiClient.ts`
4. Интегрировать в `conversation/src/services/dialogueEngine.ts`
