# User Profile Service

Сервис для управления профилями пользователей.

## Функции

- ✅ Регистрация пользователей
- ✅ Авторизация (JWT)
- ✅ Управление профилями
- ✅ Хранение в PostgreSQL

## Технологии

- **Node.js** (TypeScript)
- **Express** - веб-фреймворк
- **PostgreSQL** - база данных
- **JWT** - авторизация
- **bcryptjs** - хеширование паролей

## Установка

```bash
# Установить зависимости
npm install

# Создать .env файл
cp .env.example .env

# Заполнить .env файл (особенно DB_PASSWORD и JWT_SECRET)
```

## Запуск

```bash
# Режим разработки
npm run dev

# Сборка
npm run build

# Production
npm start
```

## API Endpoints

### Health Check

```
GET /health
```

### Регистрация (будет добавлено)

```
POST /api/users/register
```

### Авторизация (будет добавлено)

```
POST /api/users/login
```

### Получить профиль (будет добавлено)

```
GET /api/users/:userId
```

### Обновить профиль (будет добавлено)

```
PUT /api/users/:userId
```

## Тестирование

```bash
# Запустить тесты
npm test

# Запустить тесты в watch режиме
npm run test:watch
```

## Структура проекта

```
services/user-profile/
├── src/
│   ├── controllers/    # Обработчики запросов
│   ├── models/         # Модели данных
│   ├── routes/         # Маршруты API
│   ├── middleware/     # Промежуточное ПО
│   ├── services/       # Бизнес-логика
│   ├── utils/          # Вспомогательные функции
│   ├── config/         # Конфигурация
│   └── index.ts        # Точка входа
├── tests/              # Тесты
├── package.json        # Зависимости
├── tsconfig.json       # Конфигурация TypeScript
└── Dockerfile          # Docker конфигурация
```
