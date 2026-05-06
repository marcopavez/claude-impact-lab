---
name: commit-window-guard
description: Use before any git commit during the sprint. Verifies that current time is within the build window (>= 2026-05-06 00:00 CLT) when the staged diff includes application code (apps/, packages/, prompts/). Documentation-only commits (docs/, RESUMEN/, README.md, .claude/, .gitignore) are allowed before the window opens. Sustains sub-check B3. Triggers - "commit", "git commit", "voy a commitear".
---

# Skill — commit-window-guard

## Cuándo invocar

Antes de cualquier `git commit` durante la sprint. Si el commit es solo de docs (cualquier archivo bajo `docs/`, `RESUMEN/`, `README.md` raíz, `.claude/`, `.gitignore`, `LICENSE`), pasa libre. Si el commit incluye **código de aplicación** y la fecha actual es `< 2026-05-06T00:00 CLT`, **bloqueá**.

## Procedimiento

1. **Hora actual:** capturá `Get-Date` (PowerShell) o `date` (bash) en zona local. Pasala a UTC. Comparála con `2026-05-06T00:00:00-04:00` (CLT, UTC-4). En CLST sería UTC-3 — verificá zona del sistema.

2. **Diff staged:**
   ```
   git diff --cached --name-only
   ```
   Capturá la lista.

3. **Clasificación:**
   - **Doc-only:** todos los paths matchean `^(docs/|RESUMEN/|README.md|\.claude/|\.gitignore|LICENSE|.*\.md$)`.
   - **Code-touching:** al menos un path no matchea lo anterior — típico: `apps/`, `packages/`, `prompts/`, `scripts/`, `*.ts`, `*.tsx`, `*.json` config.

4. **Decisión:**
   - Doc-only → ✅ pasa, sin output.
   - Code-touching && hora < ventana → 🔴 BLOQUEAR. Output:
     ```
     ❌ commit-window-guard: ventana cerrada.
     Hora actual:    {ISO timestamp local}
     Ventana abre:   2026-05-06T00:00:00 CLT
     Tiempo restante: {Xh Ym}
     Archivos código en stage:
       - apps/server/src/twilio-webhook.ts
       - prompts/triage.md
     Permitido fuera de ventana: solo docs/.
     Acción: unstage los archivos de código (`git restore --staged <files>`) o esperá la ventana.
     ```
     Exit code 2 si corrés como hook.
   - Code-touching && hora >= ventana → ✅ pasa con un único log: `commit-window-guard: ventana abierta — {filecount} archivos código autorizados.`

5. **Sub-check B3 reminder:** si esta es la PRIMERA invocación del día con `code-touching && ventana abierta`, recordale a Marco: *"Primer commit de código en ventana — verificá que ya tomaste screenshot de los ≥3 mensajes en consola Anthropic para evidencia B3."*

## Edge cases

- **Reloj del sistema mal configurado:** si timezone es UTC y la fecha parece offset, refuerza con `date -u` y comparas contra UTC equivalente.
- **Commits mixtos:** si el stage tiene mix doc + código, el commit completo se considera code-touching. No haces split automático — eso es decisión de Marco. Sugerís `git commit docs/... -m "..."` aparte.
- **--amend:** si Marco intenta amend a un commit fuera de ventana, doble bloqueo + warning explícito.

## Anti-patrones

- No hagas el check más permisivo "porque casi" abre la ventana. Ventana es estricta o no es defensa para B3.
- No bloquees commits de docs. La docs/ se trabaja antes y después de la ventana.
- No silencies la primera advertencia de "B3 reminder" — es lo que evita que Marco tenga el código pero le falte la evidencia.
