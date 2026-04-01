# Yandex Cloud setup для каталога mark2 (ai-nlp + Object Storage).
# Запуск: в корне репо — .\scripts\setup-yc-mark2.ps1
# Нужен: yc CLI, yc init, каталог mark2.

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

$FOLDER_ID = "b1g89e6kosmj3fq8b1me"   # mark2

Write-Host "`n=== YC mark2: ai-nlp SA + Object Storage ===`n" -ForegroundColor Cyan
Write-Host "Folder: $FOLDER_ID" -ForegroundColor Gray

$yc = Get-Command yc -ErrorAction SilentlyContinue
if (-not $yc) { Write-Host "YC CLI not found." -ForegroundColor Red; exit 1 }

$prevFolder = (yc config get folder-id 2>$null).ToString().Trim()
yc config set folder-id $FOLDER_ID 2>&1 | Out-Null
trap { if ($prevFolder) { yc config set folder-id $prevFolder 2>&1 | Out-Null } }

# ---------- 1. AI-NLP SA ----------
$nlpSa = "ai-nlp-sa"
$nlpExists = yc iam service-account list --folder-id $FOLDER_ID --format json 2>$null | ConvertFrom-Json | Where-Object { $_.name -eq $nlpSa }
if (-not $nlpExists) {
    Write-Host "Create SA: $nlpSa ..." -ForegroundColor Yellow
    yc iam service-account create --name $nlpSa --folder-id $FOLDER_ID 2>&1 | Out-Null
} else { Write-Host "SA $nlpSa exists." -ForegroundColor Green }

$nlpSaId = (yc iam service-account get $nlpSa --folder-id $FOLDER_ID --format json 2>$null | ConvertFrom-Json).id
$bind = yc resource-manager folder add-access-binding $FOLDER_ID --role ai.languageModels.user --subject "serviceAccount:$nlpSaId" 2>&1
if ($LASTEXITCODE -ne 0 -and "$bind" -notmatch "already exists|AlreadyExists") { Write-Host "Bind warn: $bind" -ForegroundColor Yellow }
else { Write-Host "Role ai.languageModels.user assigned." -ForegroundColor Green }

Write-Host "Create API key for $nlpSa ..." -ForegroundColor Yellow
$apiKeyOut = yc iam api-key create --service-account-name $nlpSa 2>&1 | Out-String
$apiKey = $null
if ($apiKeyOut -match 'secret:\s*["'']?([A-Za-z0-9_-]+)["'']?') { $apiKey = $Matches[1].Trim().Trim('"').Trim("'") }
if (-not $apiKey -and $apiKeyOut -match '(AQVN[A-Za-z0-9_-]+)') { $apiKey = $Matches[1] }
if (-not $apiKey) {
    Write-Host "Could not parse API key. Output:" -ForegroundColor Red
    Write-Host $apiKeyOut
    exit 1
}
Write-Host "API key obtained." -ForegroundColor Green

# Update ai-nlp .env
$aiNlpEnv = Join-Path $repoRoot "services\ai-nlp\.env"
$content = Get-Content $aiNlpEnv -Raw
$content = $content -replace 'YC_API_KEY=.*', "YC_API_KEY=$apiKey"
Set-Content -Path $aiNlpEnv -Value $content.TrimEnd() -Encoding UTF8
Write-Host "Updated services\ai-nlp\.env (YC_API_KEY)" -ForegroundColor Green

# ---------- 2. Object Storage SA ----------
$storSa = "aiheroes-storage"
$storExists = yc iam service-account list --folder-id $FOLDER_ID --format json 2>$null | ConvertFrom-Json | Where-Object { $_.name -eq $storSa }
if (-not $storExists) {
    Write-Host "Create SA: $storSa ..." -ForegroundColor Yellow
    yc iam service-account create --name $storSa --folder-id $FOLDER_ID 2>&1 | Out-Null
} else { Write-Host "SA $storSa exists." -ForegroundColor Green }

$storSaId = (yc iam service-account get $storSa --folder-id $FOLDER_ID --format json 2>$null | ConvertFrom-Json).id
$bind2 = yc resource-manager folder add-access-binding $FOLDER_ID --role storage.editor --subject "serviceAccount:$storSaId" 2>&1
if ($LASTEXITCODE -ne 0 -and "$bind2" -notmatch "already exists|AlreadyExists") { Write-Host "Bind warn: $bind2" -ForegroundColor Yellow }
else { Write-Host "Role storage.editor assigned." -ForegroundColor Green }

Write-Host "Create access key for $storSa ..." -ForegroundColor Yellow
$keyOut = yc iam access-key create --service-account-name $storSa 2>&1 | Out-String
$accessKey = $null; $secretKey = $null
if ($keyOut -match 'key_id:\s*["'']?(\S+)["'']?') { $accessKey = $Matches[1].Trim().Trim('"').Trim("'") }
if ($keyOut -match 'secret:\s*["'']?(\S+)["'']?') { $secretKey = $Matches[1].Trim().Trim('"').Trim("'") }
if (-not $accessKey -or -not $secretKey) {
    Write-Host "Could not parse access key. Output:" -ForegroundColor Red
    Write-Host $keyOut
    exit 1
}
Write-Host "Access key obtained." -ForegroundColor Green

$bucketName = "aiheroes-reports-" + ($FOLDER_ID -replace '^b1g','')
$bucketErr = yc storage bucket create --name $bucketName 2>&1
if ($LASTEXITCODE -eq 0) { Write-Host "Bucket created: $bucketName" -ForegroundColor Green }
elseif ("$bucketErr" -match "already exists|AlreadyExists|Conflict") { Write-Host "Bucket $bucketName exists." -ForegroundColor Green }
else { Write-Host "Bucket error: $bucketErr" -ForegroundColor Red; exit 1 }

# ---------- 3. Report .env ----------
$jwt = "iTuJVT68iEd6cZM7nhACxqHUk5AokJNED"
$convEnv = Join-Path $repoRoot "services\conversation\.env"
if (Test-Path $convEnv) {
    $c = Get-Content $convEnv -Raw
    if ($c -match 'JWT_SECRET=(\S+)') { $jwt = $Matches[1].Trim() }
}
$reportEnv = Join-Path $repoRoot "services\report\.env"
$reportDir = Split-Path $reportEnv -Parent
if (-not (Test-Path $reportDir)) { New-Item -ItemType Directory -Path $reportDir -Force | Out-Null }

$reportContent = @"
# Report Service — wannanew PDF
PORT=3007
NODE_ENV=development

REDIS_URL=redis://localhost:6379
JWT_SECRET=$jwt
CONVERSATION_SERVICE_URL=http://localhost:3002

# Yandex Object Storage
YC_STORAGE_ENDPOINT=https://storage.yandexcloud.net
YC_STORAGE_REGION=ru-central1
YC_STORAGE_BUCKET=$bucketName
YC_STORAGE_ACCESS_KEY=$accessKey
YC_STORAGE_SECRET_KEY=$secretKey
"@
Set-Content -Path $reportEnv -Value $reportContent -Encoding UTF8
Write-Host "Written services\report\.env" -ForegroundColor Green

if ($prevFolder) { yc config set folder-id $prevFolder 2>&1 | Out-Null }
Write-Host "`n=== Done ===`n" -ForegroundColor Cyan
