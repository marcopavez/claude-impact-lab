# VigÃ­a â€” Vishing Detection for Older Adults

PWA that detects phone scam attempts targeting older adults in Chile. Upload a suspicious call recording (or capture live with the mic) and get a verdict, regulatory citations, a counter-script, and a pre-filled complaint form â€” in under 30 seconds.

> No database. No login. Audio processed in-memory and discarded after each request.

## How it works

```
Audio upload / mic capture
       â”‚
       â–¼
Early-exit firewall (caller_id blacklist/whitelist â€” no LLM needed if matched)
       â”‚
       â–¼
Groq Whisper Large v3 Turbo (transcription, ~1s)
       â”‚
       â–¼
Claude agent cascade:
  Call Triage â†’ Identity Verifier â†’ Vishing Analyst
                                  â†’ Regulatory Translator â€– Caregiver Notifier
       â”‚
       â–¼
Verdict + regulatory citations + counter-script + pre-filled complaint
```

## Stack

| Layer | Choice |
|---|---|
| LLM | Claude Sonnet 4.6 (triage, identity, vishing, regulatory) + Haiku 4.5 (notifier) |
| STT | Groq Â· Whisper Large v3 Turbo |
| Frontend | Next.js 16 + React 19 + TypeScript + Tailwind v4 (installable PWA) |
| Backend | Next.js API route â€” stateless, no DB |
| Hosting | Vercel free tier |

## Run locally

```bash
cp .env.example apps/web/.env.local
# Fill in: ANTHROPIC_API_KEY, GROQ_API_KEY
cd apps/web && npm install && npm run dev
```

App at `http://localhost:3000`. No DB, no login required.

## Key features

- Drag-drop or live mic recording (MP3 / M4A / WAV / WebM, â‰¤90s)
- Parallel agent cascade: Call Triage â†’ Identity Verifier â†’ Vishing Analyst â†’ Regulatory Translator â€– Caregiver Notifier
- PII redaction (Chilean RUT, mobile, IBAN, card, address) applied before the model and before logs
- Cite-or-silent: regulatory citations post-validated against official sources via substring + Levenshtein 0.95
- Personal blacklist stored in IndexedDB â€” never leaves the browser
- Accessibility for 65+: font-size toggle, Chilean Spanish prompts, Web Speech API verdict playback
- 5 pre-recorded demo audios (ElevenLabs es-CL): cuento del tÃ­o, official bank call, legitimate relative, shared-word oracle, happy-path grandchild

## Smoke tests

```bash
cd apps/web
npm run smoke:anthropic
node --env-file=.env.local --import tsx scripts/smoke-pii.ts
node --env-file=.env.local --import tsx scripts/smoke-citation.ts
node --env-file=.env.local --import tsx scripts/smoke-cascade.ts
node --env-file=.env.local --import tsx scripts/smoke-early-exit.ts
```

## Security & privacy

- Early-exit firewall: known callers skip transcription and Claude entirely
- Canary token per request guards against prompt injection in each agent
- PII redaction applied before the model and before application logs
- No RAG over user content â€” regulatory sources are static official snapshots
- Designed for Chilean Ley 21.719 (effective 1 Dec 2026): ARCO+ rights are trivially satisfied by the absence of storage

## Repository structure

```
apps/web/
â”œâ”€â”€ app/api/audio/process/  stateless pipeline: parse â†’ firewall â†’ Whisper â†’ PII â†’ cascade â†’ response
â”œâ”€â”€ components/             UploadForm, VerdictPanel, CascadeTrace, DenunciaCard, ContactsManager
â”œâ”€â”€ lib/agents/             Claude cascade (call-triage, identity-verifier, vishing-analyst, regulatory-translator, caregiver-notifier)
â”œâ”€â”€ lib/firewall/           Early-exit caller_id matcher
â”œâ”€â”€ lib/validators/         Citation (substring + Levenshtein) + PII regex
â”œâ”€â”€ data/demo-config.json   Demo whitelist/blacklist/institutional/shared-word/KBA
â””â”€â”€ data/sources/           Static regulatory snapshots (SERNAC, PDI, CSIRT)
apps/eval/golden-set/       Adversarial JSONL cases per agent
docs/                       PROYECTO, PLAN, SEGURIDAD (canonical docs)
```

## License

MIT
