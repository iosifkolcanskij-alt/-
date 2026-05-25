# Автоматическая отправка изменений в GitHub
# Запуск: powershell -ExecutionPolicy Bypass -File scripts\sync-to-github.ps1
# Фоновый режим (наблюдение за папкой): ... -Watch

param(
    [switch]$Watch,
    [int]$IntervalSeconds = 120
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$RemoteUrl = "https://github.com/iosifkolcanskij-alt/-.git"

function Ensure-GitRepo {
    if (-not (Test-Path ".git")) {
        git init
        git branch -M main
        git remote add origin $RemoteUrl 2>$null
        if ($LASTEXITCODE -ne 0) {
            git remote set-url origin $RemoteUrl
        }
    }
    $remotes = git remote 2>$null
    if ($remotes -notcontains "origin") {
        git remote add origin $RemoteUrl
    } else {
        git remote set-url origin $RemoteUrl
    }
}

function Sync-Once {
    Ensure-GitRepo
    git add -A
    $status = git status --porcelain
    if (-not $status) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Нет изменений."
        return
    }
    $msg = "sync: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    git -c user.name="iosifkolcanskij-alt" -c user.email="iosifkolcanskij-alt@users.noreply.github.com" commit -m $msg
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Коммит не создан (возможно, нет изменений для коммита)."
        return
    }
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Отправка на GitHub..."
    git push -u origin main 2>$null
    if ($LASTEXITCODE -ne 0) {
        git push origin main
    }
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Готово."
    } else {
        Write-Error "Push не удался. Проверьте вход в GitHub (Personal Access Token или Git Credential Manager)."
    }
}

Ensure-GitRepo

if ($Watch) {
    Write-Host "Наблюдение за папкой: $Root (интервал ${IntervalSeconds}с). Ctrl+C — остановка."
    while ($true) {
        Sync-Once
        Start-Sleep -Seconds $IntervalSeconds
    }
} else {
    Sync-Once
}
