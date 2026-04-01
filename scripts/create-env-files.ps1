# PowerShell скрипт для создания .env файлов для всех сервисов

$jwtSecret = Read-Host "Введите JWT_SECRET (или нажмите Enter для значения по умолчанию)"
if ([string]::IsNullOrWhiteSpace($jwtSecret)) {
    $jwtSecret = "jack-ai-secret-key-change-in-production-2024"
    Write-Host "Используется JWT_SECRET по умолчанию: $jwtSecret" -ForegroundColor Yellow
}

$ycFolderId = Read-Host "Введите YC_FOLDER_ID (Yandex Cloud, обязательно для AI Service)"
$ycApiKey = Read-Host "Введите YC_API_KEY (Yandex Cloud, обязательно для AI Service)"
$sendgridApiKey = Read-Host "Введите SENDGRID_API_KEY (или нажмите Enter чтобы пропустить)"

Write-Host "`nСоздание .env файлов..." -ForegroundColor Green

# User Profile Service
$userProfileEnv = @"
# Port
PORT=3001

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jack_ai
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false

# CORS
CORS_ORIGIN=http://localhost:3000

# JWT
JWT_SECRET=$jwtSecret
JWT_EXPIRES_IN=7d

# Environment
NODE_ENV=development
"@

Set-Content -Path "services/user-profile/.env" -Value $userProfileEnv
Write-Host "✅ Создан services/user-profile/.env" -ForegroundColor Green

# Conversation Service
$conversationEnv = @"
# Port
PORT=3002

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# CORS
CORS_ORIGIN=http://localhost:3000

# JWT
JWT_SECRET=$jwtSecret

# Service URLs
USER_PROFILE_SERVICE_URL=http://localhost:3001
AI_SERVICE_URL=http://localhost:3003
JOB_MATCHING_SERVICE_URL=http://localhost:3004
EMAIL_SERVICE_URL=http://localhost:3005

# Environment
NODE_ENV=development
"@

Set-Content -Path "services/conversation/.env" -Value $conversationEnv
Write-Host "✅ Создан services/conversation/.env" -ForegroundColor Green

# AI/NLP Service
if ([string]::IsNullOrWhiteSpace($ycFolderId) -or [string]::IsNullOrWhiteSpace($ycApiKey)) {
    Write-Host "⚠️  YC_FOLDER_ID или YC_API_KEY не указаны. AI Service может не работать!" -ForegroundColor Yellow
}

$aiNlpEnv = @"
# Port
PORT=3003

# CORS
CORS_ORIGIN=http://localhost:3000

# JWT
JWT_SECRET=$jwtSecret

# Yandex GPT
YC_FOLDER_ID=$ycFolderId
YC_API_KEY=$ycApiKey
YC_MODEL_ID=foundation-models/yandexgpt-lite
YC_TEMPERATURE=0.6
YC_MAX_TOKENS=800
YC_TOP_P=0.9

# Environment
NODE_ENV=development
"@

Set-Content -Path "services/ai-nlp/.env" -Value $aiNlpEnv
Write-Host "✅ Создан services/ai-nlp/.env" -ForegroundColor Green

# Job Matching Service
$jobMatchingEnv = @"
# Port
PORT=3004

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=jack_ai
DB_USER=postgres
DB_PASSWORD=postgres
DB_SSL=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# CORS
CORS_ORIGIN=http://localhost:3000

# JWT
JWT_SECRET=$jwtSecret

# Services
USER_PROFILE_SERVICE_URL=http://localhost:3001

# HeadHunter API (опционально)
HH_API_URL=https://api.hh.ru
HH_API_KEY=

# Scraper
SCRAPER_USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36

# Environment
NODE_ENV=development
"@

Set-Content -Path "services/job-matching/.env" -Value $jobMatchingEnv
Write-Host "✅ Создан services/job-matching/.env" -ForegroundColor Green

# Email Notification Service
$emailEnv = @"
# Port
PORT=3005

# CORS
CORS_ORIGIN=http://localhost:3000

# JWT
JWT_SECRET=$jwtSecret

# SendGrid
SENDGRID_API_KEY=$sendgridApiKey
FROM_EMAIL=noreply@jack.ai
FROM_NAME=Jack AI

# Services
USER_PROFILE_SERVICE_URL=http://localhost:3001
JOB_MATCHING_SERVICE_URL=http://localhost:3004

# Base URL
BASE_URL=http://localhost:3000

# Environment
NODE_ENV=development
"@

Set-Content -Path "services/email/.env" -Value $emailEnv
Write-Host "✅ Создан services/email/.env" -ForegroundColor Green

Write-Host "`n✅ Все .env файлы созданы!" -ForegroundColor Green
Write-Host "`nСледующие шаги:" -ForegroundColor Cyan
Write-Host "1. Проверьте файлы и при необходимости отредактируйте значения"
Write-Host "2. Запустите Docker: docker-compose up -d"
Write-Host "3. Запустите все сервисы (см. docs/SETUP_ENV.md)"

