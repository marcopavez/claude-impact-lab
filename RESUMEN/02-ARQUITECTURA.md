# 02 — Arquitectura

> 🔄 **Pivote N19 (2026-05-06):** este doc refleja el **MVP audio-first**. Telefonía live (Twilio Voice + Media Streams + Deepgram + call forwarding GSM + Polly Lupe-Neural) = roadmap V2 explícito en `docs/PLAN.md` cuerpo principal y `docs/PROYECTO.md` §10-11.

## Stack MVP (decidido y justificado)

| Capa | Elección | Por qué |
|---|---|---|
| **LLM motor** | **Sonnet 4.6** (Triage, Identity Verifier, Regulatory Translator, Caregiver Notifier) + **Opus 4.7 + extended thinking** (Vishing Analyst) + **Haiku 4.5** (Classifier secundario) | Sonnet óptimo latencia/costo para batch <8s sobre transcript. Opus en Vishing donde 10-20s es aceptable y un FN cuesta caro. Multi-modelo declarado = bonus M3. |
| **SDK** | `@anthropic-ai/sdk` TypeScript | Mismo lenguaje en todo el stack. Skill `claude-api` aplicable. |
| **Patrón agéntico** | Cascada **Triage → Verifier (modo batch) → Regulatory → Vishing → Notifier** + `tool_choice` forzado por agente. MCPs custom como tools de primera clase. | Auditable, defendible en Q&A; M3 mide arquitectura agéntica. |
| **Audio input MVP** | **Audios pre-grabados subidos a la PWA** (drag-and-drop, MP3/M4A/WAV ≤60s) | N19: cero infra telefónica, cero KYC, cero WebSocket. Procesamiento batch. |
| **STT** | **ElevenLabs Scribe v1** batch (modelo `scribe_v1`) | Marco tiene API key + suscripción. Latencia 5-15s sobre audio 60s OK <30s sub-check J3.3. Multi-acento es-CL. |
| **TTS** | **ElevenLabs TTS** (voz es-CL, modelo `eleven_multilingual_v2`) | Doble uso: (1) generar 3 audios demo (cuento del tío / banco oficial / familiar legítimo); (2) opcional verdict hablado en PWA para accesibilidad 65+. |
| **RAG** | **pgvector** sobre Postgres (Supabase) | Estándar. RLS por `caregiver_id`. Free tier suficiente. |
| **Embeddings** | **Voyage AI `voyage-3`** | Calidad alta es-CL, no acopla a otro LLM (mantiene Claude motor único). |
| **Canal de adopción MVP** | Audio upload en PWA (cuidador o persona protegida sube audio sospechoso recibido en su celular) | N19: cero instalación. V2: call forwarding GSM `**21*<DID>#`. |
| **PWA cuidador** | Next.js 16 + React 19 + Tailwind v4 + shadcn/ui + Supabase Auth magic link + Web Push API + manifest installable | Add-to-Home-Screen indistinguible de nativa. Detalle en `docs/SEGURIDAD.md` Parte III. |
| **Push** | Web Push (primario) + WhatsApp Cloud API (HIGH risk) + SMS Twilio (fallback si Meta KYC tarda) | Redundante por nivel de riesgo. |
| **MCPs custom** | `mcp-wiki-legal` (RAG pgvector + Voyage) + `mcp-cmf` (snapshot JSON Prestadores Fintec + Alertas) | Sostiene narrativa "MCP custom" sin sobre-ingeniar. |
| **Hosting** | Vercel (PWA + edge + API routes) + Supabase (DB + Auth + Storage) | Free tier en todos. Deploy en minutos. |

## Cascada de agentes (audio-first batch)

```
PWA: cuidador sube audio → POST /api/audio/process
        │
        ▼
ElevenLabs Scribe v1 (5-15s sobre audio 60s)
        │
        ▼ transcript redactado (PII regex chileno)
┌─────────────────────────────────────────────────────────────┐
│  Identity Firewall — deny-by-default (modo batch)            │
│  N1: caller_id metadata (si vino) + intent                   │
│  N2: detección de claim de identidad en transcript           │
│  N3: generación de "challenge plan recomendado" para cuidador│
│  N4: verdict (fraud/suspicious/legit) + push severity        │
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
│ tool_choice: required → mcp_wiki_legal.search                │
│ schema: citations[] minItems:1                               │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ Vishing Analyst — Opus 4.7 + extended thinking 4-8k          │
│ Patrón fraude → cita Wiki Legal Fintech / Sernac / PDI       │
│ Validator post-generación: substring NFKC + Levenshtein 0.95 │
└─────────────────────────────────────────────────────────────┘
        │
        ▼ alertas
   Web Push  +  WhatsApp (HIGH)  +  SMS (fallback)
        │
        ▼
   PWA Cuidador (transcript SSE + verdict + tools + modelo + audio playable)
```

## Tools (MCPs + SDK)

**MCPs custom** (sustentan B2 — MCP custom obligatorio):
- `mcp-wiki-legal` — RAG sobre Wiki Legal Fintech, BCN Ley Fácil, leyes 21.459/21.663/21.521/19.628/21.719, alertas Sernac, boletines PDI Cibercrimen + CSIRT.
- `mcp-cmf` — snapshot CMF Alertas + Registro Prestadores Fintec (Ley 21.521).

**Tools del SDK** (cada tool con schema `citations[]` minItems:1 cuando aplica):
- `tool-phone-lookup` — Subtel asignación de numeración + listas reportadas.
- `tool-phishtank`, `tool-urlhaus` — URL lookup (canal texto Wow).
- `tool-shared-word-check`, `tool-kba-random-question` — verificación batch con hash compare.
- `tool-whatsapp-cc` — cross-channel ack al teléfono real del whitelisted.
- `tool-sms-twilio` — fallback de cross-channel si Meta KYC tarda.
- `tool-web-push` — alerta al cuidador (VAPID).
- `tool-denuncia` — Denuncia Builder con cita regulatoria (Capa Sólido).

(V2 agrega `tool-twilio-call` para transfer/hangup en llamada en vivo.)

## Almacenamiento (Postgres + pgvector, Supabase)

- `wiki_legal_chunks`, `bcn_leyfacil_chunks`, `leyes_chunks`, `cmf_alertas`, `sernac_alertas`, `pdi_cibercrimen` (fuentes oficiales con TTL diario).
- `whitelists`, `shared_words` (hash bcrypt/argon2id), `kba_questions` (hash + velocity counter) — RLS por `caregiver_id`.
- `audio_uploads`, `call_sessions` (TTL 24h, transcript redactado, signed URL).

## Hitos de release

- `v0.1-mvp-audio` → 3 audios E2E con cascada completa + push al cuidador + PWA mínima.
- `v0.5-solid` → batch processing múltiples audios + cross-audio comparison + Denuncia Builder PDF + PWA full + endpoints ARCO+ + golden set ≥35 + multi-modelo en logs.
- `v1.0-demo-final` → Phishing Analyst (canal texto SMS/URL) + Vision pipeline (canal imagen screenshot) + Civic Intel page + WhatsApp webhook full bidireccional.
