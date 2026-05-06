# Vigía — detector de vishing con firewall de identidad

Protege a adultos mayores chilenos contra estafas telefónicas. **MVP/PoC Lean (N20, 2026-05-06):** el cuidador o la persona protegida sube un audio sospechoso a la PWA installable; **Claude** lo analiza con una cascada agéntica (Triage → Identity Verifier → Regulatory Translator → Vishing Analyst Opus 4.7) y entrega verdict + citas regulatorias validadas + render en pantalla en ~30s. **El MVP es deliberadamente lean — sin Twilio, sin Deepgram, sin base de datos, sin auth.** Servidor stateless, audio en memoria, fuentes y config demo en JSON estático.

**Roadmap V2:** persistencia (Supabase), auth (magic link), notificaciones cross-channel (Web Push + WhatsApp + SMS), llamada en vivo con call forwarding GSM hacia DID Twilio Chile + Media Streams µ-law + decisión transfer/message/hangup en tiempo real.

**Track de competencia:** Línea 02 — Ciberseguridad Ciudadana, Claude Impact Lab Chile 2026.

---

## Filosofía del MVP/PoC

**"Algo funcional > algo arquitectónicamente correcto."** El motor de detección (cascada agéntica + citation validator + Vishing Analyst Opus 4.7) es el aporte central; la capa de persistencia, distribución multi-canal y autenticación se mueve a V2. Reduce blast radius del demo (sin DB que migrar, sin KYC, sin tokens), reduce superficie de bugs en pitch en vivo, y mantiene el músculo Claude visible (lo que mide M3).

## Stack (MVP/PoC Lean)

| Capa | Elección |
|---|---|
| LLM motor único | Claude Sonnet 4.6 + Opus 4.7 + extended thinking + Haiku 4.5 |
| STT + TTS | ElevenLabs (`scribe_v1` + `eleven_v3`) |
| Frontend PWA | Next.js 16 + TypeScript + Tailwind v4 + manifest installable |
| Backend | Next.js API route (Vercel serverless), **stateless** |
| Persistencia | **Ninguna en MVP.** Audio en memoria por request, descarte tras response. |
| Auth | **Sin auth en MVP.** PWA single-page demo público. |
| Fuentes regulatorias | **JSON estático** en `apps/web/data/sources/*.json` + fetch HTTP en caliente para post-validator |
| Identity Firewall | `apps/web/data/demo-config.json` hardcoded para María (whitelist + shared word + KBA) |
| Notificación | **Render en pantalla** + opcional `Notification` API in-page |
| Hosting | Vercel free tier |

**Eliminado del MVP** (queda en V2): Twilio Voice + SMS, Deepgram, Supabase (Postgres + pgvector + Auth + Storage), Voyage AI embeddings, RAG vectorial, Web Push (VAPID), WhatsApp Cloud API, Fly.io worker whisper.cpp.

Stack completo del producto final + roadmap V2 (Twilio + Media Streams + call forwarding GSM + Polly Lupe + Supabase + multi-canal push + RAG vectorial) en `docs/PLAN.md` cuerpo principal y Apéndice A.

## Estructura

```
.
├── apps/web/           PWA + endpoint API (Next.js 16)
│   ├── app/            App Router + route handler /api/audio/process
│   ├── lib/
│   │   ├── agents/     Cascada Claude (Triage, Verifier, Regulatory, Vishing, Notifier)
│   │   ├── tools/      Tools del SDK (citation-fetch, phone-lookup, phishtank, urlhaus,
│   │   │               shared-word-check, kba-random-question, denuncia-build)
│   │   ├── prompts/    System prompts canónicos por agente
│   │   ├── validators/ Citation validator + PII redactor regex chileno
│   │   └── clients/    Wrappers SDK (Anthropic, ElevenLabs Scribe + TTS)
│   ├── public/         PWA manifest + iconos + 3 audios demo pre-grabados
│   └── data/
│       ├── sources/    Snapshots regulatorios estáticos (Wiki Legal Fintech, BCN, CMF,
│       │               Sernac, CSIRT, PDI, Subtel) con quotes pre-extraídos
│       └── demo-config.json  Whitelist + shared word + KBA hardcoded para María
├── apps/eval/          Golden set adversarial (≥35 casos JSONL por agente)
├── docs/               Planning canónico (PROYECTO, PLAN, SEGURIDAD)
├── docs/EVENT/         Bases, rúbrica y datasets oficiales del Lab (autoridad final)
└── RESUMEN/            Onboarding equipo en 10 minutos
```

## Cómo correr local

```bash
# 1. Configurar variables de entorno (solo Anthropic + ElevenLabs)
cp .env.example apps/web/.env.local
# completar ANTHROPIC_API_KEY y ELEVENLABS_API_KEY

# 2. Instalar dependencias
cd apps/web
npm install

# 3. Levantar dev server
npm run dev
```

App disponible en http://localhost:3000. **No requiere DB, no requiere login.**

## Smoke test (verificar conexión Claude)

```bash
cd apps/web
node --env-file=.env.local --import tsx scripts/smoke-anthropic.ts
```

## Documentación

- `docs/PROYECTO.md` — concepto, ficha cívica, arquitectura, decisiones, privacidad
- `docs/PLAN.md` — capas Core/Sólido/Wow, fallbacks, sub-checks operativos, **Anexo C: plan operativo Lean MVP vigente (post-N20)** + Anexo B (audio-first con DB, histórico) + Apéndice A (producto final ideal V2)
- `docs/SEGURIDAD.md` — threat model V1-V22, Identity Firewall, prompts canónicos, golden set, **decisiones cerradas N1-N20** (incluye N20 Lean MVP)
- `docs/EVENT/` — bases, rúbrica y datasets oficiales del Lab (autoridad final)
- `RESUMEN/` — onboarding del equipo en 10 minutos
- `.claude/commands/ultraplan.md` — slash command que regenera el plan en vivo leyendo el repo

## Privacidad y datos

- **Cero PII en reposo en MVP.** El audio entra por multipart, se procesa en memoria, se descarta tras devolver el verdict. **Sin DB, sin signed URLs, sin TTL** — la forma más fuerte de cumplimiento por diseño.
- **PII redaction regex chileno** (RUT, móvil, IBAN, tarjeta, dirección) antes del modelo y antes de logs aplicación.
- **Diseñado para Ley 21.719** (vigencia 1-dic-2026): los derechos ARCO+ se cumplen trivialmente por ausencia de almacenamiento en MVP. En V2 se exponen endpoints `/api/export` y `/api/account DELETE`.
- **Sin RAG vectorial sobre contenido del usuario** — las fuentes regulatorias son snapshots oficiales conocidos (`apps/web/data/sources/*.json`), no contenido de usuario.
- **Consentimiento legal explícito**: checkbox obligatorio al subir audio + texto en onboarding PWA. La marca no se persiste; se valida por request. En V2 con telefonía: notificación en primer TTS.

Detalle completo en `docs/SEGURIDAD.md` Parte V.

## Licencia

MIT — ver [LICENSE](LICENSE).
