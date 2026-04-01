#!/bin/bash

# Yandex Cloud Deployment Script for Jack AI
# Используйте этот скрипт для развертывания всех компонентов в Yandex Cloud

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Функция для логирования
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARN] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Проверка наличия yc CLI
check_yc_cli() {
    if ! command -v yc &> /dev/null; then
        error "Yandex Cloud CLI (yc) не установлен!"
        echo "Установите YC CLI: https://cloud.yandex.ru/docs/cli/quickstart"
        exit 1
    fi

    if ! yc config profile get default &> /dev/null; then
        error "YC CLI не настроен! Выполните: yc init"
        exit 1
    fi

    log "YC CLI готов к работе"
}

# Получение текущего folder-id
get_folder_id() {
    FOLDER_ID=$(yc config get folder-id)
    if [ -z "$FOLDER_ID" ]; then
        error "Не удалось получить folder-id"
        exit 1
    fi
    log "Текущий folder-id: $FOLDER_ID"
}

# Создание сервисного аккаунта
create_service_account() {
    local sa_name="jack-ai-service"

    # Проверяем, существует ли уже сервисный аккаунт
    if yc iam service-account get "$sa_name" &> /dev/null; then
        warn "Сервисный аккаунт $sa_name уже существует"
        SERVICE_ACCOUNT_ID=$(yc iam service-account get "$sa_name" --format json | jq -r '.id')
    else
        log "Создание сервисного аккаунта $sa_name..."
        SERVICE_ACCOUNT_ID=$(yc iam service-account create "$sa_name" \
            --description "Service account for Jack AI" \
            --format json | jq -r '.id')
        log "Сервисный аккаунт создан: $SERVICE_ACCOUNT_ID"
    fi

    # Назначаем роли
    log "Назначение ролей сервисному аккаунту..."
    yc resource-manager folder add-access-binding "$FOLDER_ID" \
        --role serverless.containers.invoker \
        --subject serviceAccount:"$SERVICE_ACCOUNT_ID"

    yc resource-manager folder add-access-binding "$FOLDER_ID" \
        --role ai.languageModels.user \
        --subject serviceAccount:"$SERVICE_ACCOUNT_ID"

    yc resource-manager folder add-access-binding "$FOLDER_ID" \
        --role container-registry.images.puller \
        --subject serviceAccount:"$SERVICE_ACCOUNT_ID"
}

# Создание статического ключа доступа
create_static_key() {
    local key_name="jack-ai-key"

    # Проверяем, существует ли уже ключ
    if yc iam access-key list --service-account-name "jack-ai-service" | grep -q "$key_name"; then
        warn "Статический ключ $key_name уже существует"
    else
        log "Создание статического ключа доступа..."
        yc iam access-key create \
            --service-account-name "jack-ai-service" \
            --name "$key_name" \
            --description "Static access key for Jack AI"

        info "Ключ создан! Сохраните access-key-id и secret из вывода выше"
        info "Добавьте их в GitHub Secrets как YC_ACCESS_KEY_ID и YC_SECRET_ACCESS_KEY"
    fi
}

# Создание Container Registry
create_registry() {
    local registry_name="jack-ai-registry"

    # Проверяем, существует ли уже registry
    if yc container registry get "$registry_name" &> /dev/null; then
        warn "Container Registry $registry_name уже существует"
        REGISTRY_ID=$(yc container registry get "$registry_name" --format json | jq -r '.id')
    else
        log "Создание Container Registry..."
        REGISTRY_ID=$(yc container registry create "$registry_name" --format json | jq -r '.id')
        log "Registry создан: $REGISTRY_ID"
    fi
}

# Создание Managed PostgreSQL
create_postgresql() {
    local cluster_name="jack-ai-postgres"

    # Проверяем, существует ли уже кластер
    if yc managed-postgresql cluster get "$cluster_name" &> /dev/null; then
        warn "PostgreSQL кластер $cluster_name уже существует"
        DB_HOST=$(yc managed-postgresql cluster get "$cluster_name" --format json | jq -r '.config.host')
    else
        log "Создание Managed PostgreSQL кластера..."
        yc managed-postgresql cluster create "$cluster_name" \
            --network-name default \
            --environment production \
            --resource-preset s2.micro \
            --disk-type network-ssd \
            --disk-size 10 \
            --database-name jack_ai \
            --user-name jack_user \
            --password "CHANGE_THIS_PASSWORD" \
            --enable-public-ip

        # Ждем создания кластера
        log "Ожидание создания кластера..."
        yc managed-postgresql cluster wait "$cluster_name" --timeout 600

        DB_HOST=$(yc managed-postgresql cluster get "$cluster_name" --format json | jq -r '.config.host')
        log "PostgreSQL кластер создан. Host: $DB_HOST"
    fi
}

# Создание Managed Redis
create_redis() {
    local cluster_name="jack-ai-redis"

    # Проверяем, существует ли уже кластер
    if yc managed-redis cluster get "$cluster_name" &> /dev/null; then
        warn "Redis кластер $cluster_name уже существует"
        REDIS_HOST=$(yc managed-redis cluster get "$cluster_name" --format json | jq -r '.config.host')
    else
        log "Создание Managed Redis кластера..."
        yc managed-redis cluster create "$cluster_name" \
            --network-name default \
            --environment production \
            --resource-preset s2.micro \
            --disk-type network-ssd \
            --disk-size 10 \
            --password "CHANGE_THIS_PASSWORD" \
            --enable-public-ip

        # Ждем создания кластера
        log "Ожидание создания кластера..."
        yc managed-redis cluster wait "$cluster_name" --timeout 600

        REDIS_HOST=$(yc managed-redis cluster get "$cluster_name" --format json | jq -r '.config.host')
        log "Redis кластер создан. Host: $REDIS_HOST"
    fi
}

# Создание Serverless Container
create_container() {
    local container_name="$1"
    local memory="$2"
    local cores="$3"
    local timeout="$4"
    local description="$5"

    # Проверяем, существует ли уже контейнер
    if yc serverless container get "$container_name" &> /dev/null; then
        warn "Container $container_name уже существует"
        return
    fi

    log "Создание Serverless Container: $container_name..."

    # Определяем image-url в зависимости от сервиса
    local image_url
    case "$container_name" in
        "jack-user-profile")
            image_url="cr.yandex/$REGISTRY_ID/jack-ai/user-profile:latest"
            ;;
        "jack-conversation")
            image_url="cr.yandex/$REGISTRY_ID/jack-ai/conversation:latest"
            ;;
        "jack-ai-nlp")
            image_url="cr.yandex/$REGISTRY_ID/jack-ai/ai-nlp:latest"
            ;;
        "jack-job-matching")
            image_url="cr.yandex/$REGISTRY_ID/jack-ai/job-matching:latest"
            ;;
        "jack-email")
            image_url="cr.yandex/$REGISTRY_ID/jack-ai/email:latest"
            ;;
        "jack-gateway")
            image_url="cr.yandex/$REGISTRY_ID/jack-ai/gateway:latest"
            ;;
        *)
            error "Неизвестный контейнер: $container_name"
            return
            ;;
    esac

    yc serverless container create "$container_name" \
        --description "$description" \
        --memory "$memory" \
        --cores "$cores" \
        --execution-timeout "$timeout" \
        --concurrency 4 \
        --service-account-id "$SERVICE_ACCOUNT_ID" \
        --image "$image_url"

    log "Container $container_name создан"
}

# Создание всех контейнеров
create_all_containers() {
    log "Создание Serverless Containers..."

    create_container "jack-user-profile" "512MB" "1" "30s" "User Profile Service"
    create_container "jack-conversation" "1024MB" "1" "300s" "Conversation Service with WebSocket"
    create_container "jack-ai-nlp" "1024MB" "1" "120s" "AI/NLP Service"
    create_container "jack-job-matching" "1024MB" "2" "300s" "Job Matching Service"
    create_container "jack-email" "512MB" "1" "60s" "Email Service"
    create_container "jack-gateway" "512MB" "1" "30s" "API Gateway"
}

# Основная функция
main() {
    log "🚀 Начинаем развертывание Jack AI в Yandex Cloud"

    check_yc_cli
    get_folder_id
    create_service_account
    create_static_key
    create_registry
    create_postgresql
    create_redis
    create_all_containers

    log "✅ Развертывание инфраструктуры завершено!"
    info ""
    info "Следующие шаги:"
    info "1. Добавьте YC_ACCESS_KEY_ID и YC_SECRET_ACCESS_KEY в GitHub Secrets"
    info "2. Обновите переменные окружения в .env файле"
    info "3. Запустите GitHub Actions для сборки и деплоя образов"
    info ""
    info "URLs сервисов:"
    info "- Gateway: https://jack-gateway.$FOLDER_ID.serverless.yandexcloud.net"
    info "- User Profile: https://jack-user-profile.$FOLDER_ID.serverless.yandexcloud.net"
    info "- Conversation: https://jack-conversation.$FOLDER_ID.serverless.yandexcloud.net"
    info "- И т.д."
}

# Запуск скрипта
main "$@"



