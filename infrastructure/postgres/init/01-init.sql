-- Инициализация базы данных для Jack AI Service
-- Этот скрипт выполняется автоматически при первом запуске PostgreSQL

-- Создание расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- Для полнотекстового поиска

-- Создание схемы для приложения
CREATE SCHEMA IF NOT EXISTS jack;

-- Комментарий
COMMENT ON SCHEMA jack IS 'Основная схема для Jack AI Service';

