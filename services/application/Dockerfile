# Dockerfile для Application Helper Service
# Этот файл будет дополнен позже, когда будет создан сам сервис

FROM python:3.11-slim AS base

WORKDIR /app

# Установка системных зависимостей
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Установка Python зависимостей
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копирование кода (будет добавлено позже)
# COPY . .

# Экспорт порта
EXPOSE 3006

# Запуск приложения (будет добавлено позже)
# CMD ["python", "main.py"]

