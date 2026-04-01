# Dockerfile для Referral/Intro Service
# Этот файл будет дополнен позже, когда будет создан сам сервис

FROM node:18-alpine AS base

WORKDIR /app

# Установка зависимостей
COPY package*.json ./
RUN npm ci --only=production

# Копирование кода (будет добавлено позже)
# COPY . .

# Экспорт порта
EXPOSE 3007

# Запуск приложения (будет добавлено позже)
# CMD ["npm", "start"]

