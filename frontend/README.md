# Frontend - Jack AI Service

Веб-интерфейс для Jack AI Service.

## Технологии

- **Next.js 14** - React фреймворк
- **TypeScript** - типизация
- **Ant Design** - UI компоненты
- **Tailwind CSS** - стилизация
- **Axios** - HTTP клиент

## Установка

```bash
# Установить зависимости
npm install
```

## Запуск

```bash
# Режим разработки
npm run dev

# Production сборка
npm run build
npm start
```

## Структура проекта

```
frontend/
├── app/                    # Next.js App Router
│   ├── page.tsx           # Главная страница
│   ├── register/          # Страница регистрации
│   ├── login/             # Страница авторизации
│   └── profile/           # Страница профиля
├── components/             # React компоненты
├── lib/                    # Утилиты и API клиент
│   ├── api.ts             # API клиент
│   └── auth.ts            # Функции авторизации
└── public/                 # Статические файлы
```

## API Endpoints

Все запросы идут к User Profile Service на `http://localhost:3001`

- `POST /api/users/register` - регистрация
- `POST /api/users/login` - авторизация
- `GET /api/users/profile` - получить профиль
- `PUT /api/users/profile` - обновить профиль

## Переменные окружения

Создайте файл `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```
