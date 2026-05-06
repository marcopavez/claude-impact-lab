# 04 — Flujo de una llamada (end-to-end)

Ejemplo: **María (78, Ñuñoa) recibe llamada. Caller dice ser su nieta Sofía pero no está en whitelist.**

## 0. Pre-condiciones

- La hija configuró Vigía: whitelist (Sofía con su número real, médico, hijo), shared word `quiltro feliz`, 3 KBA, WhatsApp del cuidador.
- En el celular de María está activo `**21*<DID Twilio>#` (desvío incondicional).
- María dejó de contestar; Vigía contesta por ella.

## 1. Llegada de la llamada (Twilio Programmable Voice)

```
Llamada → operador chileno → desvío al DID Twilio
  ↓
POST /voice/incoming  (Twilio webhook)
Respuesta: TwiML <Response><Connect><Stream url="wss://..."/></Connect></Response>
```

Twilio abre WebSocket bidireccional. Audio del llamante llega como µ-law 8kHz / 20ms frames; Vigía emite TTS por el mismo socket.

## 2. Notificación legal (primer TTS, ~3s)

Antes de cualquier procesamiento sensible, Vigía emite Polly Lupe-Neural con `<prosody rate="slow">`:

> *"Hola, soy Vigía, asistente anti-fraude de María. **Esta llamada está siendo analizada para protección.** ¿Cuál es el motivo de su llamada?"*

Cumple one-party-consent + notificación al llamante. Detalle `docs/SEGURIDAD.md`.

## 3. Identity Firewall — Nivel 1 (lookup + intent)

En paralelo con el TTS:
- `caller_id = normalize_e164(From)` → lookup en `whitelists`. **No matchea.**
- `suspicion_floor = HIGH`, `policy = take_message_only` (forzado).
- Llamante: *"Hola abuela, soy Sofía, tu nieta. Tuve un accidente y necesito que me transfieras..."*
- **Deepgram Nova-3 streaming** transcribe interim a <300ms.
- **Call Triage (Sonnet 4.6, p50 <2s)** clasifica intent → `claim_family`. Detecta presión emocional + claim sin caller_id válido.

## 4. Identity Firewall — Niveles 2–3 (verificación)

Vigía: *"Antes de pasar contigo, ¿cuál es la palabra clave familiar?"*

- Llamante evade: *"Ay no me acuerdo, pero es urgente, pásame con la abuela ya."*
- **Identity Verifier (Sonnet 4.6 sub-agent)** evalúa: shared_word_check → fail. KBA opcional → no se pide (presión + evasión ya bastan).
- Cross-channel: no procede sin caller_id válido.

## 5. Decisión (Nivel 4 — AND multi-factor)

Vigía aplica: `caller_id_valid=false` AND `shared_word=fail` AND `cross_channel=n/a` → **denegado**.

> *"María no puede atender ahora. Si quiere dejar un mensaje, soy Vigía y se lo entrego."*

Al primer intento adicional de presión, Vigía cuelga (HIGH risk).

## 6. Análisis post-call (paralelo, latencia 10–30s OK)

**Vishing Analyst (Opus 4.7 + extended thinking)** corre con `tool_choice: required`:
- Patrón detectado: `claim_family` + `pressure` + `unverified_caller_id` → cuento del tío 2.0.
- Tool calls (cada uno con `citations[]` minItems:1):
  - `mcp-wiki-legal` → Ley 21.459 art. 7° (fraude informático).
  - `mcp-wiki-legal` → alerta Sernac vigente sobre suplantación familiar.
  - `tool-phone-lookup` → operador del caller_id, listas reportadas.
- **Post-validator** verifica cada citation contra fuente fetcheada (substring + Levenshtein 0.95). Si falla → respuesta literal *"no encontré fuente"*.

## 7. Alerta al cuidador (push redundante por riesgo)

- **HIGH risk** → Web Push **+** WhatsApp Cloud API (siempre llega) **+** SMS Twilio si Meta KYC tarda.
- Payload visible al cuidador en la PWA:

> 📞 **Llamada para María — 14:23**
> Reclamó ser **Sofía (nieta)**. Caller_id no whitelisted.
> 🚨 **Veredicto: FRAUDE** — patrón cuento del tío.
> Citas: [Ley 21.459 art. 7°] · [Alerta Sernac 2025-XX]
> Audio 0:23 (signed URL, expira 24h)

## 8. Persistencia (TTL 24h)

- `call_sessions`: transcript redactado (regex RUT/tarjeta/cuenta), metadata, veredicto.
- `audio_storage`: signed URL del audio µ-law → MP3, expira 24h.
- **Nada plain.** Shared words y KBA nunca tocan logs.

## 9. Camino feliz (Sofía real llamando)

- Caller_id matchea entry con `policy: pass_after_verification`.
- Vigía pide shared word → Sofía dice *"quiltro feliz"* → hash match.
- En paralelo, Vigía manda WhatsApp al **número registrado de Sofía** (no al caller_id): *"¿Estás llamando a tu abuela?"*. Sofía responde *"sí"*.
- AND multi-factor cumplido → Vigía: *"Listo, te paso con María."*

## Latencias objetivo

- **Notificación legal TTS:** ~3s (no es crítica).
- **Triage en vivo p50:** <2s desde fin de frase del llamante.
- **Triage en vivo p95:** <3s.
- **Vishing Analyst post-call:** 10–30s (asíncrono, no bloquea decisión).
- **Push al cuidador:** <5s tras decisión.
