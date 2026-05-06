# Vigía — secretaria con firewall de identidad para llamadas

Protege a adultos mayores chilenos contra estafas telefónicas. Una llamada al celular protegido se desvía a un número Vigía, donde **Claude** analiza en tiempo real, autentica al llamante con un protocolo multi-factor (caller-ID + palabra clave familiar + KBA + verificación cruzada), y decide transferir, tomar mensaje o colgar — alertando al cuidador familiar por una PWA installable.

**Track de competencia:** Línea 02 — Ciberseguridad Ciudadana, Claude Impact Lab Chile 2026.

---

## Stack

| Capa | Elección |
|---|---|
| LLM motor único | Claude Sonnet 4.6 + Opus 4.7 + Haiku 4.5 |
| STT + TTS | ElevenLabs (`scribe_v1` + `eleven_multilingual_v2`) |
| Embeddings RAG | Voyage AI (`voyage-3`) |
| Frontend PWA | Next.js 16 + TypeScript + Tailwind |
| Backend | Next.js API routes (serverless) |
| DB + Storage | Supabase (Postgres + pgvector) |
| Hosting | Vercel |

100% cloud-native, sin componentes self-hosted en producción. Stack completo de visión productiva en `docs/PLAN.md` Apéndice A.

## Estructura

```
.
├── apps/web/           PWA cuidador (Next.js)
│   ├── app/            App Router + API routes
│   ├── lib/
│   │   ├── agents/     Cascada Claude (Triage, Verifier, Regulatory, Vishing)
│   │   ├── tools/      Tools del SDK (lookup CMF, Subtel, Wiki Legal)
│   │   ├── prompts/    System prompts canónicos por agente
│   │   ├── rag/        Embeddings + retrieval Wiki Legal Fintech
│   │   └── validators/ Citation validator + PII redactor
│   └── data/           Audios pre-grabados + snapshots regulatorios
├── docs/               Planning canónico (PROYECTO, PLAN, SEGURIDAD)
├── docs/EVENT/         Bases, rúbrica y datasets oficiales del Lab
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
- `docs/PLAN.md` — capas Core/Sólido/Wow, fallbacks, sub-checks operativos, **Apéndice A: producto final ideal**
- `docs/SEGURIDAD.md` — threat model V1-V22, Identity Firewall, prompts canónicos, golden set, decisiones cerradas N1-N18
- `docs/EVENT/` — bases, rúbrica y datasets oficiales del Lab (autoridad final)
- `RESUMEN/` — onboarding del equipo en 10 minutos

## Privacidad y datos

- **PII al mínimo y efímera.** Redacción determinista regex chileno (RUT, móvil, tarjeta, cuenta) antes del modelo, antes de logs, antes de embeddings.
- **Audios y transcripts TTL 24h** con signed URLs.
- **Diseñado para Ley 21.719** (vigencia 1-dic-2026): endpoints ARCO+ (`/api/export`, `/api/account DELETE`).
- **No indexamos contenido de usuario** en pgvector — solo fuentes oficiales (Wiki Legal Fintech, BCN, CMF, Sernac, CSIRT, PDI, Subtel).
- **Consentimiento legal de grabación** incorporado al primer TTS de Vigía: *"Esta llamada está siendo analizada para protección"*.

Detalle completo en `docs/SEGURIDAD.md` Parte V.

## Licencia

MIT — ver [LICENSE](LICENSE).
