---
name: Ventana de build sagrada (Claude Impact Lab 2026)
description: Código y consola Anthropic solo entre 2026-05-06 00:00 y 2026-05-07 23:59 hora Chile; primer call API exacto a las 00:00 del 6-may
type: feedback
originSessionId: 493db4f7-1f96-46cd-a840-5c35375738b5
---
**Restricción dura del evento (BASES.md §7 + RUBRICA.md sub-check B3):** todo código, contenido y mensajes a la consola Anthropic deben estar dentro de la ventana `2026-05-06 00:00` → `2026-05-07 23:59` hora Chile (UTC-4). Sub-check **B3 exige consola Anthropic con ≥3 mensajes EN VENTANA**. Calls al API antes del 6-may 00:00 NO cuentan. Si la consola no muestra ≥3 mensajes en ventana → B3 = no_cumple → cae M3 (35% del score mentor).

**Deadlines duros internos (calendario BASES.md §5):**
- **Entregable técnico:** `2026-05-06 20:00` (deadline efectivo de fase mentor; Bendi pre-evalúa al cierre de cada entrega; cierre evaluación mentor 23:59 mismo día).
- **Cron Top 4 finalistas:** `2026-05-07 09:00` (calculado sobre score_mentor del entregable técnico).
- **Ficha cívica:** `2026-05-07 10:00` (recomendación interna: subir 09:00, antes del cron).
- **Cierre ventana:** `2026-05-07 23:59` (cero commits después).

> Nota sobre contradicción interna en BASES.md: la sección 4 menciona "antes del 7 mayo 17:00" para el entregable técnico, pero la sección 5 (calendario detallado) dice 6 mayo 20:00. Optimizamos para 6-may 20:00 porque es internamente consistente con el resto del calendario (Bendi evalúa el 6, mentor cierra 23:59 ese día, cron 7-may 09:00). Si llegamos a finalistas, podríamos refinar el entregable hasta 7-may 17:00 — pero no apostamos por ese margen.

**Why:** Riesgo asimétrico: la pérdida por sub-check B3 = no_cumple (35% del score mentor) o por descalificación (commits/calls fuera) supera cualquier ganancia de empezar antes. La sección 7 de BASES.md elimina los gates discrecionales en favor de sub-checks deterministas con evidencia — ahora la auditoría es por consola y por timestamp del repo, automática.

**How to apply:**
- **Antes del `2026-05-06 00:00`:** solo planning docs en `docs/`, decisiones, mockups, cuentas. **Cero código de aplicación. Cero calls de prueba al API Anthropic** — registrarse en consola Anthropic está bien; emitir el primer call NO.
- **Después del `2026-05-07 23:59`:** cero commits hasta el cierre del evento.
- **`git init` el `2026-05-06 00:00` exacto** como primer commit `feat: init` o `chore: init repo`.
- **Primer call al API Anthropic el `2026-05-06 00:00` exacto** — un "hola mundo" al orquestador para abrir B3.
- Si Marco pide adelantar código, recordar la regla y proponer mover ese trabajo a la ventana.
- Excepción aceptable: contenido de `docs/` (planning, ficha cívica, pitch, system prompts en docs/PROMPTS.md como texto) puede existir antes; explicarlo en README/notas si hace falta justificar al agente técnico.
