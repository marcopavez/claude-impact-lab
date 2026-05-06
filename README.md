# Vigía — detector de vishing con firewall de identidad

Protege a adultos mayores chilenos contra estafas telefónicas. **MVP audio-first (N19, 2026-05-06):** el cuidador o la persona protegida sube un audio sospechoso a la PWA installable; **Claude** lo analiza con una cascada agéntica (Triage → Identity Verifier → Regulatory Translator → Vishing Analyst Opus 4.7) y entrega verdict + citas regulatorias validadas + push al cuidador en ~30s. **Roadmap V2:** llamada en vivo con call forwarding GSM hacia DID Twilio Chile + Media Streams µ-law + decisión transfer/message/hangup en tiempo real.

**Track de competencia:** Línea 02 — Ciberseguridad Ciudadana, Claude Impact Lab Chile 2026.

---

## Stack (MVP audio-first)

| Capa | Elección |
|---|---|
| LLM motor único | Claude Sonnet 4.6 + Opus 4.7 + extended thinking + Haiku 4.5 |
| STT + TTS | ElevenLabs (`scribe_v1` + `eleven_multilingual_v2`) |
| Embeddings RAG | Voyage AI (`voyage-3`) |
| Frontend PWA | Next.js 16 + TypeScript + Tailwind v4 |
| Backend | Next.js API routes (serverless) |
| DB + Storage | Supabase (Postgres + pgvector + Auth magic link) |
| Hosting | Vercel |

100% cloud-native, sin componentes self-hosted en MVP. Stack completo del producto final + roadmap V2 (Twilio Voice + Media Streams + Deepgram + call forwarding GSM + Polly Lupe + whisper.cpp Fly.io fallback) en `docs/PLAN.md` Apéndice A y cuerpo principal.

## Estructura

```
.
├── apps/web/           PWA cuidador + endpoints API (Next.js 16)
│   ├── app/            App Router + route handlers /api/*
│   ├── lib/
│   │   ├── agents/     Cascada Claude (Triage, Verifier, Regulatory, Vishing)
│   │   ├── tools/      Tools del SDK (lookup CMF, Subtel, WhatsApp, Web Push, etc.)
│   │   ├── prompts/    System prompts canónicos por agente
│   │   ├── rag/        Embeddings + retrieval Wiki Legal Fintech (pgvector + Voyage)
│   │   ├── validators/ Citation validator + PII redactor regex chileno
│   │   └── clients/    Wrappers SDK (Anthropic, ElevenLabs Scribe + TTS, Supabase)
│   ├── public/         PWA manifest + iconos + 3 audios demo pre-grabados
│   └── data/           Snapshots regulatorios (CMF Prestadores Fintec, etc.)
├── apps/eval/          Golden set adversarial (≥35 casos JSONL por agente)
├── docs/               Planning canónico (PROYECTO, PLAN, SEGURIDAD)
├── docs/EVENT/         Bases, rúbrica y datasets oficiales del Lab (autoridad final)
└── RESUMEN/            Onboarding equipo en 10 minutos
```

## Cómo correr local

```bash
# 1. Configurar variables de entorno
cp .env.example apps/web/.env.local
# completar las keys (Anthropic, ElevenLabs, Voyage, Supabase)

# 2. Instalar dependencias
cd apps/web
npm install

# 3. Levantar dev server
npm run dev
```

App disponible en http://localhost:3000.

## Smoke test (verificar conexión Claude)

```bash
cd apps/web
node --env-file=.env.local --import tsx scripts/smoke-anthropic.ts
```

## Documentación

- `docs/PROYECTO.md` — concepto, ficha cívica, arquitectura, decisiones, privacidad
- `docs/PLAN.md` — capas Core/Sólido/Wow, fallbacks, sub-checks operativos, **Anexo B: plan operativo audio-first vigente** + Apéndice A: producto final ideal (V2)
- `docs/SEGURIDAD.md` — threat model V1-V22, Identity Firewall, prompts canónicos, golden set, **decisiones cerradas N1-N19** (incluye N19 audio-first)
- `docs/EVENT/` — bases, rúbrica y datasets oficiales del Lab (autoridad final)
- `RESUMEN/` — onboarding del equipo en 10 minutos
- `.claude/commands/ultraplan.md` — slash command que regenera el plan en vivo leyendo el repo

## Privacidad y datos

- **PII al mínimo y efímera.** Redacción determinista regex chileno (RUT, móvil, tarjeta, cuenta) antes del modelo, antes de logs, antes de embeddings.
- **Audios y transcripts TTL 24h** con signed URLs.
- **Diseñado para Ley 21.719** (vigencia 1-dic-2026): endpoints ARCO+ (`/api/export`, `/api/account DELETE`).
- **No indexamos contenido de usuario** en pgvector — solo fuentes oficiales (Wiki Legal Fintech, BCN, CMF, Sernac, CSIRT, PDI, Subtel).
- **Consentimiento legal explícito**: en MVP audio-first vía checkbox obligatorio al subir audio + texto en onboarding PWA. En V2 con telefonía: notificación en primer TTS (*"esta llamada está siendo analizada para protección"*).

Detalle completo en `docs/SEGURIDAD.md` Parte V.

## Licencia

MIT — ver [LICENSE](LICENSE).
