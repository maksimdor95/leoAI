# Документация LEO AI

## Навигация

| Документ | Описание |
|----------|----------|
| [PRODUCT_VISION.md](./PRODUCT_VISION.md) | Видение продукта, стратегия, AI-агенты, модель данных, бизнес-план |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Техническая архитектура: сервисы, стек, диаграммы, потоки данных |
| [USER_JOURNEYS.md](./USER_JOURNEYS.md) | Клиентские пути пользователя (BPMN), сценарии использования |
| [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md) | План разработки: что реализовано, что в работе, что дальше |
| [IMPROVEMENT_PLAN.md](./IMPROVEMENT_PLAN.md) | План улучшений по результатам анализа UX и кода (Jack, матчинг, окружение) |
| [MVP/MVP0_DAILY_EXECUTION_CHECKLIST.md](./MVP/MVP0_DAILY_EXECUTION_CHECKLIST.md) | Ежедневный рабочий чеклист MVP0 (главный операционный трекер) |
| [MVP/MVP1_DAILY_EXECUTION_CHECKLIST.md](./MVP/MVP1_DAILY_EXECUTION_CHECKLIST.md) | Ежедневный чеклист MVP1 (вынесен отдельно для снижения шума) |
| [SETUP.md](./SETUP.md) | Локальная установка и запуск для разработки |
| [CONFIGURATION.md](./CONFIGURATION.md) | Справочник всех переменных окружения |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Развёртывание в production (Yandex Cloud, PM2, Docker) |
| [WANNANEW.md](./WANNANEW.md) | Спецификация продукта wannanew (PM-интервью, PDF-отчёты) |

### Гайды

| Документ | Описание |
|----------|----------|
| [guides/DIALOGUE_ENGINE.md](./guides/DIALOGUE_ENGINE.md) | Мультиагентная система: Validator, Profile Analyst, Context Manager |
| [guides/DATABASE.md](./guides/DATABASE.md) | Работа с PostgreSQL и Redis |
| [guides/CODE_STYLE.md](./guides/CODE_STYLE.md) | Стиль кода, линтеры, форматирование |

## Быстрый старт

```bash
# Убедитесь, что в корне проекта есть .env
docker compose up -d
npm install
npm run dev:up
npm run dev:status
```

Подробная инструкция: [SETUP.md](./SETUP.md)
