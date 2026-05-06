# 05 — Privacidad y compliance

## Marco legal aplicable

| Norma | Estado | Qué nos exige |
|---|---|---|
| **Ley 19.628** (datos personales) | Vigente hoy | Consentimiento, finalidad, ARCO. |
| **Ley 21.719** (nueva protección de datos) | **Vigencia 1-dic-2026** | ARCO+ (acceso, rectificación, cancelación, oposición, portabilidad), notificación de brechas <72h, DPO, base de licitud explícita. **Diseñamos para esta ley desde día 1.** |
| **Ley 21.459** (delitos informáticos) | Vigente | Marco bajo el que clasificamos vishing/cuento del tío en respuestas regulatorias. |
| **Ley 21.663** (ciberseguridad / ANCI) | Vigente | Plazos CSIRT 3h / 72h / 15d para reporte de incidentes. Aplica si Vigía sufre brecha. |
| **One-party-consent** (jurisprudencia chilena) | Vigente | Permite grabar si una parte consiente. En MVP audio-first: el cuidador marca checkbox de consentimiento al subir el audio + texto en onboarding PWA. En V2 con telefonía: notificación en primer TTS para reforzar. |

## Principios de diseño

1. **Cero persistencia de PII por defecto.** Audios y transcripts viven 24h con TTL + signed URLs.
2. **Redacción determinista pre-modelo.** Regex chileno para RUT, tarjetas (16 dígitos con Luhn), cuentas bancarias, IBAN. Aplica antes del modelo, antes de logs y antes de embeddings.
3. **Hashing irreversible** de shared words y respuestas KBA (bcrypt o argon2id) en reposo. Verificación por compare de hash, nunca por compare de plaintext.
4. **No indexamos contenido del usuario** en pgvector. Solo fuentes oficiales (Wiki Legal Fintech, BCN, CMF, Sernac, PDI, Subtel). Elimina V5 (inyección indirecta) y exfiltración por embeddings.
5. **Sin profiling individual.** Métricas analíticas agregadas y anónimas.
6. **Sin re-identificación** de PhishTank, URLhaus, CMF.

## Consentimiento legal

- **Llamante**: en MVP audio-first, el cuidador asume responsabilidad de notificar al llamante (one-party-consent) y marca checkbox al subir el audio. En V2 con telefonía: notificado por Vigía en el primer TTS — *"esta llamada está siendo analizada para protección"*. Antes de cualquier procesamiento sensible.
- **Persona protegida (María)**: consentimiento informado en el onboarding del cuidador, registrado en la PWA.
- **Cuidador**: ToS + privacy policy aceptados en alta. Magic link auth (Supabase) → no password leaks.

## Retención y TTL

| Dato | Retención | Notas |
|---|---|---|
| Audio µ-law / MP3 | **24h** | Signed URL en Supabase Storage. Lifecycle policy automática. |
| Transcript redactado | **24h** | Solo metadata (intent, veredicto, citations) sobrevive en `call_sessions`. |
| Veredictos y metadata agregada | 90d | Para análisis Civic Intel (sin PII). |
| Whitelists / shared words / KBA | Mientras la cuenta exista | Hasheados. Cuidador puede rotar o borrar. |
| Logs aplicación | 7d | Redactados; nunca contienen PII. |

## Derechos ARCO+ (Ley 21.719)

La PWA del cuidador expone endpoints:
- **Acceso**: descarga JSON con todo lo asociado a `protected_id`.
- **Rectificación**: edición inline de whitelist, shared words, KBA.
- **Cancelación / borrado**: hard-delete con cascade en 24h. Confirma vía email.
- **Oposición**: pausa de Vigía (deja de procesar llamadas) con un click.
- **Portabilidad**: export JSON + CSV estándar.

## Notificación de brechas

- Runbook: detección → triage → notificación a CSIRT Nacional **<3h** + cuidadores afectados **<72h** (alineado Ley 21.663).
- DPO designado nominalmente desde día 1 (Marco como provisional MVP, formalización en V1).

## Lo que NO hacemos

- **No persistimos transcripts plain.** Ni en DB, ni en logs, ni en colas.
- **No persistimos shared words / KBA en plain.** Solo hash.
- **No revelamos al llamante** el resultado de su shared word (oracle attack) ni si la persona protegida está disponible.
- **No commiteamos secrets ni `.env`.** Solo `.env.example`.
- **No reusamos PII** entre `caregiver_id` distintos. RLS de Supabase aplicado a todas las tablas sensibles.
- **No enviamos PII a Anthropic más allá de lo estrictamente necesario** para la inferencia. Redacción regex se aplica antes.

## Decisiones N1–N19 cerradas

Las 19 decisiones de seguridad/privacidad están cerradas y documentadas en `docs/SEGURIDAD.md §31` Bloques 1-6. Cualquier cambio exige actualizar ese documento + memoria + revisión por pares. Resumen no exhaustivo:

- **N19 (2026-05-06) Pivote audio-first MVP.** Reformula N1/N5/N11/N13. Reemplaza N2 (Twilio Voice→sin telefonía MVP), N3/N7 (Deepgram→ElevenLabs Scribe), N8 (Polly→ElevenLabs TTS), N9 (call forwarding→audio upload PWA). Hace obsoleta N12. Traslada canal de N10 (consentimiento).
- Política B (secretaria) por defecto + per-contact configurable.
- FP-permissive (ante duda, sospechoso).
- Consentimiento legal: checkbox al subir audio + onboarding PWA (V2: primer TTS).
- Verdict (`fraud`/`suspicious`/`legit`) + push severity (HIGH/MEDIUM/LOW). V2 telefonía: HIGH→hangup, MEDIUM→message, LOW→transfer.
- Multi-factor real para transfer (V2): caller_id + (shared word OR KBA) + cross-channel ack (AND, no OR). En MVP modo batch: motor de detección + challenge plan recomendado al cuidador.
- Sin voice cloning detection (out of scope).
- STT ElevenLabs Scribe v1 batch (MVP) / Deepgram + whisper.cpp fallback (V2).
- WhatsApp Cloud API redundante para alertas críticas + SMS Twilio fallback.
