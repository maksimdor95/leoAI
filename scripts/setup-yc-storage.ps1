# Setup Yandex Object Storage для Report Service (wannanew PDF).
# Запуск: в корне репо выполнить .\scripts\setup-yc-storage.ps1
# Требуется: yc CLI установлен и выполнен yc init (config list показывает folder-id).

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

Write-Host "`n=== YC Object Storage — настройка ===`n" -ForegroundColor Cyan

# 1. Проверка YC CLI
$yc = Get-Command yc -ErrorAction SilentlyContinue
if (-not $yc) {
    Write-Host "YC CLI не найден. Установите: https://cloud.yandex.ru/docs/cli/quickstart" -ForegroundColor Red
    exit 1
}

$folderId = (yc config get folder-id 2>$null).ToString().Trim()
if (-not $folderId) {
    Write-Host "YC не настроен. Выполните: yc init" -ForegroundColor Red
    exit 1
}
Write-Host "Folder ID: $folderId" -ForegroundColor Gray

# 2. Сервисный аккаунт
$saName = "aiheroes-storage"
$exists = yc iam service-account list --format json 2>$null | ConvertFrom-Json | Where-Object { $_.name -eq $saName }
if (-not $exists) {
    Write-Host "Создаём сервисный аккаунт: $saName ..." -ForegroundColor Yellow
    yc iam service-account create --name $saName
} else {
    Write-Host "Сервисный аккаунт $saName уже существует." -ForegroundColor Green
}

$saJson = yc iam service-account get $saName --format json 2>$null | ConvertFrom-Json
$saId = $saJson.id
Write-Host "Service Account ID: $saId" -ForegroundColor Gray

# 3. Роль storage.editor
Write-Host "Назначаем роль storage.editor ..." -ForegroundColor Yellow
$bindingOut = yc resource-manager folder add-access-binding $folderId `
    --role storage.editor `
    --subject "serviceAccount:$saId" 2>&1
if ($LASTEXITCODE -ne 0 -and "$bindingOut" -notmatch "already exists|AlreadyExists") {
    Write-Host "Предупреждение: $bindingOut" -ForegroundColor Yellow
} else {
    Write-Host "Роль назначена." -ForegroundColor Green
}

# 4. Статические ключи доступа
Write-Host "Создаём статический ключ доступа ..." -ForegroundColor Yellow
$keyRaw = yc iam access-key create --service-account-name "aiheroes-storage" 2>&1 | Out-String
if ($keyRaw -match 'key_id:\s*["'']?(\S+)["'']?') { $accessKey = $Matches[1].Trim().Trim('"').Trim("'") } else { $accessKey = $null }
if ($keyRaw -match 'secret:\s*["'']?(\S+)["'']?') { $secretKey = $Matches[1].Trim().Trim('"').Trim("'") } else { $secretKey = $null }
if (-not $accessKey -or -not $secretKey) {
    Write-Host "Ошибка парсинга ключа. Вывод yc:" -ForegroundColor Red
    Write-Host $keyRaw -ForegroundColor Red
    exit 1
}
Write-Host "Access Key ID: $accessKey" -ForegroundColor Gray
Write-Host "Secret сохранён (не показываем)." -ForegroundColor Gray

# 5. Бакет (имя глобально уникально)
$bucketName = "aiheroes-reports-$($folderId -replace '^b1g','')"
$bucketErr = yc storage bucket create --name $bucketName 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Бакет создан: $bucketName" -ForegroundColor Green
} elseif ("$bucketErr" -match "already exists|AlreadyExists|Conflict") {
    Write-Host "Бакет $bucketName уже существует." -ForegroundColor Green
} else {
    Write-Host "Ошибка создания бакета: $bucketErr" -ForegroundColor Red
    Write-Host "Попробуйте: yc storage bucket create --name aiheroes-reports-UNIQUE" -ForegroundColor Yellow
    exit 1
}

# 6. .env для Report Service
$reportEnvPath = Join-Path $repoRoot "services\report\.env"
$jwtSecret = "jack-ai-secret-key-change-in-production-2024"
$convEnv = Join-Path $repoRoot "services\conversation\.env"
if (Test-Path $convEnv) {
    $conv = Get-Content $convEnv -Raw
    if ($conv -match "JWT_SECRET=(\S+)") { $jwtSecret = $Matches[1].Trim() }
}

$envContent = @"
# Report Service — PDF для wannanew
PORT=3007
NODE_ENV=development

REDIS_URL=redis://localhost:6379
JWT_SECRET=$jwtSecret
CONVERSATION_SERVICE_URL=http://localhost:3002

# Yandex Object Storage (из setup-yc-storage.ps1)
YC_STORAGE_ENDPOINT=https://storage.yandexcloud.net
YC_STORAGE_REGION=ru-central1
YC_STORAGE_BUCKET=$bucketName
YC_STORAGE_ACCESS_KEY=$accessKey
YC_STORAGE_SECRET_KEY=$secretKey
"@

$dir = Split-Path $reportEnvPath -Parent
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
Set-Content -Path $reportEnvPath -Value $envContent -Encoding UTF8
Write-Host "`nЗаписано: services\report\.env" -ForegroundColor Green
Write-Host "YC_STORAGE_BUCKET=$bucketName" -ForegroundColor Gray
Write-Host "YC_STORAGE_ACCESS_KEY=$accessKey" -ForegroundColor Gray

Write-Host "`n=== Done ===`n" -ForegroundColor Cyan
