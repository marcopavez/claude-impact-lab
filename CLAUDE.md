# CLAUDE.md — Vigía (Claude Impact Lab 2026 · Chile)

## Misión
Construir un asistente multi-agente que protege a la ciudadanía chilena del fraude financiero digital — en tiempo real, en lenguaje claro y con citas obligatorias a fuentes oficiales. Track principal: **Mesa 3 (Protección y Confianza Digital)**. Cruza Mesa 1 (Lenguaje y Accesibilidad) y Mesa 2 (Interoperabilidad) por diseño.

Detalle del concepto en `docs/IDEA.md`. Ficha cívica draft en `docs/FICHA-CIVICA.md`. Sprint 48h en `docs/PLAN-48H.md`.

## Principios no negociables

1. **Decisiones sólidas, no parches.** Antes de implementar algo no trivial, justifico técnicamente y pido alineamiento con Marco. Los hacks no sobreviven al red team del Q&A.
2. **Respuestas concisas y al hueso.** Cada respuesta a Marco fundamenta brevemente el "por qué" detrás del "qué". Sin paja, pero con justificación técnica explícita.
3. **Cita o calla.** Toda afirmación regulatoria del agente cita fuente oficial (Wiki Legal, CMF, BCN, SII, SERNAC) o responde "no encontré fuente". La rúbrica penaliza −30% por alucinación grave; aplicamos `tool_choice: required` para forzar consulta antes de afirmar.
4. **PII al mínimo.** No persistimos RUT, datos bancarios ni historial. Procesamiento efímero (in-memory, sin logs persistentes con PII). README declara el manejo.
5. **Ventana de construcción sagrada.** Código de aplicación se commitea **solo** entre `2026-05-06 00:00` y `2026-05-07 23:59` (hora Chile). Antes y después: solo planning docs en `docs/`.

## Stack (decidido, justificado)

| Capa | Elección | Por qué |
|---|---|---|
| LLM motor | Claude Sonnet 4.6 (orquestador + especialistas), Opus 4.7 + extended thinking (analista vishing y regulatorio crítico), Haiku 4.5 (clasificación rápida y filtros baratos) | Sonnet 4.6 = mejor relación reasoning/costo. Opus 4.7 con extended thinking minimiza alucinación regulatoria. Haiku para barreras de costo cuando el routing es trivial. |
| SDK | `@anthropic-ai/sdk` TypeScript | Mismo lenguaje frontend ↔ backend, menor fricción en 48h. |
| Patrón agéntico | Orquestador → especialistas vía tool use; **MCPs custom como tools de primera clase** | Bonus agéntico explícito (D3 + bonus). |
| RAG | pgvector sobre Postgres (Supabase free tier) | Estándar, deploy en minutos, free tier suficiente. |
| Embeddings | Voyage AI (`voyage-3`) | Calidad alta para español, costo bajo, **no acopla a otro LLM** (mantiene Claude como motor único). |
| Canal usuario | WhatsApp Cloud API (Meta) + fallback web chat | WhatsApp = penetración total Chile, accesible para 65+. Web chat de respaldo confiable para Demo Day. |
| STT | Whisper API (OpenAI) | STT **no es LLM motor** — Claude sigue siendo el cerebro. Solo transcribe. |
| MCPs custom | CMF Alertas, Wiki Legal RAG, PhishTank, URLhaus, SERNAC | Bonus agéntico + interoperabilidad real (cruza Mesa 2). |
| Hosting | Vercel + Supabase | Deploy en minutos, free tier, demos públicos. |

**Decisiones que NO tomamos (y por qué):**
- React Native → costo de setup en 48h excesivo; PWA sirve igual.
- LangChain / LangGraph → capa innecesaria sobre Anthropic SDK; agrega abstracciones especulativas.
- GPT-4 / Gemini como motor → **descalifica** (Claude debe ser motor principal).
- Embeddings de OpenAI → acoplamiento innecesario a otro proveedor; Voyage AI nos basta.

## Git & gitflow

- `main` → solo releases estables; merge desde `develop` en hitos (`v0.1-mvp`, `v1.0-demo-final`).
- `develop` → integración continua durante la sprint.
- `feat/<scope>` por feature, `fix/<scope>` por bug, `docs/<scope>` para documentación.
- **Conventional Commits en español:** `feat: detector de smishing v1`, `fix: cita CMF en respuesta de phishing`, `docs: arquitectura agentes`.
- Tags al cierre de cada hito.
- Todo commit relevante DENTRO de la ventana. Si aparece commit fuera, se revierte o re-empaqueta.
- **Nunca** `--no-verify`, `--amend` sobre commits compartidos, ni `push --force` a `main`/`develop`.

## Cómo colaboramos (Marco ↔ Claude)

- **Antes de implementar** algo no trivial, propongo approach (qué, por qué, alternativas descartadas) y pido feedback.
- **Agentes (`Agent` tool):** uso `Explore` para búsquedas amplias en repo y `Plan` para diseño de implementación. No los uso para tareas de una sola llamada.
- **Skills:** invoco las del repo cuando aplican (`init`, `review`, `security-review`, `simplify`, `update-config`, `frontend-design:frontend-design`). No invento skills que no estén disponibles.
- **Memoria:** persisto decisiones, feedback y contexto del proyecto en el sistema de memoria. Si Marco corrige algo, queda guardado para futuras sesiones.
- **Tareas:** `TaskCreate` durante la sprint para tracking visible. Cierro cada tarea al cumplirla, no en batch.
- **Reportes:** al finalizar bloques de trabajo, una o dos frases sobre qué cambió y qué sigue.
- **Idioma:** Marco escribe en español, le respondo en español. Código y commits en inglés (estándar) excepto los mensajes de commit que van en español.

## Defensas anti-descalificación (gates de la rúbrica)

- ✅ **Claude motor principal**: todo razonamiento de negocio pasa por Claude API. Whisper es solo transcripción auxiliar.
- ✅ **Sin alucinación regulatoria**: agente regulatorio responde con `tool_choice: required` sobre MCP Wiki Legal, o devuelve "no encontré fuente para esta consulta". System prompt + verificación en revisión.
- ✅ **Sin trabajo preexistente**: hoy (`2026-05-04`) y mañana solo `docs/`. Código aplicación nace `2026-05-06 00:00`.
- ✅ **PII mínima**: declarada en README. No persistimos RUT/banco/historial.
- ✅ **Fuente declarada**: cualquier mención normativa cita fuente oficial. UI muestra el link.
- ✅ **Entregables completos**: ficha cívica + entregable técnico + pitch — tres deadlines, tres dueños.
- ✅ **Equipo domina lo que construyó**: cada decisión arquitectónica documentada en `docs/IDEA.md` para Q&A.

## Anti-patrones (qué NO hacer)

- No inventar features en el pitch que no aparecen en demo.
- No mockear datos regulatorios — todos vienen de fuente oficial citable.
- No agregar abstracciones especulativas; cada capa justifica su existencia.
- No commitear secrets ni `.env`. Sí `.env.example`.
- No "amend" commits firmados por el equipo.
- No respuestas largas a Marco si una corta resuelve.

## Recursos clave

- **Wiki Legal:** https://fintech.benditaia.cl/es/wiki-legal
- **CMF Alertas al público:** https://www.cmfchile.cl/portal/principal/613/w3-propertyvalue-43545.html
- **CSIRT Chile:** https://www.csirt.gob.cl
- **PhishTank:** https://phishtank.org
- **URLhaus:** https://urlhaus.abuse.ch
- **SERNAC:** https://www.sernac.cl
- **BCN (textos oficiales de leyes):** https://www.bcn.cl/leychile
- **Leyes relevantes:** 21.459 (delitos informáticos), 21.663 (ciberseguridad/ANCI), 21.521 (Fintech), 19.628 (datos personales), 19.223 (delitos informáticos base).

## Hitos y deadlines

| Cuándo | Qué | Estado |
|---|---|---|
| `2026-05-04` (hoy) | Planning docs, ficha cívica draft | en curso |
| `2026-05-05` | Cuentas (Anthropic, Supabase, Vercel, Voyage, OpenAI), sketches UI, deck draft | pendiente |
| `2026-05-06 00:00` | **Apertura ventana de build.** Init repo, monorepo, ingest scripts | pendiente |
| `2026-05-06 23:59` | J1 (smishing) end-to-end. Tag `v0.1-mvp` | pendiente |
| `2026-05-07 10:00` | **Submit ficha cívica** | pendiente |
| `2026-05-07 17:00` | **Submit entregable técnico** | pendiente |
| `2026-05-07 23:59` | Cierre ventana | pendiente |
| `2026-05-07` Demo Day | Pitch en vivo (3 min + 2 min Q&A) | pendiente |
