# Мультиагентная система Dialogue Engine

## Обзор

Мультиагентная система для диалогового движка Jack позволяет автоматически валидировать ответы пользователя, анализировать полноту профиля и отслеживать отклонения от темы диалога. Система использует YandexGPT для интеллектуальной обработки ответов пользователя.

## Архитектура

```
Dialogue Engine (handleUserReply)
    │
    ├─→ Context Manager Agent (проверка отклонений от темы)
    │   └─→ POST /api/ai/check-context
    │       └─→ YandexGPT → { onTopic, deviation, shouldRedirect, importantInfo }
    │
    ├─→ Validator Agent (валидация качества ответа)
    │   └─→ POST /api/ai/validate-answer
    │       └─→ YandexGPT → { quality, reason, suggestion }
    │       └─→ Если quality !== 'good' → переход на шаг 'clarify'
    │
    └─→ Profile Analyst Agent (анализ полноты профиля)
        └─→ POST /api/ai/analyze-profile (при завершении диалога)
            └─→ YandexGPT → { completeness, hasGaps, criticalGaps, readyForMatching }
            └─→ Если hasGaps && criticalGaps.length > 0 → переход на шаг 'completion_gap'
```

## Агенты

### 1. Validator Agent

**Назначение**: Валидация качества ответов пользователя

**Когда вызывается**: После каждого ответа пользователя (кроме шагов `clarify` и `completion_gap`)

**Функции**:

- Определяет качество ответа: `good`, `unclear`, `irrelevant`
- Выявляет неясные или нерелевантные ответы
- Предлагает конкретные подсказки для уточнения

**Эндпоинт**: `POST /api/ai/validate-answer`

**Параметры**:

```typescript
{
  question: string;        // Текст вопроса
  answer: string;          // Ответ пользователя
  collectedData?: object; // Собранные данные
  stepId: string;          // ID текущего шага
}
```

**Ответ**:

```typescript
{
  quality: 'good' | 'unclear' | 'irrelevant';
  reason: string;          // Объяснение оценки
  suggestion?: string;     // Подсказка для уточнения
}
```

**Поведение**:

- Если `quality === 'unclear'` или `'irrelevant'`:
  - Переход на шаг `clarify`
  - Ответ не сохраняется в `collectedData`
  - Пользователю задается уточняющий вопрос с `suggestion`
- Если `quality === 'good'`:
  - Продолжение обычного flow
  - Ответ сохраняется и происходит переход к следующему шагу

**Примеры**:

| Вопрос                      | Ответ             | Результат                |
| --------------------------- | ----------------- | ------------------------ |
| "Какую должность вы ищете?" | "Product Manager" | `good` → продолжение     |
| "Какую должность вы ищете?" | "да"              | `irrelevant` → `clarify` |
| "Какой у вас опыт?"         | "немного"         | `unclear` → `clarify`    |

**Файлы**:

- `services/ai-nlp/src/controllers/validationController.ts`
- `services/conversation/src/services/aiClient.ts` → `validateAnswer()`
- `services/conversation/src/services/dialogueEngine.ts` → интеграция

---

### 2. Profile Analyst Agent

**Назначение**: Анализ полноты профиля кандидата

**Когда вызывается**: При завершении диалога (шаг `additional` или когда `nextStepId === null`)

**Функции**:

- Определяет полноту профиля (0.0 - 1.0)
- Выявляет критичные и важные пробелы
- Обнаруживает противоречия в данных
- Определяет готовность к matching

**Эндпоинт**: `POST /api/ai/analyze-profile`

**Параметры**:

```typescript
{
  collectedData?: object;    // Собранные данные профиля
  completedSteps?: string[];  // Завершенные шаги
  currentStepId: string;      // Текущий шаг
}
```

**Ответ**:

```typescript
{
  completeness: number;        // 0.0 - 1.0
  hasGaps: boolean;            // Есть ли пробелы
  criticalGaps: string[];      // Критичные поля (desiredRole, totalExperience, location)
  missingFields: string[];     // Все отсутствующие поля
  contradictions: string[];   // Описания противоречий
  readyForMatching: boolean;   // Готов ли профиль к matching
}
```

**Критичные поля**:

- `desiredRole` (должность) — обязательно
- `totalExperience` (опыт работы) — обязательно
- `location` (локация) — обязательно

**Важные поля**:

- `workFormat` (формат работы)
- `skills` (навыки)
- `salaryExpectation` (зарплата)

**Поведение**:

- Если `hasGaps && criticalGaps.length > 0`:
  - Переход на шаг `completion_gap`
  - Пользователю предлагается заполнить пробелы
  - Список отсутствующих полей включается в вопрос
- Если `readyForMatching`:
  - Завершение диалога
  - Переход к matching

**Примеры**:

| Собранные данные                | Результат                                          |
| ------------------------------- | -------------------------------------------------- |
| Все критичные поля заполнены    | `readyForMatching: true` → завершение              |
| Отсутствует `desiredRole`       | `criticalGaps: ['desiredRole']` → `completion_gap` |
| Опыт < 1 года, но senior навыки | `contradictions: ['...']` → предупреждение         |

**Файлы**:

- `services/ai-nlp/src/controllers/profileController.ts`
- `services/conversation/src/services/aiClient.ts` → `analyzeProfile()`
- `services/conversation/src/services/dialogueEngine.ts` → интеграция при завершении

---

### 3. Context Manager Agent

**Назначение**: Отслеживание отклонений от темы диалога

**Когда вызывается**: Перед валидацией ответа (для всех шагов кроме `clarify` и `completion_gap`)

**Функции**:

- Определяет, остается ли пользователь в теме вопроса
- Выявляет значительные отклонения
- Извлекает важную информацию из отклонений
- Предлагает мягкий возврат к теме

**Эндпоинт**: `POST /api/ai/check-context`

**Параметры**:

```typescript
{
  conversationHistory?: Array<{ role, text }>; // История диалога
  currentStep: { id, label, instruction? };     // Текущий шаг
  userMessage: string;                          // Ответ пользователя
}
```

**Ответ**:

```typescript
{
  onTopic: boolean;           // Остается ли в теме
  deviation: string;           // Описание отклонения (если есть)
  shouldRedirect: boolean;     // Нужно ли вернуть к теме
  importantInfo: string[];     // Важная информация из ответа
}
```

**Поведение**:

- Если `shouldRedirect && !onTopic`:
  - Сохраняется важная информация (если есть)
  - Сохраняется подсказка для возврата в `contextRedirectHint`
  - Продолжается обычный flow (не блокируется)
- При построении следующего вопроса:
  - Если есть `contextRedirectHint`, добавляется в начало вопроса
  - Например: "Вернемся к вопросу. Какую должность вы ищете?"

**Примеры**:

| Вопрос                      | Ответ                        | Результат                                                   |
| --------------------------- | ---------------------------- | ----------------------------------------------------------- |
| "Какую должность вы ищете?" | "Product Manager"            | `onTopic: true` → продолжение                               |
| "Какую должность вы ищете?" | "А сколько платят?"          | `shouldRedirect: true` → подсказка в следующем вопросе      |
| "Какой опыт?"               | "5 лет, кстати ищу удаленку" | `onTopic: true`, `importantInfo: ['ищет удаленную работу']` |

**Файлы**:

- `services/ai-nlp/src/controllers/contextController.ts`
- `services/conversation/src/services/aiClient.ts` → `checkContext()`
- `services/conversation/src/services/dialogueEngine.ts` → интеграция перед валидацией

---

## Порядок работы агентов

### Типичный flow обработки ответа:

```
1. Пользователь отвечает на вопрос
   ↓
2. Context Manager проверяет отклонение от темы
   ├─→ Если отклонение: сохраняет подсказку для следующего вопроса
   └─→ Продолжает flow
   ↓
3. Validator Agent валидирует качество ответа
   ├─→ Если unclear/irrelevant: переход на clarify
   └─→ Если good: продолжает
   ↓
4. Сохранение ответа в collectedData
   ↓
5. Определение следующего шага (resolveNextStep)
   ↓
6. При завершении диалога:
   └─→ Profile Analyst анализирует полноту
       ├─→ Если есть пробелы: переход на completion_gap
       └─→ Если готов: завершение
```

### Пример полного flow:

```
Вопрос: "Какую должность вы ищете?"
Ответ: "да"

1. Context Manager: onTopic=false, shouldRedirect=true
   → Сохраняет подсказку

2. Validator Agent: quality=irrelevant
   → Переход на clarify
   → Вопрос: "Не совсем понял. Можете уточнить?"

Ответ на clarify: "Product Manager"

3. Validator Agent: quality=good
   → Сохранение ответа
   → Переход к следующему шагу
```

---

## Интеграция с YandexGPT

Все агенты используют единый интерфейс `callYandexModel()` из `yandexClient.ts`.

### Настройки для разных агентов:

| Агент               | Temperature | MaxTokens | Причина                    |
| ------------------- | ----------- | --------- | -------------------------- |
| **Validator**       | 0.3         | 200       | Детерминированные оценки   |
| **Profile Analyst** | 0.2         | 500       | Структурированный анализ   |
| **Context Manager** | 0.3         | 300       | Баланс точности и гибкости |

### Обработка ошибок:

Все агенты имеют fallback логику:

- **Validator**: `{ quality: 'good' }` — не блокирует flow
- **Profile Analyst**: `{ completeness: 0.5, hasGaps: true }` — предполагает неполный профиль
- **Context Manager**: `{ onTopic: true, shouldRedirect: false }` — предполагает, что в теме

---

## Новые шаги в сценарии

### Шаг `clarify`

**Тип**: `question`

**Назначение**: Уточнение неясного или нерелевантного ответа

**Когда используется**: После валидации ответа с `quality !== 'good'`

**Особенности**:

- `next: null` — устанавливается динамически
- Возвращает на предыдущий шаг после получения хорошего ответа
- Может повторяться, если ответ все еще неясен

**Файл**: `services/conversation/src/scenario/jackScenario.ts`

### Шаг `completion_gap`

**Тип**: `question`

**Назначение**: Предложение заполнить критичные пробелы в профиле

**Когда используется**: При завершении диалога, если есть критичные пробелы

**Особенности**:

- `next: null` — устанавливается динамически
- Пользователь выбирает: "заполнить сейчас" или "продолжить как есть"
- При выборе "заполнить" → переход на первый критичный шаг

**Файл**: `services/conversation/src/scenario/jackScenario.ts`

---

## Расширение системы

### Добавление нового агента:

1. **Создать контроллер в AI/NLP Service**:

   ```typescript
   // services/ai-nlp/src/controllers/newAgentController.ts
   export async function newAgentFunction(req: Request, res: Response) {
     // Промпт для YandexGPT
     // Вызов callYandexModel()
     // Парсинг ответа
   }
   ```

2. **Добавить роут**:

   ```typescript
   // services/ai-nlp/src/index.ts
   app.post('/api/ai/new-agent', newAgentFunction);
   ```

3. **Создать клиент в Conversation Service**:

   ```typescript
   // services/conversation/src/services/aiClient.ts
   export async function newAgentClient(params) {
     // HTTP POST к эндпоинту
     // Обработка ошибок с fallback
   }
   ```

4. **Интегрировать в Dialogue Engine**:
   ```typescript
   // services/conversation/src/services/dialogueEngine.ts
   const result = await newAgentClient(...);
   // Обработка результата
   ```

---

## Тестирование

### Тест-кейсы для Validator Agent:

1. **Нерелевантный ответ** → переход на `clarify`
2. **Неясный ответ** → переход на `clarify`
3. **Пустой ответ** → переход на `clarify`
4. **Хороший ответ** → продолжение flow
5. **Возврат с clarify** → сохранение ответа и продолжение

### Тест-кейсы для Profile Analyst Agent:

1. **Полный профиль** → `readyForMatching: true`
2. **Пропущены критичные поля** → переход на `completion_gap`
3. **Пропущены некритичные поля** → `readyForMatching: true`, но `hasGaps: true`
4. **Противоречия в данных** → обнаружение в `contradictions`
5. **Заполнение пробелов** → переход на соответствующий шаг

### Тест-кейсы для Context Manager Agent:

1. **Отклонение от темы** → подсказка в следующем вопросе
2. **Остается в теме** → продолжение flow
3. **Важная информация в отклонении** → сохранение информации
4. **Полное отклонение** → мягкий возврат к теме

---

## Производительность

### Оптимизация:

1. **Кэширование**: Можно кэшировать результаты валидации для похожих ответов
2. **Batch обработка**: Объединять несколько проверок в один запрос (будущее)
3. **Легкая модель**: Использовать `yandexgpt-lite` для простых задач (будущее)

### Стоимость:

- Каждый агент делает отдельный вызов YandexGPT
- Средняя стоимость на диалог: ~3-4 вызова (Context + Validator + Profile Analyst)
- Можно оптимизировать, вызывая агентов только при необходимости

---

## Известные ограничения

1. **История диалога**: Context Manager получает минимальную историю (можно улучшить)
2. **Важная информация**: Извлечение важной информации из отклонений — базовая реализация
3. **Противоречия**: Profile Analyst обнаруживает только явные противоречия

---

## Следующие шаги

1. Добавить поддержку `info_card` и `command` типов шагов
2. Расширить ветвления (локация, формат работы)
3. Улучшить извлечение важной информации из отклонений
4. Добавить периодическую проверку полноты профиля (не только при завершении)
