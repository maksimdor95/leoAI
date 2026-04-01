#!/bin/bash

# Скрипт для проверки необходимых секретов для деплоя в Yandex Cloud

echo "🔍 Проверка необходимых секретов для деплоя в Yandex Cloud..."
echo ""

# Список обязательных секретов
REQUIRED_SECRETS=(
  "YC_ACCESS_KEY_ID"
  "YC_SECRET_ACCESS_KEY"
  "YC_REGISTRY_ID"
  "YC_SERVICE_ACCOUNT_ID"
  "JWT_SECRET"
  "YC_API_KEY"
  "DB_HOST"
  "DB_PASSWORD"
  "REDIS_HOST"
  "SENDGRID_API_KEY"
  "SENDGRID_FROM_EMAIL"
)

echo "📋 Обязательные GitHub Secrets:"
echo "-------------------------------"

for secret in "${REQUIRED_SECRETS[@]}"; do
  echo "  - $secret"
done

echo ""
echo "📝 Инструкция по добавлению:"
echo "1. Откройте: https://github.com/YOUR_USERNAME/YOUR_REPO/settings/secrets/actions"
echo "2. Нажмите 'New repository secret'"
echo "3. Добавьте каждый секрет из списка выше"
echo ""
echo "✅ Подставьте свои значения (не коммитьте реальные ключи в репозиторий):"
echo "   YC_FOLDER_ID=<your-folder-id>"
echo "   YC_REGISTRY_ID=<your-registry-id>"
echo "   YC_SERVICE_ACCOUNT_ID=<your-sa-id>"
echo "   YC_ACCESS_KEY_ID=<your-access-key-id>"
echo "   YC_SECRET_ACCESS_KEY=<your-secret-access-key>"
echo ""
echo "⚠️  ВАЖНО: YC_SECRET_ACCESS_KEY показывается только один раз!"
echo "   Если вы его не сохранили, создайте новый ключ:"
echo "   yc iam access-key create --service-account-name jack-ai-service"



