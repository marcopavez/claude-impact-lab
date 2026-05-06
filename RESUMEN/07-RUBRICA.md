# 07 — Defensa frente a la rúbrica v3.3

Score final = **40% mentor + 60% juez**. Texto literal en `docs/EVENT/RUBRICA.md`. Tabla operativa con evidencia exigida + owner + artefacto en `docs/PLAN.md`.

## Mentor (10 sub-checks)

| Dim | Peso | Sub-check | Cómo lo cumplimos |
|---|---|---|---|
| **M1 Problema y ciudadano** | 20% | A1 sin jerga · A2 segmento · A3 canal · A4 impacto | Adultos mayores 65+ Chile (2.4M, INE 2026). **Canal MVP: PWA installable + audio upload.** Impacto: tiempo de detección 72h → ~30s (MVP audio-first). V2 con telefonía: tiempo real durante la llamada. |
| **M2 Datos responsables** | 20% | A5 ≥2 fuentes · A6 sin alucinaciones | ≥7 fuentes oficiales (Wiki Legal Fintech, BCN Ley Fácil, CMF, Sernac, CSIRT, PDI, Subtel) + `tool_choice: required` + schema `citations[]` minItems:1 + post-validator (substring + Levenshtein 0.95). |
| **M3 Claude + arquitectura agéntica** | 35% | B1 system prompts · B2 ≥2 tools · B3 ≥3 mensajes consola | 6+ system prompts dedicados; 2 MCPs custom + ≥8 tools SDK; pipeline audio-first genera ~10-15 calls por audio (Triage + Verifier + Regulatory + Vishing Opus + Notifier + tools). |
| **M4 Funciona** | 25% | B4 demo end-to-end | Demo principal: subida en vivo de los 3 audios pre-validados (cuento del tío / banco oficial / familiar legítimo) + cascada procesa + verdict + push al cuidador en pantalla. Demo ultra-estable (sin telefonía = sin riesgo Twilio crash en vivo). |

## Juez (12 sub-checks, solo si Top 4 finalistas)

| Dim | Peso | Sub-checks | Cómo lo cumplimos |
|---|---|---|---|
| **J1 Pitch** | 35% | J1.1 ≤3 min · J1.2 ciudadano · J1.3 cita · J1.4 Q&A | María (78, Ñuñoa) → demo en vivo: cuidador sube audio del cuento del tío a la PWA → cascada detecta vishing + cita Ley 21.459 + Sernac → push al cuidador. Q&A red team con foco en *"¿qué pasa si el estafador dice ser la nieta?"* + *"¿por qué no en vivo?"*. |
| **J2 Impacto** | 35% | J2.1 métrica · J2.2 alcanzable · J2.3 nuevo · J2.4 canal | 2.4M adultos mayores + cero instalación + B2NGO con SENAMA. Único motor de detección de vishing con citas regulatorias obligatorias en LATAM. Canal MVP: PWA + audio upload. **Roadmap V2 declarado:** llamada en vivo con call forwarding GSM. |
| **J3 Demo en vivo** | 30% | J3.1 no crashea · J3.2 I/O visible · J3.3 latencia · J3.4 Claude evidente | Demo audio-first ultra-estable. PWA muestra transcript Scribe + decisión por nivel + tools invocadas + modelo (Sonnet/Opus/Haiku). **Latencia E2E <30s** para audio 60s. |

## Selección y desempate

- **Top 4 por vertical → 12 finalistas** (cron 7-mayo 09:00 sobre `score_mentor`).
- **Desempate finalistas:** M3 > M2 > M1 > timestamp.
- **6 ganadores totales** (2 por vertical).
- **M3 (35% peso + primer desempate) = inversión con mejor ROI.** La cascada Triage + Verifier + Analyst + Regulatory + Notifier + Denuncia sostiene M3 generando decenas de calls por llamada y mostrando arquitectura agéntica real.

## Reglas críticas (descalificadores)

- **Claude motor principal.** Sin uso real verificado en consola Anthropic dentro de la ventana → descalificación. Otros LLMs como base → descalificados. **ElevenLabs Scribe solo STT, ElevenLabs TTS solo TTS, Voyage solo embeddings** (componentes I/O sensoriales no-LLM).
- **Construido en la ventana.** Código y consola Anthropic con mensajes fuera de la ventana no cuentan para B3. **Primer call al API después de 6-mayo 00:00**, no antes.
- **Cero re-identificación de datasets** (PhishTank, URLhaus, CMF, Subtel).
- **Cero plagio.** Toda decisión arquitectónica documentada y defendible en Q&A.

## Anti-patrones (qué NO hacer en pitch / demo)

- No inventar features que no aparezcan en la demo (J1.4 cae si los jueces piden mostrarla).
- No mockear datos regulatorios — todo viene de fuente oficial citable, validados por A6.
- No transferir una llamada solo porque caller_id está whitelisted (V22 lo hace insuficiente).
- No omitir la notificación legal de grabación: en MVP audio-first vía checkbox al subir audio + onboarding PWA; en V2 con telefonía vía primer TTS.
- No respuestas largas a Marco si una corta resuelve.

## Q&A — preguntas duras esperadas

| Pregunta probable del jurado | Nuestra respuesta corta |
|---|---|
| *¿Qué pasa si el estafador dice ser la nieta?* | Identity Firewall multi-factor: caller_id no matchea → `take_message_only` forzado. Si matcheara, exigimos shared word + KBA + cross-channel WhatsApp al teléfono real, no al caller_id activo. |
| *¿Y si clonan la voz de la nieta?* | Voice cloning detection out of scope MVP, declarado. Defensa real: factor de conocimiento (KBA + shared word, no clonables) + canal out-of-band. |
| *¿Por qué no llamada en vivo?* | N19 (2026-05-06): el motor de detección es el aporte central; en MVP lo validamos con audios pre-grabados sobre golden set adversarial 35 casos (100% bloques V21/V22/V17/V19). Telefonía live (Twilio Voice + Media Streams + call forwarding GSM) está en roadmap V2 con todos los detalles arquitectónicos en `docs/PLAN.md` cuerpo principal — es continuación inmediata, no replanteo. |
| *¿Por qué ElevenLabs Scribe y no Whisper?* | Marco tiene API key + suscripción ElevenLabs activa. Vendor neutro (no OpenAI). Latencia 5-15s sobre audio 60s OK <30s sub-check J3.3. Whisper.cpp local Fly.io queda como roadmap V2 si se activa fallback. |
| *¿Por qué Twilio en V2 y no SIM físico?* | SIM card chileno requiere SIM gateway hardware (USD 200–500) + Asterisk. No viable en sprint corta. Twilio + DID Chile cumple. SIP trunk como roadmap producción V2. |
| *¿Cómo evitan que el agente alucine regulación?* | `tool_choice: required` + schema `citations[]` minItems:1 + post-validator determinista que fetchea la URL citada y exige substring + Levenshtein ≥0.95. Si falla → respuesta literal *"no encontré fuente"*. |
| *¿Qué hacen con la PII?* | Redacción regex chileno antes del modelo, antes de logs y antes de embeddings. TTL 24h. Hashing irreversible para shared words/KBA. ARCO+ expuesto en PWA. Diseñado para Ley 21.719. |
| *¿Y el consentimiento del llamante?* | En MVP audio-first: checkbox obligatorio al subir audio (el cuidador asume responsabilidad de notificar) + texto en onboarding PWA. En V2 con telefonía: primer TTS de Vigía notifica al llamante *"esta llamada está siendo analizada para protección"* (one-party-consent satisfecho). |
