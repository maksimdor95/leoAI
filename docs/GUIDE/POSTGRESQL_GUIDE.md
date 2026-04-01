# Руководство по работе с PostgreSQL

## 🗄️ Где находится база данных?

### Ответ: В Docker контейнере

**База данных НЕ находится на вашем компьютере напрямую!**

Она находится **внутри Docker контейнера** с именем `jack-postgres`.

**Аналогия:**

- Ваш компьютер = дом
- Docker контейнер = комната в доме
- PostgreSQL = база данных в этой комнате

---

## 🔍 Как посмотреть подключение к PostgreSQL?

### Способ 1: Через терминал (командная строка)

#### Проверить, что контейнер работает:

```bash
# Из корня проекта (AIheroes)
docker-compose ps
```

**Должно показать:**

```
NAME            STATUS
jack-postgres   Up (healthy)
```

#### Подключиться к базе данных:

```bash
# Из корня проекта
docker-compose exec postgres psql -U postgres -d jack_ai
```

**Что произойдет:**

- Вы войдете в интерактивную консоль PostgreSQL
- Можете выполнять SQL команды
- Для выхода: введите `\q` или `exit`

#### Полезные команды в PostgreSQL:

```sql
-- Посмотреть все таблицы
\dt

-- Посмотреть структуру таблицы users
\d jack.users

-- Посмотреть всех пользователей
SELECT * FROM jack.users;

-- Посмотреть количество пользователей
SELECT COUNT(*) FROM jack.users;

-- Выход
\q
```

---

### Способ 2: Через pgAdmin (графический интерфейс)

#### Запустить pgAdmin:

```bash
# Из корня проекта
docker-compose --profile tools up -d pgadmin
```

#### Открыть в браузере:

```
http://localhost:5050
```

#### Войти:

- **Email:** admin@jack.ai (или из .env)
- **Password:** admin (или из .env)

#### Добавить сервер:

1. Правый клик на "Servers" → "Create" → "Server"
2. **General tab:**
   - Name: `Jack AI Local`
3. **Connection tab:**
   - Host: `postgres` (имя сервиса в docker-compose)
   - Port: `5432`
   - Database: `jack_ai`
   - Username: `postgres`
   - Password: `postgres` (или из .env)

#### Теперь можно:

- Видеть все таблицы
- Просматривать данные
- Выполнять SQL запросы
- Редактировать данные (осторожно!)

---

### Способ 3: Через код (Node.js)

**Файл:** `services/user-profile/src/config/database.ts`

**Проверить подключение:**

```bash
cd services/user-profile
npm run test:db
```

**Что покажет:**

- ✅ Подключение успешно
- ❌ Ошибка подключения (с описанием)

---

## 🐳 Нужно ли заходить в Docker?

### Короткий ответ: **НЕТ, не обязательно!**

**Когда НЕ нужно:**

- ✅ Для обычной работы с базой данных
- ✅ Для разработки сервисов
- ✅ Для просмотра данных (используйте pgAdmin)

**Когда МОЖЕТ понадобиться:**

- 🔧 Если нужно посмотреть логи контейнера
- 🔧 Если нужно выполнить команды внутри контейнера
- 🔧 Если нужно настроить что-то вручную

---

## 📍 Где физически находится база данных?

### На вашем компьютере:

**Windows:**

```
C:\Users\Marina\AppData\Local\Docker\wsl\data\ext4.vhdx
```

**Или через Docker volumes:**

```bash
# Посмотреть volumes
docker volume ls

# Должно показать:
# aiheroes_postgres_data
```

**Важно:**

- Данные хранятся в Docker volume
- Это специальная папка, которую Docker создает
- Не нужно туда заходить вручную!
- Docker управляет этим автоматически

---

## 🔗 Как посмотреть данные в базе?

### Вариант 1: Через терминал (быстро)

```bash
# Из корня проекта
docker-compose exec postgres psql -U postgres -d jack_ai -c "SELECT * FROM jack.users;"
```

**Что покажет:**

- Всех пользователей в таблице
- Их email, имена, даты создания

---

### Вариант 2: Через pgAdmin (удобно)

1. Запустите pgAdmin (см. выше)
2. Откройте сервер "Jack AI Local"
3. Откройте базу данных "jack_ai"
4. Откройте схему "jack"
5. Правый клик на таблицу "users" → "View/Edit Data" → "All Rows"

---

### Вариант 3: Через код (программно)

**Пример запроса:**

```typescript
import pool from './config/database';

const result = await pool.query('SELECT * FROM jack.users');
console.log(result.rows);
```

---

## 📊 Структура базы данных

### Схема: `jack`

### Таблица: `users`

**Поля:**

- `id` - UUID (уникальный идентификатор)
- `email` - VARCHAR(255) - email пользователя
- `password_hash` - VARCHAR(255) - хеш пароля
- `first_name` - VARCHAR(100) - имя (опционально)
- `last_name` - VARCHAR(100) - фамилия (опционально)
- `created_at` - TIMESTAMP - дата создания
- `updated_at` - TIMESTAMP - дата обновления

---

## 🛠️ Полезные команды

### Проверить статус контейнеров:

```bash
docker-compose ps
```

### Посмотреть логи PostgreSQL:

```bash
docker-compose logs postgres
```

### Перезапустить PostgreSQL:

```bash
docker-compose restart postgres
```

### Остановить PostgreSQL:

```bash
docker-compose stop postgres
```

### Запустить PostgreSQL:

```bash
docker-compose start postgres
```

### Создать backup базы данных:

```bash
docker-compose exec postgres pg_dump -U postgres jack_ai > backup.sql
```

### Восстановить из backup:

```bash
docker-compose exec -T postgres psql -U postgres jack_ai < backup.sql
```

---

## ❓ Часто задаваемые вопросы

### Вопрос: "Могу ли я открыть базу данных как файл?"

**Ответ:** Нет, PostgreSQL - это не файл, а сервис, который работает в контейнере. Нужно подключаться через клиент (psql, pgAdmin, или код).

### Вопрос: "Где хранятся пароли?"

**Ответ:** В таблице `jack.users`, в поле `password_hash`. Пароли **хешированы** (нельзя прочитать оригинал).

### Вопрос: "Можно ли посмотреть пароль пользователя?"

**Ответ:** Нет! Пароли хранятся только в виде хеша. Это сделано для безопасности.

### Вопрос: "Как удалить всех пользователей?"

**Ответ:**

```sql
-- Осторожно! Удалит всех пользователей
DELETE FROM jack.users;
```

### Вопрос: "Как посмотреть только email пользователей?"

**Ответ:**

```sql
SELECT email FROM jack.users;
```

---

## 🎯 Итог

**Где база данных:**

- В Docker контейнере `jack-postgres`
- Данные хранятся в Docker volume

**Как посмотреть:**

- Через терминал: `docker-compose exec postgres psql -U postgres -d jack_ai`
- Через pgAdmin: `http://localhost:5050`
- Через код: используйте `pool.query()`

**Нужно ли заходить в Docker:**

- НЕТ, для обычной работы не нужно
- Используйте pgAdmin или терминал
