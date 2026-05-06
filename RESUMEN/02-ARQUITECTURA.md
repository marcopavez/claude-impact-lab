# 02 — Arquitectura

> 🔄 **Pivote N20 (2026-05-06) Lean MVP/PoC:** este doc refleja el **MVP Lean post-N20** — sin Twilio, sin Deepgram, sin base de datos, sin auth, sin RAG vectorial, sin Web Push persistido, sin WhatsApp Cloud, sin SMS Twilio. Servidor stateless, audio en memoria, fuentes y config demo en JSON estático, render del verdict en pantalla. Persistencia + auth + cross-channel push + telefonía live = roadmap V2 explícito en `docs/PLAN.md` cuerpo principal y Apéndice A.

## Stack MVP Lean (decidido y justificado)

| Capa | Elección | Por qué |
|---|---|---|
| **LLM motor** | **Sonnet 4.6** (Triage, Identity Verifier, Regulatory Translator, Notifier) + **Opus 4.7 + extended thinking** (Vishing Analyst) + **Haiku 4.5** (Classifier secundario) | Sonnet óptimo latencia/costo para batch <8s sobre transcript. Opus en Vishing donde 10-20s es aceptable y un FN cuesta caro. Multi-modelo declarado = bonus M3. |
| **SDK** | `@anthropic-ai/sdk` TypeScript | Mismo lenguaje en todo el stack. Skill `claude-api` aplicable. |
| **Patrón agéntico** | Cascada **Triage → Verifier (modo batch contra config demo) → Regulatory → Vishing → Notifier** + `tool_choice` forzado por agente. | Auditable, defendible en Q&A; M3 mide arquitectura agéntica. ~10-15 calls Claude por audio sostienen B3 sobradamente. |
| **Audio input** | **Audios pre-grabados subidos a la PWA** (drag-and-drop, MP3/M4A/WAV ≤60s) | N19/N20: cero infra telefónica. |
| **STT** | **ElevenLabs Scribe v1** batch (modelo `scribe_v1`) | Marco tiene API key + suscripción. Latencia 5-15s sobre audio 60s OK <30s sub-check J3.3. Multi-acento es-CL. |
| **TTS** | **ElevenLabs TTS** (modelo `eleven_v3`, voz es-CL) | Doble uso: (1) generar 3 audios demo; (2) opcional verdict hablado en PWA para accesibilidad 65+. |
| **Backend** | **Next.js 16 API route `/api/audio/process`** (Vercel serverless) | Stateless: parse multipart → ElevenLabs Scribe → cascada → response JSON. Audio buffer en memoria por request, descarte tras response. |
| **Persistencia** | **Ninguna en MVP.** Audio en memoria por request; verdict devuelto al cliente y renderizado. | Cero PII en reposo es ventaja regulatoria, no carencia. Postgres + pgvector + Storage = V2. |
| **Auth** | **Sin auth en MVP.** PWA single-page demo público. | Auth + multi-cuidador = V2. |
| **Fuentes regulatorias** | **JSON estático** en `apps/web/data/sources/*.json` con quotes pre-extraídos (Wiki Legal Fintech + BCN Ley Fácil + CMF + Sernac + CSIRT + PDI + Subtel) + **fetch HTTP** en caliente para post-validator | Sin RAG vectorial, sin pgvector, sin Voyage. Las ~7 fuentes oficiales son finitas y conocidas. |
| **Identity Firewall** | `apps/web/data/demo-config.json` hardcoded para María (whitelist + shared word + KBA) | Modo demostración: el Verifier evalúa contra ese config in-memory y genera "challenge plan recomendado". Configuración por cuidador = V2. |
| **Notificación** | **Render en pantalla** + opcional `Notification` API in-page del browser | Sin Web Push persistido, sin WhatsApp Cloud, sin SMS Twilio. El verdict + severity + citations + tools + modelo se ven en la UI. |
| **PWA** | Next.js 16 + React 19 + Tailwind v4 + shadcn/ui + manifest installable | Add-to-Home-Screen indistinguible de nativa. Single-page demo público. |
| **Hosting** | Vercel free tier (PWA + edge + API routes) | Free tier suficiente. Sin Supabase, sin Fly.io. Deploy en minutos. |

## Cascada de agentes (Lean MVP, batch)

```
PWA: cuidador sube audio (MP3/M4A/WAV ≤60s) + checkbox consentimiento
        │
        ▼
POST /api/audio/process (multipart, audio en memoria)
        │
        ▼
ElevenLabs Scribe v1 (5-15s sobre audio 60s)
        │
        ▼ transcript redactado (PII regex chileno: RUT, móvil, IBAN, tarjeta, dirección)
┌─────────────────────────────────────────────────────────────┐
│  Identity Firewall — deny-by-default (modo demostración)     │
│  N1: caller_id metadata (si vino) + intent                   │
│  N2: detección de claim de identidad en transcript           │
│  N3: comparación contra apps/web/data/demo-config.json       │
│       (whitelist + shared word + KBA hardcoded para María)   │
│  N4: verdict (fraud/suspicious/legit) + severity HIGH/MED/LO │
│       + challenge plan recomendado para el cuidador          │
└─────────────────────────────────────────────────────────────┘
        │                                    │
        ▼                                    ▼
┌────────────────────────┐       ┌───────────────────────────┐
│ Call Triage             │       │ Identity Verifier (batch) │
│ Sonnet 4.6, p50 <2s     │       │ Sonnet 4.6 (sub-agent)     │
│ tool: decide_action     │       │ tool: shared_word_check    │
│ bias defensivo prompt   │       │       kba_random_question  │
│ canary anti-exfiltración│       │       challenge_plan_gen   │
└────────────────────────┘       └───────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Regulatory Translator — Sonnet 4.6                           │
│ tool_choice: required → tool-citation-fetch                  │
│ schema: citations[] minItems:1                               │
│ fuentes: apps/web/data/sources/*.json (snapshot estático)    │
│   + fetch HTTP en caliente para post-validator               │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Vishing Analyst — Opus 4.7 + extended thinking 4-8k          │
│ Patrón fraude → cita Wiki Legal Fintech / Sernac / PDI       │
│ Validator post-generación: substring NFKC + Levenshtein 0.95 │
│   sobre fuente fetcheada en caliente (no DB)                 │
└─────────────────────────────────────────────────────────────┘
        │
        ▼ response JSON
   { transcript, verdict, severity, citations[], tools_used[],
     model_used[], challenge_plan, latency_ms }
        │
        ▼
   PWA renderiza en pantalla:
   - transcript (con redacción PII)
   - verdict + severity badge
   - citations validadas (links + quotes)
   - tools invocadas + modelo (Sonnet/Opus/Haiku)
   - challenge plan recomendado
   - audio playable (URL temporal del browser, no signed URL)
   - opcional: Notification API in-page para alerta visible
```

**Audio buffer descarte:** una vez devuelto el response, el Buffer Node.js sale del scope y queda para GC. El cliente conserva el archivo en memoria del browser (URL.createObjectURL) hasta que cierre la pestaña.

## Tools (todas SDK, sin MCPs custom en MVP Lean)

Cada tool con schema `citations[]` minItems:1 cuando aplica:

- **`tool-citation-fetch`** — fetch HTTP en caliente sobre URLs de allowlist (bcn.cl, cmfchile.cl, sernac.cl, csirt.gob.cl, sii.cl, fintech.benditaia.cl, phishtank.org, urlhaus.abuse.ch). Devuelve `quoted_text` + `source_url`.
- **`tool-phone-lookup`** — Subtel asignación de numeración + listas reportadas (snapshot JSON estático).
- **`tool-phishtank`** — URL lookup (canal texto Wow, V2 si hay tiempo).
- **`tool-urlhaus`** — URL lookup (canal texto Wow, V2 si hay tiempo).
- **`tool-shared-word-check`** — comparación contra `apps/web/data/demo-config.json` (hash en config) con normalización NFKC.
- **`tool-kba-random-question`** — selección de KBA contra config demo.
- **`tool-denuncia`** — Denuncia Builder con cita regulatoria (Capa Sólido si llega tiempo).

**MCPs custom diferidos a V2:** `mcp-wiki-legal` (RAG pgvector) y `mcp-cmf` (snapshot CMF) requerían DB; con N20 el snapshot estático cubre A5/A6 sin necesidad de servidor MCP separado. Si Marco quiere reintroducir MCPs custom para narrativa M3, se puede convertir `tool-citation-fetch` en MCP standalone que sirva el JSON estático — decisión opcional.

(V2 agrega `tool-twilio-call` para transfer/hangup en llamada en vivo, `tool-whatsapp-cc` para cross-channel ack, `tool-web-push` para alerta persistida.)

## Almacenamiento

**Ninguno en MVP.** El stateless es por diseño:

- Fuentes regulatorias: `apps/web/data/sources/*.json` (commiteado al repo, lectura por boot del server).
- Config demo Identity Firewall: `apps/web/data/demo-config.json` (commiteado, lectura por request).
- Audio: `Buffer` Node en memoria por request → ElevenLabs Scribe → descarte tras response.
- Transcript redactado: en memoria por request → cascada → descarte tras response.

**V2 introduce Supabase Postgres + pgvector + Storage** con `wiki_legal_chunks`, `bcn_leyfacil_chunks`, `cmf_alertas`, `whitelists`, `shared_words` (hash), `kba_questions` (hash), `audio_uploads` (TTL 24h, signed URL), `call_sessions` (TTL 24h, transcript redactado). Hasta entonces, todo es stateless.

## Hitos de release

- `v0.1-mvp-audio` → 3 audios E2E con cascada completa + render en pantalla + PWA mínima.
- `v0.5-solid` → batch processing múltiples audios + Denuncia Builder PDF + golden set ≥35 + multi-modelo en logs + UI pulida.
- `v1.0-demo-final` → 3 audios pre-validados + UI completa + Q&A red team rehearsed + opcional Phishing Analyst (canal texto SMS/URL si hay tiempo).
- **V2 (post-Lab):** Supabase + auth + Web Push + WhatsApp + SMS + telefonía + RAG + multi-cuidador.
