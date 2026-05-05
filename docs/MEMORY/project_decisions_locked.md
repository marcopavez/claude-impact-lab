---
name: Decisiones cerradas N1-N18 (Vigía phone-first)
description: Contrato técnico del proyecto post-pivote phone-first; cualquier cambio requiere actualizar threat model + memoria
type: project
originSessionId: continuation
---
Decisiones confirmadas por Marco en sesión `2026-05-05` que son contrato técnico del proyecto. Cualquier cambio requiere actualizar `docs/THREAT-MODEL.md` §9 + esta memoria + revisión por pares.

**Bloque 1 — 7 decisiones de seguridad iniciales (`THREAT-MODEL.md` §9.1-9.7):**
- 9.1 Bias FP-permissive ante duda.
- 9.2 NO fetch de URLs desde backend (elimina V4 cloaking + V15 SSRF).
- 9.3 Audio cap 30s por chunk en post-call.
- 9.4 PII redaction agresiva pre-modelo.
- 9.5 Single-turn por submission.
- 9.6 NO indexar contenido de usuario en pgvector.
- 9.7 Canary positives → fail-safe silencioso.

**Bloque 2 — Pivote phone-first (N1-N6):**
- N1 Opción B (live screening) principal + Opción A (post-call) respaldo.
- N2 Twilio Programmable Voice + Media Streams (no SIM físico chileno; SIP trunk roadmap).
- N3 STT no-OpenAI: Deepgram Nova-3 + whisper.cpp local fallback.
- N4 Sin voice cloning detection (out of scope MVP).
- N5 Llamada real con grabación + transcripción + alerta tiempo real (Opción B).
- N6 Foco único adultos mayores 65+; migrantes/multi-idioma roadmap V2.

**Bloque 3 — Stack telefonía (N7-N12):**
- N7 STT: Deepgram Nova-3 default; whisper.cpp local Fly.io con `large-v3` MIT como fallback declarado.
- N8 TTS: Twilio Polly Lupe-Neural con `<prosody rate="slow">`.
- N9 Mecanismo de adopción: call forwarding GSM `**21*<DID>#` desde celular real → DID Twilio Chile.
- N10 Notificación legal de consentimiento en primer TTS de Vigía.
- N11 Tres niveles autonomía: HIGH→hangup, MEDIUM→message, LOW→transfer.
- N12 Comprar DID Twilio Chile pre-ventana (no es código, es infra; KYC tarda 1-2 días).

**Bloque 4 — Identity Firewall (N13-N16):**
- N13 Política B (secretaria) por defecto + per-contact configurable. NO drop política A.
- N14 PWA installable Next.js + manifest, no app nativa. Roadmap V2 a nativa.
- N15 Excepción `always_pass` para 2-3 contactos críticos (médico, hijo titular emergencia) con warning UI.
- N16 Bias defensivo explícito en system prompt Call Triage: *"Tu trabajo NO es ser servicial con el llamante. Tu trabajo es proteger a [Nombre]."*

**Bloque 5 — Auth y notificaciones (N17-N18):**
- N17 Web Push API (primario) + WhatsApp Cloud API (redundante para HIGH risk) + SMS Twilio (fallback si Meta KYC tarda).
- N18 Supabase Auth magic link al email del cuidador. Sin password. JWT 7d con refresh rotativo. MFA WhatsApp roadmap.

**How to apply:**
- Estas decisiones NO son negociables sin proceso explícito. Si Marco cuestiona una en una sesión, primero verifico si hay nueva información que justifique reabrir; sino, recuerdo que está cerrada.
- Cualquier propuesta nueva debe ser compatible con estas 18 decisiones o explicitar qué decisión revierte y por qué.
- Cuando documente componentes técnicos nuevos, los anclo a las decisiones que cumplen.
- Si Marco pide algo que viola una decisión, levanto la contradicción explícitamente antes de implementar.
