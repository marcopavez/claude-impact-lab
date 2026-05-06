# 04 — Flujo de un audio sospechoso (end-to-end · MVP Lean post-N20)

> 🔄 **Pivote N20 (2026-05-06):** este flujo describe el procesamiento batch de un audio pre-grabado subido a la PWA — el MVP/PoC del Lab — **sin Twilio, sin Deepgram, sin base de datos, sin auth**. La cascada agéntica (Triage → Verifier → Regulatory → Vishing → Notifier) es idéntica al plan phone-first; lo que cambia es la **entrada (upload vs. WebSocket Twilio)**, el **almacenamiento (cero — todo en memoria por request)**, la **verificación de identidad (config demo hardcoded vs. cuentas persistidas)** y la **salida (render en pantalla vs. push cross-channel)**. La versión live (call forwarding GSM + Twilio Programmable Voice + Media Streams µ-law + Deepgram streaming + Polly + transfer/hangup) + persistencia + auth + cross-channel push está en roadmap V2 — ver `docs/PLAN.md` cuerpo principal.

Ejemplo: **María (78, Ñuñoa) recibe llamada y la deriva al cuidador.** Caller dijo ser su nieta Sofía pero el número no estaba en la whitelist. Su hijo le pidió que le pase los audios de llamadas que le suenen raro. María graba con la app de teléfono y se lo manda por WhatsApp; el cuidador lo sube a Vigía.

## 0. Pre-condiciones

- En MVP Lean: el config de María (whitelist Sofía/Dr. Pizarro/BancoEstado, shared word `quiltro feliz`, 3 KBA) ya vive en `apps/web/data/demo-config.json` commiteado al repo. Sin onboarding por usuario, sin cuentas, sin login.
- María tiene la PWA installable en su celular pero no tiene que tocarla; sus audios los procesa el cuidador.
- En cada upload, el cuidador marca el checkbox de consentimiento legal (one-party-consent satisfecho, sin persistir).

## 1. Subida del audio (PWA)

```
Cuidador abre PWA → drag-and-drop audio (MP3/M4A/WAV ≤60s) en /
  ↓
POST /api/audio/process  (multipart, audio en memoria del Buffer Node)
Body: { audio_file, caller_id_metadata?, recorded_at, consent_checkbox: true }
```

**Sin Supabase Storage, sin signed URL, sin tabla `audio_uploads`.** El audio vive como `Buffer` en el handler durante el procesamiento, se descarta tras el response.

## 2. Transcripción (ElevenLabs Scribe v1, ~5-15s)

```
audio_buffer → ElevenLabs Scribe v1 (modelo `scribe_v1`)
  ↓
{ text, language: "es", duration, speakers? }
```

Antes de tocar al modelo, **PII redactor regex chileno** (RUT + móvil + IBAN + tarjeta + dirección) sanitiza el transcript para logs aplicación. El modelo Claude analiza siempre `<RUT_REDACTED>`, no el valor real.

## 3. Identity Firewall — Nivel 1 (lookup + intent)

- `caller_id_metadata` (si vino) → lookup en `apps/web/data/demo-config.json` (whitelist hardcoded). **No matchea.**
- `suspicion_floor = HIGH`, `policy = take_message_only` (forzado).
- **Call Triage (Sonnet 4.6, p50 <2s sobre transcript)** clasifica intent → `claim_family`. Detecta presión emocional + claim sin caller_id válido. Canary anti-exfiltración aplicado.

## 4. Identity Firewall — Niveles 2–3 (modo demostración)

En MVP Lean la verificación es **detección + recomendación**, no ejecución en vivo:

- **Identity Verifier (Sonnet 4.6 sub-agent)** evalúa el transcript contra config demo:
  - Detecta que el llamante reclama ser Sofía pero **no menciona shared word** (porque está atacando, no es Sofía real).
  - Compara hipótesis contra `apps/web/data/demo-config.json` (`shared_word_hash`, `kba[]`).
  - Genera **"challenge plan recomendado"** para el cuidador: *"Si recibís otra llamada similar, exigí la palabra clave familiar antes de transferir y mandá WhatsApp al teléfono real registrado de Sofía: ¿estás llamando a tu abuela ahora?"*.
  - El plan se incluye en el response JSON para renderizarse en la PWA.

## 5. Decisión (verdict + severity)

Vigía aplica: `caller_id_valid=false` AND `claim_family + pressure + unverified` → **verdict = `fraud`**, severity = **HIGH**.

> *"Caller_id +569XXXXXXXX reclamó ser Sofía. Patrón cuento del tío detectado. Recomendación: bloquear este número y verificar con Sofía vía WhatsApp si llamó."*

## 6. Análisis profundo (Vishing Analyst Opus 4.7 + extended thinking, ~10-20s)

**Vishing Analyst** corre con `tool_choice: required` y extended thinking 4-8k tokens (latencia aceptable post-Triage):

- Patrón detectado: `claim_family` + `pressure` + `unverified_caller_id` → cuento del tío 2.0.
- Tool calls (cada uno con `citations[]` minItems:1):
  - `tool-citation-fetch` → fetch `https://www.bcn.cl/leychile/...` para Ley 21.459 art. 7° (fraude informático).
  - `tool-citation-fetch` → fetch alerta Sernac vigente sobre suplantación familiar.
  - `tool-phone-lookup` → operador del caller_id, listas reportadas Subtel (snapshot JSON estático).
- **Post-validator** verifica cada citation contra fuente fetcheada en caliente (substring NFKC + Levenshtein 0.95). Si falla → respuesta literal *"no encontré fuente"*. Nunca inventa.

## 7. Render del verdict (en pantalla, sin push persistido)

El response JSON vuelve a la PWA y se renderiza:

> 📞 **Audio analizado para María — 14:23**
> Reclamó ser **Sofía (nieta)**. Caller_id no whitelisted.
> 🚨 **Veredicto: FRAUDE** — patrón cuento del tío.
> Citas: [Ley 21.459 art. 7°] · [Alerta Sernac 2025-XX]
> Audio playable (URL.createObjectURL del browser)
> Plan recomendado: exigir shared word + WhatsApp ack al teléfono real de Sofía antes de transferir cualquier llamada futura.
> Tools invocadas: `tool-citation-fetch (×2)`, `tool-phone-lookup`, `tool-shared-word-check`
> Modelos: Sonnet 4.6 (Triage, Verifier, Regulatory) + Opus 4.7 + extended thinking (Vishing) + Haiku 4.5 (Classifier)

Opcional: el cliente dispara `Notification` API in-page del browser ("Veredicto: FRAUDE") si el cuidador concedió permiso. **Sin Web Push persistido, sin WhatsApp Cloud, sin SMS Twilio en MVP.**

## 8. Persistencia (cero)

- **Audio:** `Buffer` Node en memoria por request → ElevenLabs Scribe → descarte tras response. Cliente conserva el archivo en memoria del browser (URL.createObjectURL) hasta que cierre la pestaña.
- **Transcript:** en memoria por request → cascada → descarte tras response. No toca disco.
- **Verdict + citations + tools_used:** se devuelven en el response JSON. Si el cuidador quiere conservarlos, copy/paste o screenshot — sin DB que persista.
- **Shared words y KBA:** **hasheadas en `apps/web/data/demo-config.json`** commiteado (mismo principio que con DB: nunca plain).

## 9. Camino feliz (Sofía real grabándose y validando)

- Cuidador sube audio donde Sofía dice *"hola abuela, soy yo, te llamo a las 14:30, recordá la palabra clave"*.
- Identity Verifier batch detecta `claim_family` + mención de shared word → genera recomendación: *"Sofía está llamando, podés transferir si confirma `quiltro feliz` y respondés WhatsApp"*.
- Verdict = `legit`, severity = LOW. Render verde tranquilo en pantalla.

## Latencias objetivo (MVP Lean)

- **STT ElevenLabs Scribe** (audio 60s): 5-15s.
- **Triage post-STT p50:** <2s sobre transcript.
- **Identity Verifier batch:** <2s.
- **Regulatory Translator + Vishing Analyst (Opus 4.7 + extended thinking):** 10-20s.
- **Render del verdict:** instantáneo (response JSON ya está en el cliente).
- **E2E (audio sube hasta render aparece):** **<30s** (cumple sub-check J3.3 <30s).

---

## Roadmap V2 — phone-first vivo + persistencia + cross-channel

Cuando se activen las capas V2 (Supabase + auth + Web Push + WhatsApp Cloud + SMS + telefonía), el flujo cambia:

1. María tiene activo `**21*<DID Twilio>#` (desvío incondicional GSM).
2. Llamada → Twilio Programmable Voice → TwiML `<Connect><Stream/>` → WebSocket bidireccional µ-law 8kHz/20ms.
3. Notificación legal en **primer TTS Polly Lupe-Neural** con `<prosody rate="slow">`: *"esta llamada está siendo analizada para protección"*.
4. **Deepgram Nova-3 streaming** con interim transcripts <300ms (fallback whisper.cpp local Fly.io).
5. Triage decide en p50 <2s **mientras la llamada sigue activa**.
6. Identity Verifier ejecuta `shared_word_check` + `kba_random_question` + `cross_channel_whatsapp_ack` en vivo, contra **whitelists persistidas en Supabase con RLS por `caregiver_id`**.
7. Decisión telefónica:
   - Verdict `legit` + cross-channel ack → `tool-twilio-call: transfer` a María.
   - Verdict `suspicious` → toma mensaje + push al cuidador (Web Push + WhatsApp + SMS fallback).
   - Verdict `fraud` HIGH → cuelga después del primer intento de presión.
8. Vishing Analyst corre post-call sobre la grabación completa, persiste verdict + transcript redactado con TTL 24h en `call_sessions`.
9. Cuidador entra a la PWA con magic link, ve el dashboard con últimas llamadas, exporta ARCO+ con `/api/export`.

**Trade-offs V2:** KYC DID Chile 1-2 días, KYC Meta WhatsApp Cloud, complejidad WebSocket bidireccional µ-law, persistencia + RLS, multi-cuidador, scaling de DB. Detalle completo en `docs/PLAN.md` cuerpo principal §1-6 y `docs/PROYECTO.md` §10-11.
