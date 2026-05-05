#!/usr/bin/env bash
# Sincroniza la memoria persistente actual de Claude Code hacia docs/MEMORY/ del repo.
# Uso: bash scripts/sync-memory-to-repo.sh
# Útil antes de commitear/cambiar de computador para llevarte el estado de memoria.

set -euo pipefail

repo_path="$(pwd)"
claude_project_folder=$(printf '%s' "$repo_path" | sed 's|[/:\\]|-|g')
source="$HOME/.claude/projects/$claude_project_folder/memory"

if [ ! -d "$source" ]; then
  echo "Error: no existe memoria activa en $source." >&2
  echo "¿Has tenido alguna sesión de Claude Code en este repo?" >&2
  exit 1
fi

mkdir -p docs/MEMORY
cp "$source"/*.md docs/MEMORY/

echo "Memoria sincronizada de:"
echo "  $source"
echo "a:"
echo "  docs/MEMORY/"
echo ""
echo "Archivos sincronizados:"
ls -1 docs/MEMORY/*.md | sed 's|.*/|  |'
echo ""
echo "Recomendado:  git add docs/MEMORY  &&  git commit -m 'docs: sync memoria'"
