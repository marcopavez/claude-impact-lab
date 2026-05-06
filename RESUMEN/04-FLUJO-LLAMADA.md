# 04 — Flujo de un audio sospechoso (end-to-end · MVP audio-first)

> 🔄 **Pivote N19 (2026-05-06):** este flujo describe el procesamiento batch de un audio pre-grabado subido a la PWA — el MVP del Lab. La cascada agéntica (Triage → Verifier → Regulatory → Vishing) es idéntica al plan phone-first; lo que cambia es la **entrada (upload vs. WebSocket Twilio)** y la **decisión (verdict + push, sin acciones telefónicas en vivo)**. La versión live (call forwarding GSM + Twilio Programmable Voice + Media Streams µ-law + Deepgram streaming + Polly Lupe-Neural + transfer/hangup) está en roadmap V2 — ver §"Roadmap V2 phone-first vivo" al final + `docs/PLAN.md` cuerpo principal.

Ejemplo: **María (78, Ñuñoa) recibe llamada y la deriva al cuidador.** Caller dijo ser su nieta Sofía pero el número no estaba en la whitelist. Su hijo le pidió que le pase los audios de llamadas que le suenen raro. María graba con la app de teléfono y se lo manda por WhatsApp; el cuidador lo sube a Vigía.

## 0. Pre-condiciones

- El cuidador configuró Vigía: whitelist (Sofía con su número real, médico, hijo), shared word `quiltro feliz`, 3 KBA, WhatsApp del cuidador.
- María tiene la PWA installable en su celular pero no tiene que tocarla; sus audios los procesa el cuidador.
- En cada upload, el cuidador marca el checkbox de consentimiento legal (one-party-consent satisfecho).

## 1. Subida del audio (PWA)

```
Cuidador abre PWA → drag-and-drop audio (MP3/M4A/WAV ≤60s) en /dashboard/upload
  ↓
POST /api/audio/process  (multipart o signed URL Supabase Storage)
Body: { audio_file, caregiver_id, caller_id_metadata?, recorded_at, consent_checkbox: true }
```

El audio se guarda en Supabase Storage con TTL 24h y signed URL. Se inserta una fila en `audio_uploads` con verdict pendiente y se dispara el procesamiento.

## 2. Transcripción (ElevenLabs Scribe v1, ~5-15s)

```
audio_buffer → ElevenLabs Scribe v1 (modelo `scribe_v1`)
  ↓
{ text, language: "es", duration, speakers? }
```

Antes de tocar al modelo, **PII redactor regex chileno** (RUT + móvil + IBAN + tarjeta + dirección) sanitiza el transcript para logs y embeddings. El modelo Claude analiza siempre `<RUT_REDACTED>`, no el valor real.

## 3. Identity Firewall — Nivel 1 (lookup + intent)

- `caller_id_metadata` (si vino) → lookup en `whitelists`. **No matchea.**
- `suspicion_floor = HIGH`, `policy = take_message_only` (forzado).
- **Call Triage (Sonnet 4.6, p50 <2s sobre transcript)** clasifica intent → `claim_family`. Detecta presión emocional + claim sin caller_id válido. Canary anti-exfiltración aplicado.

## 4. Identity Firewall — Niveles 2–3 (modo batch)

En MVP audio-first la verificación es **detección + recomendación**, no ejecución en vivo:

- **Identity Verifier (Sonnet 4.6 sub-agent)** evalúa el transcript:
  - Detecta que el llamante reclama identidad pero **no menciona shared word** (porque está atacando, no es Sofía real).
  - Genera **"challenge plan recomendado"** para el cuidador: *"Si recibís otra llamada similar, exigí la palabra clave familiar antes de transferir y mandá WhatsApp al teléfono real registrado de Sofía: ¿estás llamando a tu abuela ahora?"*.
  - El plan se incluye en el push al cuidador para que actúe en futuras llamadas.

## 5. Decisión (verdict + push severity)

Vigía aplica: `caller_id_valid=false` AND `claim_family + pressure + unverified` → **verdict = `fraud`**, severity = **HIGH**.

> *"Caller_id +569XXXXXXXX reclamó ser Sofía. Patrón cuento del tío detectado. Recomendación: bloquear este número y verificar con Sofía vía WhatsApp si llamó."*

## 6. Análisis profundo (Vishing Analyst Opus 4.7 + extended thinking, ~10-20s)

**Vishing Analyst** corre con `tool_choice: required` y extended thinking 4-8k tokens (latencia aceptable post-Triage):

- Patrón detectado: `claim_family` + `pressure` + `unverified_caller_id` → cuento del tío 2.0.
- Tool calls (cada uno con `citations[]` minItems:1):
  - `mcp-wiki-legal` → Ley 21.459 art. 7° (fraude informático).
  - `mcp-wiki-legal` → alerta Sernac vigente sobre suplantación familiar.
  - `tool-phone-lookup` → operador del caller_id, listas reportadas Subtel.
- **Post-validator** verifica cada citation contra fuente fetcheada (substring NFKC + Levenshtein 0.95). Si falla → respuesta literal *"no encontré fuente"*. Nunca inventa.

## 7. Alerta al cuidador (push redundante por riesgo)

- **HIGH risk** → Web Push **+** WhatsApp Cloud API (siempre llega) **+** SMS Twilio si Meta KYC tarda.
- Payload visible al cuidador en la PWA:

> 📞 **Audio analizado para María — 14:23**
> Reclamó ser **Sofía (nieta)**. Caller_id no whitelisted.
> 🚨 **Veredicto: FRAUDE** — patrón cuento del tío.
> Citas: [Ley 21.459 art. 7°] · [Alerta Sernac 2025-XX]
> Audio 0:23 (signed URL, expira 24h)
> Plan recomendado: exigir shared word + WhatsApp ack al teléfono real de Sofía antes de transferir cualquier llamada futura.

## 8. Persistencia (TTL 24h)

- `call_sessions`: transcript redactado (regex RUT/tarjeta/cuenta), metadata, veredicto.
- `audio_uploads`: signed URL del audio, expira 24h.
- **Nada plain.** Shared words y KBA nunca tocan logs.

## 9. Camino feliz (Sofía real grabándose y validando vía WhatsApp)

- Cuidador sube audio donde Sofía dice *"hola abuela, soy yo, te llamo a las 14:30, recordá la palabra clave"*.
- Identity Verifier batch detecta `claim_family` + mención de shared word → genera recomendación: *"Sofía está llamando, podés transferir si confirma `quiltro feliz` y respondés WhatsApp"*.
- Verdict = `legit`, severity = LOW. Push tranquilo al cuidador.

## Latencias objetivo (MVP audio-first)

- **STT ElevenLabs Scribe** (audio 60s): 5-15s.
- **Triage post-STT p50:** <2s sobre transcript.
- **Identity Verifier batch:** <2s.
- **Regulatory Translator + Vishing Analyst (Opus 4.7 + extended thinking):** 10-20s.
- **Push al cuidador:** <5s tras decisión.
- **E2E (audio sube hasta push llega):** **<30s** (cumple sub-check J3.3 <30s).

---

## Roadmap V2 — phone-first vivo (cuando la telefonía esté lista)

Cuando se active la capa telefónica V2, el flujo cambia:

1. María tiene activo `**21*<DID Twilio>#` (desvío incondicional GSM).
2. Llamada → Twilio Programmable Voice → TwiML `<Connect><Stream/>` → WebSocket bidireccional µ-law 8kHz/20ms.
3. Notificación legal en **primer TTS Polly Lupe-Neural** con `<prosody rate="slow">`: *"esta llamada está siendo analizada para protección"*.
4. **Deepgram Nova-3 streaming** con interim transcripts <300ms (fallback whisper.cpp local Fly.io modelo `large-v3` MIT si "solo Claude" se interpreta literal).
5. Triage decide en p50 <2s **mientras la llamada sigue activa**.
6. Identity Verifier ejecuta `shared_word_check` + `kba_random_question` + `cross_channel_whatsapp_ack` en vivo.
7. Decisión telefónica:
   - Verdict `legit` + cross-channel ack → `tool-twilio-call: transfer` a María.
   - Verdict `suspicious` → toma mensaje + push al cuidador.
   - Verdict `fraud` HIGH → cuelga después del primer intento de presión.
8. Vishing Analyst corre post-call sobre la grabación completa (mismo flujo que MVP audio-first).

**Trade-offs V2:** KYC DID Chile 1-2 días, complejidad WebSocket bidireccional µ-law, fallback whisper.cpp Fly.io si Deepgram cae. Detalle completo en `docs/PLAN.md` cuerpo principal §1-6 y `docs/PROYECTO.md` §10-11.
