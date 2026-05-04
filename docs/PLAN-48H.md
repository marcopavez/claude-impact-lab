# Sprint 48h — Vigía

> **Ventana:** `2026-05-06 00:00` → `2026-05-07 23:59` Chile.
> **Hoy:** `2026-05-04`. Hasta `2026-05-05 23:59` solo planning docs en `docs/`.

## Fase 0 — Pre-ventana (`2026-05-04` y `2026-05-05`)

**Restricción dura: NO code de aplicación. Solo planning, research, mockups, cuentas.**

- [x] CLAUDE.md, docs/IDEA.md, docs/FICHA-CIVICA.md, docs/PLAN-48H.md (esta sesión).
- [ ] **Cuentas y keys** (Marco):
  - Anthropic API key (Claude Sonnet 4.6 + Opus 4.7 + Haiku 4.5)
  - Supabase proyecto (Postgres + pgvector + Storage)
  - Vercel proyecto
  - Voyage AI key (`voyage-3` embeddings)
  - OpenAI key (Whisper)
  - Meta WhatsApp Cloud API sandbox (opcional, stretch)
- [ ] **Research operativo** (sin codear):
  - Endpoint exacto y formato de CMF Alertas (puede requerir scraping si no hay API JSON estable).
  - Endpoint PhishTank (necesita registro free).
  - Endpoint URLhaus (API pública, sin auth).
  - Estructura de Wiki Legal (HTML estructurado vs PDFs).
- [ ] **Sketches UI** (Figma o Excalidraw): chat web fallback, panel de reasoning visible.
- [ ] **Pitch deck draft** (slides Google/Keynote): problema → solución → demo (vivo) → tracción y visión → equipo. Ensayo timing 3 min.
- [ ] **Lectura completa Wiki Legal** y mapeo de chunks relevantes para RAG (ley 21.459, 21.663, 21.521, 19.628, derechos ARCO).

## Fase 1 — Día 1 (`2026-05-06`, ~14h efectivas)

**Hito D1:** J1 (María / smishing) end-to-end en web chat. Tag `v0.1-mvp`.

| Bloque | Owner | Salida |
|---|---|---|
| 00:00–01:30 | infra | `git init`, monorepo (`apps/api` Bun+Hono, `apps/web` Next.js 15 App Router, `packages/agents`, `packages/mcps`, `packages/db`). CI mínimo (lint + typecheck). Deploy preview Vercel + Supabase project provisioned. |
| 01:30–04:00 | data | Ingest scripts (`packages/db/ingest/`): scrape CMF Alertas, parse Wiki Legal HTML, dump PhishTank/URLhaus snapshots. Esquema `wiki_legal_chunks`, `cmf_alertas`, `leyes_chunks`, `fraude_signals`. Embeddings `voyage-3` batch. |
| 04:00–07:00 | agentes | Orquestador (Sonnet 4.6) + Phishing Analyst (Sonnet 4.6) + Regulatory Translator (Sonnet 4.6 + RAG). System prompts en `packages/agents/prompts/`. Tools schema JSON. Tests manuales con casos golden. |
| 07:00–10:00 | MCPs | `mcp-cmf` (alertas + entidades), `mcp-wiki-legal` (RAG pgvector con `tool_choice: required`), `mcp-phishtank`, `mcp-urlhaus`. Servidores MCP corren localmente y se exponen al orquestador. |
| 10:00–12:30 | UI | Web chat (Next.js + shadcn/ui o Tailwind). Streaming SSE. **Panel de reasoning visible** (muestra tool calls del orquestador). Mobile-first, accesible (font ≥18px, contraste alto, sin jerga). |
| 12:30–14:00 | E2E J1 | Smishing journey end-to-end. Test set golden. Demo intermedio video (1 min, interno). Tag `v0.1-mvp`. |

## Fase 2 — Día 2 (`2026-05-07`, hasta 17:00)

**Hito D2:** J2 + J3 funcionales o pre-grabados; entregables submitted.

| Bloque | Owner | Salida |
|---|---|---|
| 00:00–03:00 | agentes | **Vishing Analyst** (Opus 4.7 + extended thinking). **Denuncia Builder** (Sonnet 4.6) con templates SERNAC. |
| 03:00–05:00 | STT | Whisper integration. Streaming transcription en web (MediaRecorder API → blob → Whisper). |
| 05:00–07:00 | E2E J2 + J3 | Vishing journey + cripto journey end-to-end. |
| 07:00–09:00 | WhatsApp (stretch) | Cloud API Meta (sandbox). Webhook handler en `apps/api`. **Si bloqueado, descartamos y dejamos web chat como demo principal.** |
| 09:00–11:00 | polish | System prompts finales (revisión de citación obligatoria). Error handling en orquestador (degradación elegante). README completo con sección de privacidad. **Screenshots consola Claude** para entregable. |
| 11:00–13:00 | demo video | Grabar demo 3-5 min mostrando J1+J2+J3. Voz en off limpia. Subtítulos. Export ≤100 MB. |
| 13:00–14:00 | **Submit ficha cívica** | Antes de `10:00` ⚠ — si vamos atrasados, **adelantamos este bloque al inicio del día 2**. |
| 14:00–17:00 | **Submit entregable técnico** | Demo video + screenshot consola Claude + system prompt + repo público + tools schema JSON + declaración herramientas Anthropic usadas. |

> ⚠ **Crítico:** la ficha cívica deadline es `10:00`. Si el día 2 va apretado, la submitimos a las **08:00** del día 2 (antes de empezar el sprint técnico final). Plan B: redactarla completa al final del día 1.

## Fase 3 — Pitch (`2026-05-07` Demo Day)

- **3 min pitch** siguiendo deck: problema (30s) → solución y demo en vivo (90s) → tracción/visión (45s) → cierre (15s).
- **2 min Q&A** — equipo domina arquitectura, decisiones de modelo, edge cases (red team).
- **Backup:** si demo en vivo falla, video pre-grabado se reproduce sin transición visible.

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| WhatsApp Cloud API setup demora (verificación Meta) | Alta | Web chat es la demo principal; WhatsApp es stretch. |
| Cuotas embeddings/LLM se agotan | Media | Pre-computar embeddings al inicio del día 1; cache agresivo de respuestas en memoria; multi-modelo (Haiku para clasificación). |
| Alucinación regulatoria en demo en vivo | Media | `tool_choice: required` en agente regulatorio. Set de preguntas pre-validadas. Backup video si una respuesta sale mal. |
| Audio en demo en vivo falla (mic, transcripción) | Alta | Video pre-grabado del journey vishing, mostrado como "evidencia de Carlos". |
| MCPs consumen demasiado tiempo de build | Media | Empezar con 2 (cmf + wiki-legal); el resto se agrega solo si hay margen. |
| Datos CMF cambian formato durante el ingest | Baja | Snapshot estático JSON committeado en `packages/db/seeds/` como fallback. |
| Equipo se atasca en infra | Alta | Pair programming en bloques de infra; timeboxing estricto (máx 90 min por subtask infra). |

## Definition of done (para entregables)

- [ ] J1 (smishing) funcional end-to-end en web chat.
- [ ] J2 (vishing) funcional o video pre-grabado convincente.
- [ ] J3 (cripto) funcional o screenshots en deck.
- [ ] Citación obligatoria visible en todas las respuestas regulatorias.
- [ ] Demo video 3-5 min ≤ 100 MB.
- [ ] Ficha cívica submitted antes de `2026-05-07 10:00`.
- [ ] Entregable técnico submitted antes de `2026-05-07 17:00`:
  - Demo video
  - Screenshot consola Claude
  - System prompt principal del orquestador
  - Repo público GitHub (link)
  - Tools schema JSON exportado
  - Declaración herramientas Anthropic (Extended Thinking ✓, MCP ✓, multi-modelo ✓; Files API y Computer Use solo si los usamos realmente).
- [ ] README con sección Privacy + sección Equipo + sección Cómo se construyó en 48h.
- [ ] Pitch ensayado **mínimo 2 veces** con cronómetro.

## Equipo y ownership (a llenar)

| Rol | Persona | Foco |
|---|---|---|
| Tech Lead | Marco | Orquestador, agentes, system prompts. |
| Data | TBD | Ingest, RAG, embeddings, MCPs CMF/Wiki. |
| Frontend | TBD | Web chat, panel reasoning, deploy. |
| Pitch / Producto | TBD | Ficha cívica, deck, narrativa, video. |

> Si el equipo es de 1-2 personas, se ejecuta serializado en lugar de paralelo y se descartan stretch goals (WhatsApp, J3) sin afectar el MVP.
