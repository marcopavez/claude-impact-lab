# Vigía — detector de vishing con firewall de identidad

Protege a adultos mayores chilenos contra estafas telefónicas. **MVP/PoC Lean (N20, 2026-05-06):** el cuidador o la persona protegida sube una grabación sospechosa (o la captura en vivo con el micrófono) en una PWA installable; **Claude** la analiza con una cascada agéntica completa (Call Triage → Identity Verifier → Vishing Analyst → Regulatory Translator ∥ Caregiver Notifier) y entrega verdict + citas regulatorias validadas + plan de acción + denuncia pre-rellenada **renderizado en pantalla en menos de 30 segundos**. Servidor stateless, audio en memoria, fuentes y config demo en JSON estático.

**Roadmap V2:** persistencia (Supabase), auth (magic link), notificaciones cross-channel (Web Push + WhatsApp + SMS), llamada en vivo con call forwarding GSM hacia DID Twilio Chile + Media Streams µ-law + decisión transfer/message/hangup en tiempo real.

**Track de competencia:** Línea 02 — Ciberseguridad Ciudadana, Claude Impact Lab Chile 2026.

---

## Filosofía del MVP/PoC

**"Algo funcional > algo arquitectónicamente correcto."** El motor de detección (cascada agéntica + citation validator + firewall de identidad + post-call accionable) es el aporte central; persistencia, distribución multi-canal y autenticación se posponen a V2. Reduce el blast radius del demo (sin DB que migrar, sin KYC, sin tokens), reduce la superficie de bugs en el pitch en vivo, y mantiene el músculo Claude visible (lo que mide M3 — 35% del peso mentor).

## Stack (MVP/PoC vigente)

| Capa | Elección |
|---|---|
| LLM motor único | Claude Sonnet 4.6 (Triage, Identity, Vishing + adaptive thinking, Regulatory) + Claude Haiku 4.5 (Notifier) |
| STT | **Groq · Whisper Large v3 Turbo** (~<1s típico, decisión N21 — reemplaza ElevenLabs Scribe) |
| TTS | ElevenLabs `eleven_v3` (solo para regenerar los audios demo, no en runtime) |
| Frontend PWA | Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + manifest installable |
| Backend | Next.js API route handler (`/api/audio/process`) sobre Vercel serverless, **stateless** |
| Persistencia (servidor) | **Ninguna en MVP.** Audio en memoria por request, descartado tras response. |
| Persistencia (cliente) | IndexedDB local para la blacklist personal del usuario (no sale del browser) |
| Auth | **Sin auth en MVP.** PWA single-page demo público |
| Fuentes regulatorias | JSON estático en `apps/web/data/sources/*.json` + fetch HTTP en caliente para el citation validator post-generación (substring + Levenshtein 0.95) |
| Identity Firewall | `apps/web/data/demo-config.json` (whitelist + blacklist + registro institucional + shared word + KBA) hardcoded para la persona protegida del demo |
| Notificación | Render en pantalla con severidad (HIGH/MEDIUM/LOW), headline, primera acción, secondary actions, regulatory note, counter-script y push opcional vía `Notification` API in-page |
| Hosting | Vercel free tier |

**Eliminado del MVP** (queda en V2): Twilio Voice + SMS, Deepgram, Supabase (Postgres + pgvector + Auth + Storage), Voyage AI embeddings, RAG vectorial, Web Push (VAPID), WhatsApp Cloud API, Fly.io worker whisper.cpp.

Stack completo del producto final + roadmap V2 (Twilio + Media Streams + call forwarding GSM + Supabase + multi-canal push + RAG vectorial) en `docs/PLAN.md` cuerpo principal y Apéndice A.

## Features funcionales (versión actual)

- **Subida o grabación en vivo** del audio sospechoso desde la PWA (drag-drop, MP3 / M4A / WAV / WebM o captura con micrófono, ≤90s).
- **Early-exit firewall** sobre el `caller_id`: blacklist > whitelist > registro institucional. Si hay match conocido, la respuesta se construye determinísticamente **sin transcribir ni invocar a Claude** (ahorra créditos Groq + Anthropic, defendible al jurado como capa de defensa previa).
- **Cascada agéntica con paralelización selectiva:** Triage → (Identity si delega) → (Vishing si aplica) → Regulatory ∥ Notifier en paralelo + post-merge determinista del `regulatory_note`.
- **Cite-or-silent (sub-check A6):** `tool_choice: required` + schema `citations[] minItems:1` + post-validator (substring + Levenshtein 0.95 sobre fuente oficial fetcheada). Si no hay cita válida, se emite literal `"no encontré fuente para esta consulta"`.
- **PII redaction regex chileno** (RUT, móvil, IBAN, tarjeta, dirección, cuenta) antes del modelo, antes de logs.
- **Canary token** único por request anti-prompt-injection en cada eslabón; bias defensivo explícito en system prompts.
- **Post-call accionable:** counter-script para el próximo llamado, denuncia pre-rellenada (Sernac / PDI Cibercrimen / CSIRT Nacional con ley principal: 21.459 / 21.521 según patrón), redirect a cuidador humano cuando la verificación queda ambigua, y blacklist personal del usuario en IndexedDB (sin tocar el servidor).
- **Trazabilidad de la cascada visible en la UI:** badge "Powered by Claude", tile por eslabón con modelo, tools invocadas, latencia y status (ok / fallback). Sustenta el sub-check J3.4 (Claude evidente).
- **Accesibilidad +65:** font-size toggle persistente, voseo argentino → tú chileno en todos los prompts, reproductor de veredicto vía Web Speech API, contraste y tipografía auditados, focus visible.
- **`tools.json` canónico** generado por script (`npm run tools:export`) para auditoría externa del catálogo de tools del SDK.
- **5 audios demo** pre-grabados con ElevenLabs (`eleven_v3`, voz es-CL): cuento del tío, banco oficial, familiar legítimo, oracle de shared word, nieto happy-path.

## Estructura

```
.
├── apps/web/                          PWA + endpoint API (Next.js 16)
│   ├── app/
│   │   ├── page.tsx                   Landing + UploadForm + ContactsManager
│   │   ├── manifest.ts                Web App Manifest (installable)
│   │   └── api/
│   │       ├── audio/process/         Pipeline stateless: parse → firewall →
│   │       │                          Whisper → PII → cascada → response
│   │       └── mocks/                 Endpoints mock para sync de feeds
│   │                                  (institutional registry, phonebook, threat feeds)
│   ├── components/                    UploadForm (drag-drop + mic en vivo),
│   │                                  VerdictPanel, CascadeTrace, EarlyExitBanner,
│   │                                  ContactsManager, DenunciaCard,
│   │                                  CaregiverRedirectCard, CounterScriptCard,
│   │                                  PersonalBlacklistButton, FontSizeToggle, etc.
│   ├── lib/
│   │   ├── agents/                    Cascada Claude (call-triage, identity-verifier,
│   │   │                              vishing-analyst, regulatory-translator,
│   │   │                              caregiver-notifier)
│   │   ├── firewall/early-exit.ts     Match determinista caller_id → blacklist/whitelist
│   │   ├── denuncia/build-denuncia.ts Builder determinista de la denuncia (sin LLM)
│   │   ├── storage/personal-blacklist.ts IndexedDB local (client-only)
│   │   ├── validators/                citation (substring + Levenshtein 0.95) + pii
│   │   │                              (regex chileno: RUT, móvil, IBAN, tarjeta…)
│   │   ├── clients/                   groq.ts (STT Whisper Large v3 Turbo),
│   │   │                              elevenlabs.ts (TTS demo), source-fetcher.ts
│   │   └── api/                       Tipos + mock del response del endpoint
│   ├── public/
│   │   ├── demo-audios/               5 audios demo pre-grabados
│   │   └── tools.json                 Catálogo canónico de tools (auditoría)
│   ├── data/
│   │   ├── demo-config.json           Whitelist + blacklist + institutional + shared word + KBA
│   │   ├── snapshots/                 Snapshots regulatorios estáticos
│   │   └── audios/                    (gitkeep — audios input no se persisten)
│   └── scripts/                       smoke-anthropic, smoke-citation, smoke-pii,
│                                      smoke-regulatory, smoke-cascade, smoke-early-exit,
│                                      render-scams, export-tools
├── apps/eval/golden-set/              Casos adversariales JSONL por agente
├── docs/                              PROYECTO, PLAN, SEGURIDAD (canónicos)
├── docs/EVENT/                        Bases, rúbrica y datasets oficiales del Lab
├── RESUMEN/                           Onboarding del equipo en 10 min (00-INDEX al 07-RUBRICA)
└── tools.json                         Catálogo canónico de tools (raíz, espejo del público)
```

## Cómo correr local

```bash
# 1. Configurar variables de entorno
cp .env.example apps/web/.env.local
# completar:
#   ANTHROPIC_API_KEY  → cascada Claude
#   GROQ_API_KEY       → STT Whisper Large v3 Turbo
#   ELEVENLABS_API_KEY → solo si vas a regenerar los audios demo

# 2. Instalar dependencias
cd apps/web
npm install

# 3. Levantar dev server
npm run dev
```

App disponible en http://localhost:3000. **No requiere DB, no requiere login.**

## Smoke tests

```bash
cd apps/web

# Verificar conexión Anthropic
npm run smoke:anthropic

# Validadores y eslabones individuales
node --env-file=.env.local --import tsx scripts/smoke-pii.ts
node --env-file=.env.local --import tsx scripts/smoke-citation.ts
node --env-file=.env.local --import tsx scripts/smoke-regulatory.ts
node --env-file=.env.local --import tsx scripts/smoke-cascade.ts
node --env-file=.env.local --import tsx scripts/smoke-early-exit.ts

# Regenerar el catálogo canónico de tools (fuente: lib/agents/*.ts)
npm run tools:export

# Regenerar los audios demo con ElevenLabs (opcional)
npm run render:scams
```

## Documentación

- `docs/PROYECTO.md` — concepto, ficha cívica, arquitectura, decisiones, privacidad
- `docs/PLAN.md` — capas Core/Sólido/Wow, fallbacks, sub-checks operativos, **Anexo C: plan operativo Lean MVP vigente** + Anexo B (audio-first con DB, histórico) + Apéndice A (producto final V2)
- `docs/SEGURIDAD.md` — threat model V1-V22, Identity Firewall, prompts canónicos, golden set, **decisiones cerradas N1-N21** (incluye N20 Lean MVP y N21 Groq Whisper)
- `docs/EVENT/` — bases, rúbrica y datasets oficiales del Lab (autoridad final)
- `RESUMEN/` — onboarding del equipo en 10 minutos
- `.claude/commands/ultraplan.md` — slash command que regenera el plan en vivo leyendo el repo

## Privacidad y datos

- **Cero PII en reposo en MVP.** El audio entra por multipart, se procesa en memoria, se descarta tras devolver el verdict. Sin DB, sin signed URLs, sin TTL — la forma más fuerte de cumplimiento por diseño.
- **Early-exit del firewall ahorra incluso la transcripción** cuando el `caller_id` matchea blacklist o whitelist conocida: ni Groq Whisper ni Anthropic ven el audio.
- **PII redaction regex chileno** antes del modelo y antes de logs aplicación (RUT, móvil, IBAN, tarjeta, dirección, cuenta).
- **Diseñado para Ley 21.719** (vigencia 1-dic-2026): los derechos ARCO+ se cumplen trivialmente por ausencia de almacenamiento. En V2 se exponen `/api/export` y `/api/account DELETE`.
- **Sin RAG vectorial sobre contenido del usuario** — las fuentes regulatorias son snapshots oficiales conocidos, no contenido de usuario.
- **Blacklist personal en IndexedDB local del browser** — no sale del cliente, no se sincroniza a un servidor.
- **Consentimiento legal explícito**: checkbox obligatorio al subir audio + texto en onboarding PWA. La marca no se persiste; se valida por request. En V2 con telefonía: notificación en el primer TTS de Vigía.

Detalle completo en `docs/SEGURIDAD.md` Parte V.

## Licencia

MIT — ver [LICENSE](LICENSE).
