#!/usr/bin/env bash
# Restaura la memoria de Claude Code para este repo en este computador.
# Uso: bash scripts/bootstrap-memory.sh
# Calcula automáticamente el folder de Claude Code para el path actual del repo
# y copia los .md desde docs/MEMORY/ a ~/.claude/projects/<projectFolder>/memory/.

set -euo pipefail

if [ ! -d "docs/MEMORY" ]; then
  echo "Error: no existe 'docs/MEMORY' en este directorio. ¿Estás en la raíz del repo?" >&2
  exit 1
fi

repo_path="$(pwd)"
# Reemplaza /, :, y \ por - para coincidir con la convención de Claude Code.
claude_project_folder=$(printf '%s' "$repo_path" | sed 's|[/:\\]|-|g')
dest="$HOME/.claude/projects/$claude_project_folder/memory"

mkdir -p "$dest"
cp docs/MEMORY/*.md "$dest/"

echo "Memoria restaurada en:"
echo "  $dest"
echo ""
echo "Archivos copiados:"
ls -1 "$dest"/*.md | sed 's|.*/|  |'
