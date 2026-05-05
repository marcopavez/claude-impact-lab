---
name: Proyecto Vigía — Claude Impact Lab 2026 Chile (phone-first)
description: Secretaria inteligente con firewall de identidad para llamadas; segmento único adultos mayores 65+; Línea 02 Ciberseguridad
type: project
originSessionId: 493db4f7-1f96-46cd-a840-5c35375738b5
---
**Vigía** es una **secretaria inteligente con firewall de identidad** para llamadas telefónicas, que protege a adultos mayores chilenos contra estafas. Funciona vía **call forwarding** desde el celular real de la persona protegida hacia un DID Twilio chileno; Claude analiza la llamada en tiempo real, autentica al llamante con un protocolo multi-factor (caller_id + shared word + KBA + cross-channel WhatsApp ack), y decide transferir / tomar mensaje / colgar. Alerta al cuidador familiar por una PWA installable. Track competencia: **Línea 02 — Ciberseguridad Ciudadana**. Cruza Línea 01 (citas regulatorias obligatorias) y Línea 03 (consentimiento legal en primer TTS, PII efímera, ARCO+ Ley 21.719).

**Why:** Las estafas telefónicas a adultos mayores son la categoría top de denuncia ciudadana ante Sernac/PDI Chile. Cuento del tío + Carabineros falso + bancos suplantados llegan por celular con presión emocional; la víctima detecta el fraude horas/días después, cuando ya transfirió. **Segmento único MVP: adultos mayores 65+ Chile = 2.4M (INE 2026).** Migrantes/microempresarios/jóvenes en roadmap V2.

**Pivote arquitectónico (sesión 2026-05-05):** el proyecto cambió de "asistente WhatsApp/web multi-modal genérico" a "secretaria con firewall de identidad para llamada en vivo". Texto/imagen pasan a canal secundario para el cuidador.

**How to apply:**
- **Arquitectura phone-first:**
  - Llamada → desvío incondicional GSM `**21*<DID>#` desde celular real → DID Twilio Chile.
  - Twilio Programmable Voice + Media Streams (WebSocket bidireccional µ-law 8kHz/20ms) → backend.
  - **Deepgram Nova-3 streaming** (default, vendor neutro) → transcripts <300ms interim. Fallback declarado: **whisper.cpp local en Fly.io con `large-v3` MIT** si "solo Claude" se interpreta literal estricto.
  - **Cascada de agentes:** Call Triage (Sonnet 4.6, p50 <2s, bias defensivo explícito) → Identity Verifier (sub-agente con shared_word_check + KBA + cross-channel WhatsApp) → Vishing Analyst (Opus 4.7 + extended thinking, post-call) → Regulatory Translator (Sonnet 4.6 + RAG, `tool_choice: required`) → Caregiver Notifier (Web Push + WhatsApp Cloud + SMS fallback) → Denuncia Builder (Sernac/PDI/CMF templates).
  - **TTS Twilio Polly Lupe-Neural** con `<prosody rate="slow">` para audiencia 65+.
  - **MCPs custom:** `mcp-wiki-legal` (RAG pgvector + voyage-3 sobre Wiki Legal Fintech + BCN Ley Fácil + textos BCN + alertas Sernac + boletines PDI) + `mcp-cmf` (Alertas + Registro Prestadores Fintec).
  - **Tools SDK:** phone-lookup (Subtel), phishtank, urlhaus, twilio-call-control, whatsapp-cross-channel, web-push, sms-twilio, denuncia-build.
- **Identity Firewall (`docs/IDENTITY-FIREWALL.md`):** deny-by-default, 4 niveles (pre-config cuidador / caller_id+intent / verificación per claim / política transfer AND multi-factor). Política B (secretaria) por defecto + per-contact configurable: `take_message_only` (default) / `pass_after_verification` / `always_pass` (con warning UI). Caller-ID es necesario pero NO suficiente — V22 spoofing trivial en Chile.
- **PWA Cuidador (`docs/CAREGIVER-PWA.md`):** Next.js 15 + React 19 + Tailwind + shadcn + Supabase Auth magic link + Web Push API + manifest installable. 4 pantallas (Onboarding 5 pasos, Dashboard, Configuración, Live SSE). Skill `frontend-design` aplicada para identidad visual. NO app nativa Android/iOS — roadmap V2.
- **Persona protegida (la abuela) NO instala nada.** Solo activa desvío con código GSM. Cuidador familiar (35-55) hace setup en 5 min y recibe alertas.
- **Threat model (`docs/THREAT-MODEL.md`):** 22 vectores catalogados (V1-V22), 6 capas defensa en profundidad, citation validator determinista (substring + Levenshtein 0.95) post-generación. Decisiones cerradas N1-N18 documentadas en §9. Consentimiento legal one-party-consent vía notificación en primer TTS.
- **Set golden adversarial ≥35 inputs phone-first.** Bloques de seguridad (V21 suplantación social, V22 caller-ID spoof, V17 inyección audio, V19 anti-STT) deben pasar 100% en CI.
- **Stack:** TypeScript + `@anthropic-ai/sdk`, Voyage AI `voyage-3`, Supabase pgvector + Auth + Storage, Vercel, Fly.io worker (whisper.cpp si activamos), Twilio Voice + Media Streams + Polly, Deepgram, WhatsApp Cloud API.
- **Ventana de build:** `2026-05-06 00:00` → `2026-05-07 23:59` hora Chile. Restricción técnica del repo (timestamps + B3). Logística de submits la maneja Marco aparte.
- **Documentos canónicos:** `CLAUDE.md` (operacional), `docs/EVENT/{BASES,RUBRICA,DATOS,PROBLEMA}.md` (texto literal evento — autoridad), `docs/IDEA.md` (concepto + arquitectura phone-first), `docs/FICHA-CIVICA.md` (formulario oficial), `docs/MVP-JUEVES.md` (capas Core=B/Sólido=A/Wow=texto), `docs/PLAN-48H.md` (tracks técnicos), `docs/SUB-CHECKS.md` (rúbrica operativa), `docs/PROMPTS.md` (system prompts con bias defensivo), `docs/THREAT-MODEL.md` (seguridad + decisiones cerradas), `docs/IDENTITY-FIREWALL.md` (autenticación llamante), `docs/CAREGIVER-PWA.md` (specs PWA cuidador).
- **Identidad del proyecto:** nombre "Vigía", iterable.
