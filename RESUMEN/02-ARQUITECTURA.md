# 02 — Arquitectura

## Stack (decidido y justificado)

| Capa | Elección | Por qué |
|---|---|---|
| **LLM motor** | **Sonnet 4.6** (vivo) + **Opus 4.7 + extended thinking** (post-call) + **Haiku 4.5** (clasif. trivial) | Sonnet óptimo latencia/costo para llamada en vivo (<2s p50). Opus en post-call donde 10–30s es aceptable y un FN cuesta caro. Multi-modelo declarado = bonus M3. |
| **SDK** | `@anthropic-ai/sdk` TypeScript | Mismo lenguaje en todo el stack. Skill `claude-api` aplicable. |
| **Patrón agéntico** | Cascada **Triage → Verifier → Analyst** + `tool_choice` forzado por agente. MCPs custom como tools de primera clase. | Auditable, defendible en Q&A; M3 mide arquitectura agéntica. |
| **Telefonía** | **Twilio Programmable Voice + Media Streams** (DID Chile) | Único viable en sprint corta. µ-law 8kHz/20ms via WebSocket bidireccional. Call forwarding desde celular real = cero instalación. |
| **STT** | **Deepgram Nova-3 streaming** (default) + **whisper.cpp local** (fallback Fly.io) | Vendor neutro, <300ms interim transcripts, es-CL. Whisper local si "solo Claude" se interpreta literal estricto. |
| **TTS** | **Twilio Polly Lupe-Neural** (TwiML) con `<prosody rate="slow">` | Incluido, integración trivial, neutro chileno, dicción para 65+. |
| **RAG** | **pgvector** sobre Postgres (Supabase) | Estándar. RLS por `caregiver_id`. Free tier suficiente. |
| **Embeddings** | **Voyage AI `voyage-3`** | Calidad alta es-CL, no acopla a otro LLM (mantiene Claude motor único). |
| **Canal de adopción** | Call forwarding GSM `**21*<DID>#` | Cero instalación, cero login, soportado en todos los operadores chilenos. |
| **PWA cuidador** | Next.js 15 + React 19 + Tailwind + shadcn/ui + Supabase magic link + Web Push API | Add-to-Home-Screen indistinguible de nativa. Detalle en `docs/SEGURIDAD.md` Parte III. |
| **Push** | Web Push (primario) + WhatsApp Cloud API (HIGH risk) + SMS Twilio (fallback KYC) | Redundante por nivel de riesgo. |
| **MCPs custom** | `mcp-wiki-legal` + `mcp-cmf` (standalone) | Sostiene narrativa "MCP custom" sin sobre-ingeniar. |
| **Hosting** | Vercel (PWA + edge) + Supabase (DB+Auth+Storage) + Fly.io (worker whisper opcional) | Free tier en todos. Deploy en minutos. |

## Cascada de agentes (en vivo)

```
Twilio Media Streams (µ-law 20ms)
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│  Identity Firewall — deny-by-default                         │
│  Nivel 1: caller_id lookup + intent rápido                   │
│  Nivel 2: shared word + KBA según claim                      │
│  Nivel 3: cross-channel WhatsApp ack                         │
│  Nivel 4: política AND multi-factor para transferir          │
└─────────────────────────────────────────────────────────────┘
        │                                    │
        ▼                                    ▼
┌────────────────────────┐       ┌───────────────────────────┐
│ Call Triage             │       │ Identity Verifier          │
│ Sonnet 4.6, p50 <2s     │       │ Sonnet 4.6 (sub-agent)     │
│ tool: decide_action     │       │ shared_word_check          │
│ bias defensivo prompt   │       │ kba_random_question        │
└────────────────────────┘       │ cross_channel_whatsapp     │
                                  └───────────────────────────┘
        │
        ▼ (post-call, paralelo)
┌─────────────────────────────────────────────────────────────┐
│ Vishing Analyst — Opus 4.7 + extended thinking               │
│ Patrón fraude → cita Wiki Legal Fintech / Sernac / PDI       │
│ tool_choice: required, citations[] minItems:1                │
└─────────────────────────────────────────────────────────────┘
        │
        ▼ alertas
   Web Push  +  WhatsApp (HIGH)  +  SMS (fallback)
        │
        ▼
   PWA Cuidador (transcript SSE + decisión + tools + modelo)
```

## Tools (MCPs + SDK)

**MCPs custom** (servidores standalone, Voyage embeddings + pgvector):
- `mcp-wiki-legal` — RAG sobre Wiki Legal Fintech, BCN Ley Fácil, leyes 21.459/21.663/21.521/19.628/21.719.
- `mcp-cmf` — CMF Alertas + Registro Prestadores Fintec (Ley 21.521).

**Tools del SDK** (cada tool con schema `citations[]` minItems:1 cuando aplica):
- `tool-phone-lookup` — Subtel asignación de numeración + listas reportadas.
- `tool-phishtank`, `tool-urlhaus` — URL lookup.
- `tool-twilio-call` — transfer / hangup / TwiML directives.
- `tool-whatsapp-cc` — cross-channel ack al teléfono real del whitelisted.
- `tool-web-push` — alerta al cuidador (VAPID).
- `tool-denuncia` — Denuncia Builder con cita regulatoria.

## Almacenamiento (Postgres + pgvector, Supabase)

- `wiki_legal_chunks`, `bcn_leyfacil_chunks`, `leyes_chunks`, `cmf_alertas`, `sernac_alertas`, `pdi_cibercrimen` (fuentes oficiales con TTL diario).
- `whitelists`, `shared_words` (hash bcrypt/argon2id), `kba_questions` (hash) — RLS por `caregiver_id`.
- `call_sessions` (TTL 24h, transcript redactado).
- `audio_storage` (TTL 24h, signed URLs).

## Hitos de release

- `v0.1-mvp-call` → llamada end-to-end con cascada mínima.
- `v0.5-solid` → firewall multi-factor completo + PWA en línea.
- `v1.0-demo-final` → 3 llamadas pre-validadas + backup video + Civic Intel mínimo.
