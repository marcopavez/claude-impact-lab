# Sincroniza la memoria persistente actual de Claude Code hacia docs/MEMORY/ del repo.
# Uso: .\scripts\sync-memory-to-repo.ps1
# Útil antes de commitear/cambiar de computador para llevarte el estado de memoria.

$ErrorActionPreference = 'Stop'

$repoPath = (Get-Location).Path
$claudeProjectFolder = $repoPath -replace '[\\:/]', '-'
$source = Join-Path $env:USERPROFILE ".claude\projects\$claudeProjectFolder\memory"

if (-not (Test-Path $source)) {
    Write-Error "No existe memoria activa en $source. ¿Has tenido alguna sesión de Claude Code en este repo?"
    exit 1
}

if (-not (Test-Path "docs\MEMORY")) {
    New-Item -ItemType Directory -Force -Path "docs\MEMORY" | Out-Null
}

Copy-Item -Path (Join-Path $source "*.md") -Destination "docs\MEMORY\" -Force

Write-Host "Memoria sincronizada de:"
Write-Host "  $source"
Write-Host "a:"
Write-Host "  docs\MEMORY\"
Write-Host ""
Write-Host "Archivos sincronizados:"
Get-ChildItem "docs\MEMORY" -Filter *.md | ForEach-Object { Write-Host "  $($_.Name)" }
Write-Host ""
Write-Host "Recomendado:  git add docs/MEMORY  &&  git commit -m 'docs: sync memoria'"
