# Nota pre-ventana de build

> Para el agente técnico del Claude Impact Lab 2026 y el mentor regulatorio.

Los archivos commiteados antes del `2026-05-06 00:00` (hora Chile) son **exclusivamente planning docs**:

- `CLAUDE.md` — guía operacional para el agente Claude que asistirá al equipo durante la sprint.
- `docs/IDEA.md` — concepto, arquitectura propuesta, mapeo a la rúbrica del Lab.
- `docs/FICHA-CIVICA.md` — borrador del entregable que se submitirá vía `/app > Entregables` antes de `2026-05-07 10:00`.
- `docs/PLAN-48H.md` — sprint plan con riesgos y mitigaciones.

**No existe código de aplicación, schemas, prompts ejecutables, datos de ingesta ni infraestructura desplegada antes de la apertura de la ventana de build.**

El primer commit con código de aplicación ocurre dentro de la ventana `2026-05-06 00:00` → `2026-05-07 23:59` (hora Chile), y será trazable por timestamp y mensaje `feat:` siguiendo Conventional Commits en español.

Esta práctica es consistente con la regla **"Sin trabajo preexistente"** del Lab — la planificación previa (concepto, ficha cívica draft, plan, configuración del asistente) no constituye trabajo de construcción fuera de ventana, sino preparación al sprint.
