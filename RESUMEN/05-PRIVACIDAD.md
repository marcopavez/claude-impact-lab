# 05 — Privacidad y compliance

> 🔄 **Pivote N20 (2026-05-06) Lean MVP/PoC:** el MVP **no persiste nada** — el audio entra por multipart, se procesa en memoria, se descarta tras devolver el verdict en el response JSON. **Sin Supabase, sin signed URLs, sin TTL, sin tablas.** Esto es la forma más fuerte de cumplimiento por diseño con Ley 21.719: cero PII en reposo. La capa de persistencia + ARCO+ + retención + DPO se activa en V2 con Supabase + RLS.

## Marco legal aplicable

| Norma | Estado | Qué nos exige | Cómo lo cumple el MVP Lean |
|---|---|---|---|
| **Ley 19.628** (datos personales) | Vigente hoy | Consentimiento, finalidad, ARCO. | Consentimiento checkbox al subir audio. ARCO trivial: no hay nada que acceder/rectificar/cancelar porque no se persiste. |
| **Ley 21.719** (nueva protección de datos) | **Vigencia 1-dic-2026** | ARCO+ (acceso, rectificación, cancelación, oposición, portabilidad), notificación de brechas <72h, DPO, base de licitud explícita. | Cero PII en reposo en MVP = cumplimiento por ausencia de almacenamiento. En V2 con DB se exponen endpoints `/api/export`, `/api/account DELETE`, retención por TTL, runbook de brechas, DPO formal. |
| **Ley 21.459** (delitos informáticos) | Vigente | Marco bajo el que clasificamos vishing/cuento del tío en respuestas regulatorias. | Citas validadas obligatorias por A6. |
| **Ley 21.663** (ciberseguridad / ANCI) | Vigente | Plazos CSIRT 3h / 72h / 15d para reporte de incidentes. Aplica si Vigía sufre brecha. | En MVP Lean la superficie de brecha es mínima (sin DB, sin tokens persistidos, sin auth). En V2 runbook formal. |
| **One-party-consent** (jurisprudencia chilena) | Vigente | Permite grabar si una parte consiente. | Checkbox obligatorio al subir audio + texto en onboarding PWA. La marca no se persiste; se valida por request. En V2 con telefonía: notificación en primer TTS para reforzar. |

## Principios de diseño

1. **Cero PII en reposo en MVP (N20).** Audio en memoria por request → ElevenLabs Scribe → cascada → descarte tras response. **Ni un byte de PII queda en disco.**
2. **Redacción determinista pre-modelo.** Regex chileno para RUT, móvil, IBAN, tarjetas (16 dígitos con Luhn), cuentas bancarias. Aplica antes del modelo y antes de logs aplicación.
3. **Hashing irreversible** de shared words y respuestas KBA en `apps/web/data/demo-config.json` commiteado al repo. Verificación por compare de hash, nunca por compare de plaintext.
4. **Sin RAG sobre contenido del usuario.** En MVP no hay RAG. En V2 cuando se introduzca pgvector: solo indexar fuentes oficiales (Wiki Legal Fintech, BCN, CMF, Sernac, PDI, Subtel). Elimina V5 (inyección indirecta) y exfiltración por embeddings.
5. **Sin profiling individual.** Métricas analíticas agregadas y anónimas (latencia, modelo, tools_used, verdict). Sin PII.
6. **Sin re-identificación** de PhishTank, URLhaus, CMF.

## Consentimiento legal

- **Llamante**: en MVP Lean, el cuidador asume responsabilidad de notificar al llamante (one-party-consent) y marca checkbox al subir el audio. La marca **no se persiste** — se valida por request. En V2 con telefonía: notificado por Vigía en el primer TTS — *"esta llamada está siendo analizada para protección"*. Antes de cualquier procesamiento sensible.
- **Persona protegida (María)**: en MVP no hay onboarding individualizado (config demo hardcoded). En V2: consentimiento informado en el onboarding del cuidador, registrado en la PWA.
- **Cuidador**: en MVP no hay cuentas — la PWA es demo público. En V2: ToS + privacy policy aceptados en alta, magic link auth (Supabase), sin password leaks.

## Retención y TTL

| Dato | MVP Lean (N20) | V2 (con DB) |
|---|---|---|
| Audio MP3/M4A/WAV | **No se persiste.** Buffer Node en memoria por request → descarte. | 24h con signed URL en Supabase Storage. Lifecycle policy automática. |
| Transcript redactado | **No se persiste.** En memoria por request → descarte. | 24h en `call_sessions` (solo metadata + transcript redactado). |
| Veredictos y metadata agregada | **No se persiste** (devuelto en response, cuidador conserva por copy/paste). | 90d para análisis Civic Intel (sin PII). |
| Whitelists / shared words / KBA | **Hasheados en `apps/web/data/demo-config.json` commiteado.** Hardcoded para María (config demo). | Hasheados en DB con RLS por `caregiver_id`. Cuidador puede rotar o borrar. |
| Logs aplicación | 7d, redactados con regex PII pre-log. Sin PII. | Igual. |

## Derechos ARCO+ (Ley 21.719)

**MVP Lean:** se cumplen trivialmente por ausencia de almacenamiento. No hay datos del cuidador o de la persona protegida que acceder, rectificar, cancelar, oponer o portar — porque no se guardan.

**V2 con persistencia:** la PWA expone endpoints:
- **Acceso**: descarga JSON con todo lo asociado a `protected_id`.
- **Rectificación**: edición inline de whitelist, shared words, KBA.
- **Cancelación / borrado**: hard-delete con cascade en 24h. Confirma vía email.
- **Oposición**: pausa de Vigía (deja de procesar llamadas) con un click.
- **Portabilidad**: export JSON + CSV estándar.

## Notificación de brechas

- **MVP Lean:** superficie mínima (sin DB, sin tokens persistidos, sin auth). El blast radius de un compromiso del runtime es solo los requests en vuelo, no datos en reposo.
- **V2:** runbook completo: detección → triage → notificación a CSIRT Nacional **<3h** + cuidadores afectados **<72h** (alineado Ley 21.663). DPO designado formalmente.

## Lo que NO hacemos

- **No persistimos audio, transcripts, veredictos, shared words, KBA — nada — en MVP.**
- **No persistimos shared words / KBA en plain en ningún contexto** (en MVP están hasheadas en `data/demo-config.json` commiteado; en V2 hasheadas en DB).
- **No revelamos al llamante** el resultado de su shared word (oracle attack) ni si la persona protegida está disponible.
- **No commiteamos secrets ni `.env`.** Solo `.env.example`. Las únicas keys necesarias en MVP son `ANTHROPIC_API_KEY` y `ELEVENLABS_API_KEY`.
- **No reusamos PII** entre requests. Cada request es stateless en MVP; en V2 RLS por `caregiver_id`.
- **No enviamos PII a Anthropic más allá de lo estrictamente necesario** para la inferencia. Redacción regex se aplica antes.

## Decisiones N1–N20 cerradas

Las 20 decisiones de seguridad/privacidad están cerradas y documentadas en `docs/SEGURIDAD.md §31` Bloques 1-7. Cualquier cambio exige actualizar ese documento + memoria + revisión por pares. Resumen no exhaustivo:

- **N20 (2026-05-06) Pivote Lean MVP/PoC.** "Algo funcional > arquitectónicamente correcto". Sin Twilio (Voice/SMS), sin Deepgram, sin DB (Supabase Postgres + pgvector + Storage), sin auth (magic link), sin Web Push persistido, sin WhatsApp Cloud, sin RAG vectorial Voyage. Servidor stateless, audio en memoria, fuentes en JSON estático, render en pantalla. Reformula N9/N10/N11/N13/N15. Reemplaza N17, N18.
- **N19 (2026-05-06) Pivote audio-first MVP.** Reformula N1/N5/N11/N13. Reemplaza N2 (Twilio Voice→sin telefonía MVP), N3/N7 (Deepgram→ElevenLabs Scribe), N8 (Polly→ElevenLabs TTS), N9 (call forwarding→audio upload PWA). Hace obsoleta N12. Traslada canal de N10 (consentimiento).
- Política B (secretaria) por defecto + per-contact configurable — en MVP aplicada sobre `data/demo-config.json` hardcoded.
- FP-permissive (ante duda, sospechoso).
- Consentimiento legal: checkbox al subir audio + onboarding PWA (V2: primer TTS); en MVP la marca no se persiste.
- Verdict (`fraud`/`suspicious`/`legit`) + severity (HIGH/MEDIUM/LOW) renderizado en pantalla. V2 telefonía: HIGH→hangup, MEDIUM→message, LOW→transfer.
- Multi-factor real para transfer (V2): caller_id + (shared word OR KBA) + cross-channel ack (AND, no OR). En MVP modo demostración: motor de detección + challenge plan recomendado al cuidador.
- Sin voice cloning detection (out of scope).
- STT ElevenLabs Scribe v1 batch (MVP) / Deepgram + whisper.cpp fallback (V2).
- Web Push + WhatsApp Cloud + SMS Twilio = V2.
