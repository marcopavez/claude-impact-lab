# Restaura la memoria de Claude Code para este repo en este computador.
# Uso: .\scripts\bootstrap-memory.ps1
# Calcula automáticamente el folder de Claude Code para el path actual del repo
# y copia los .md desde docs/MEMORY/ a ~/.claude/projects/<projectFolder>/memory/.

$ErrorActionPreference = 'Stop'

$repoPath = (Get-Location).Path
$claudeProjectFolder = $repoPath -replace '[\\:/]', '-'
$dest = Join-Path $env:USERPROFILE ".claude\projects\$claudeProjectFolder\memory"

if (-not (Test-Path "docs\MEMORY")) {
    Write-Error "No existe 'docs\MEMORY' en este directorio. ¿Estás en la raíz del repo?"
    exit 1
}

New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item -Path "docs\MEMORY\*.md" -Destination $dest -Force

Write-Host "Memoria restaurada en:"
Write-Host "  $dest"
Write-Host ""
Write-Host "Archivos copiados:"
Get-ChildItem $dest -Filter *.md | ForEach-Object { Write-Host "  $($_.Name)" }
