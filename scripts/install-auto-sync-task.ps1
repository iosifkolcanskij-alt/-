# Создаёт задачу Windows: синхронизация с GitHub каждые 5 минут
# Запуск от администратора: powershell -ExecutionPolicy Bypass -File scripts\install-auto-sync-task.ps1

$TaskName = "Samopoznanie-GitHub-Sync"
$Root = Split-Path -Parent $PSScriptRoot
$Script = Join-Path $Root "scripts\sync-to-github.ps1"

$Action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$Script`""

$Trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration ([TimeSpan]::MaxValue)

$Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -StartWhenAvailable -MultipleInstances IgnoreNew

Register-ScheduledTask -TaskName $TaskName -Action $Action -Trigger $Trigger `
    -Settings $Settings -Description "Синхронизация проекта Самопознание с GitHub" -Force

Write-Host "Задача '$TaskName' создана: каждые 5 минут запускается sync-to-github.ps1"
Write-Host "Удалить: Unregister-ScheduledTask -TaskName '$TaskName' -Confirm:`$false"
