# 07 — Defensa frente a la rúbrica v3.3

Score final = **40% mentor + 60% juez**. Texto literal en `docs/EVENT/RUBRICA.md`. Tabla operativa con evidencia exigida + owner + artefacto en `docs/PLAN.md`.

> 🔄 **Pivote N20 (2026-05-06) Lean MVP/PoC.** El stack lean **fortalece M2** (cero PII en reposo = compliance trivial Ley 21.719) y **mantiene M3** intacto (~10-15 calls Claude por audio sostienen B3 + B1 con 5+ system prompts + B2 con ≥6 tools del SDK). M1 y M4 sin cambios — el canal sigue siendo PWA + audio upload, el demo sigue procesando los 3 audios pre-validados. **Nuevo punto fuerte:** demo ultra-estable (sin DB que migrar, sin auth que romperse, sin servicios externos persistidos = sin puntos de falla cross-network durante el pitch en vivo).

## Mentor (10 sub-checks)

| Dim | Peso | Sub-check | Cómo lo cumplimos |
|---|---|---|---|
| **M1 Problema y ciudadano** | 20% | A1 sin jerga · A2 segmento · A3 canal · A4 impacto | Adultos mayores 65+ Chile (2.4M, INE 2026). **Canal MVP: PWA installable + audio upload.** Impacto: tiempo de detección 72h → ~30s (MVP Lean). V2 con telefonía: tiempo real durante la llamada. |
| **M2 Datos responsables** | 20% | A5 ≥2 fuentes · A6 sin alucinaciones | ≥7 fuentes oficiales (Wiki Legal Fintech, BCN Ley Fácil, CMF, Sernac, CSIRT, PDI, Subtel) en `apps/web/data/sources/*.json` con quotes pre-extraídos + fetch HTTP en caliente para post-validator + `tool_choice: required` + schema `citations[]` minItems:1 + Levenshtein 0.95. **Bonus N20:** cero PII en reposo (audio/transcript/verdict no se persisten) = cumplimiento Ley 21.719 por diseño, no por feature. |
| **M3 Claude + arquitectura agéntica** | 35% | B1 system prompts · B2 ≥2 tools · B3 ≥3 mensajes consola | 5+ system prompts dedicados; ≥6 tools del SDK (`tool-citation-fetch`, `tool-phone-lookup`, `tool-shared-word-check`, `tool-kba-random-question`, `tool-phishtank`, `tool-urlhaus`, `tool-denuncia`); pipeline Lean genera ~10-15 calls por audio (Triage + Verifier + Regulatory + Vishing Opus + Notifier + tools). |
| **M4 Funciona** | 25% | B4 demo end-to-end | Demo principal: subida en vivo de los 3 audios pre-validados (cuento del tío / banco oficial / familiar legítimo) + cascada procesa + verdict renderizado en pantalla. **Demo Lean ultra-estable** (sin Twilio, sin DB, sin auth, sin servicios externos persistidos = sin puntos de falla cross-network durante el pitch). |

## Juez (12 sub-checks, solo si Top 4 finalistas)

| Dim | Peso | Sub-checks | Cómo lo cumplimos |
|---|---|---|---|
| **J1 Pitch** | 35% | J1.1 ≤3 min · J1.2 ciudadano · J1.3 cita · J1.4 Q&A | María (78, Ñuñoa) → demo en vivo: cuidador sube audio del cuento del tío a la PWA → cascada detecta vishing + cita Ley 21.459 + Sernac → render en pantalla. Q&A red team con foco en *"¿qué pasa si el estafador dice ser la nieta?"* + *"¿por qué no en vivo?"* + *"¿por qué sin DB?"*. |
| **J2 Impacto** | 35% | J2.1 métrica · J2.2 alcanzable · J2.3 nuevo · J2.4 canal | 2.4M adultos mayores + cero instalación + B2NGO con SENAMA. Único motor de detección de vishing con citas regulatorias obligatorias en LATAM. Canal MVP: PWA + audio upload. **Roadmap V2 declarado:** persistencia (Supabase) + auth (magic link) + cross-channel push (Web Push + WhatsApp + SMS) + llamada en vivo con call forwarding GSM. |
| **J3 Demo en vivo** | 30% | J3.1 no crashea · J3.2 I/O visible · J3.3 latencia · J3.4 Claude evidente | Demo Lean ultra-estable. PWA muestra transcript Scribe + decisión por nivel + tools invocadas + modelo (Sonnet/Opus/Haiku) + citations validadas. **Latencia E2E <30s** para audio 60s. |

## Selección y desempate

- **Top 4 por vertical → 12 finalistas** (cron 7-mayo 09:00 sobre `score_mentor`).
- **Desempate finalistas:** M3 > M2 > M1 > timestamp.
- **6 ganadores totales** (2 por vertical).
- **M3 (35% peso + primer desempate) = inversión con mejor ROI.** La cascada Triage + Verifier + Regulatory + Vishing + Notifier sostiene M3 generando decenas de calls por audio.

## Reglas críticas (descalificadores)

- **Claude motor principal.** Sin uso real verificado en consola Anthropic dentro de la ventana → descalificación. Otros LLMs como base → descalificados. **ElevenLabs Scribe solo STT, ElevenLabs TTS solo TTS** (componentes I/O sensoriales no-LLM).
- **Construido en la ventana.** Código y consola Anthropic con mensajes fuera de la ventana no cuentan para B3. **Primer call al API después de 6-mayo 00:00**, no antes.
- **Cero re-identificación de datasets** (PhishTank, URLhaus, CMF, Subtel).
- **Cero plagio.** Toda decisión arquitectónica documentada y defendible en Q&A.

## Anti-patrones (qué NO hacer en pitch / demo)

- No inventar features que no aparezcan en la demo (J1.4 cae si los jueces piden mostrarla).
- No mockear datos regulatorios — todo viene de fuente oficial citable, validados por A6.
- No transferir una llamada solo porque caller_id está whitelisted (V22 lo hace insuficiente).
- No omitir la notificación legal de grabación: en MVP Lean vía checkbox al subir audio + onboarding PWA; en V2 con telefonía vía primer TTS.
- No respuestas largas a Marco si una corta resuelve.
- **No prometer en pitch features V2 (Web Push + WhatsApp + SMS + auth + persistencia + telefonía live) como si estuvieran en el MVP.** El roadmap V2 se declara explícitamente, no se esconde como "el MVP es eso".

## Q&A — preguntas duras esperadas

| Pregunta probable del jurado | Nuestra respuesta corta |
|---|---|
| *¿Qué pasa si el estafador dice ser la nieta?* | Identity Firewall multi-factor: caller_id no matchea → `take_message_only` forzado. Si matcheara, el motor de detección genera un challenge plan recomendado al cuidador (shared word + KBA + WhatsApp ack al teléfono real). En V2 se ejecuta en vivo. |
| *¿Y si clonan la voz de la nieta?* | Voice cloning detection out of scope MVP, declarado. Defensa real: factor de conocimiento (KBA + shared word, no clonables) + canal out-of-band. |
| *¿Por qué sin base de datos?* | N20 (2026-05-06): MVP/PoC stateless deliberado. El motor de detección no necesita persistir nada para validar M2/M3. Cero PII en reposo es ventaja regulatoria, no carencia. La capa de cuentas + persistencia + cross-channel push se activa en V2. Para el demo del Lab, es lo que el jurado va a observar — y reduce blast radius del pitch en vivo. |
| *¿Por qué sin auth?* | El MVP es demo público para validar el motor frente al jurado. Auth + cuentas + multi-cuidador = V2 cuando haya cuidadores reales con datos sensibles. Hoy lo que protegemos es la PoC. |
| *¿Por qué no llamada en vivo?* | N19 (2026-05-06): KYC DID Twilio Chile incierto + WebSocket bidireccional µ-law en ventana ~20h hostil al timeline. El motor de detección es el aporte central; en MVP lo validamos con audios pre-grabados sobre golden set adversarial 35 casos (100% bloques V21/V22/V17/V19). Telefonía live (Twilio Voice + Media Streams + call forwarding GSM) está en roadmap V2. |
| *¿Cómo citan sin RAG?* | Las ~7 fuentes oficiales son finitas y conocidas. El snapshot JSON estático en `apps/web/data/sources/*.json` con quotes pre-extraídos acelera la cascada; el post-validator hace fetch HTTP en caliente sobre las URLs canónicas (Wiki Legal Fintech, BCN, CMF, Sernac, CSIRT, PDI, Subtel) con substring + Levenshtein 0.95. RAG vectorial es optimización V2 cuando el corpus crezca. |
| *¿Por qué ElevenLabs Scribe y no Whisper?* | Marco tiene API key + suscripción ElevenLabs activa. Vendor neutro (no OpenAI). Latencia 5-15s sobre audio 60s OK <30s sub-check J3.3. Whisper.cpp local Fly.io queda como roadmap V2 si se activa fallback. |
| *¿Por qué Twilio en V2 y no SIM físico?* | SIM card chileno requiere SIM gateway hardware (USD 200–500) + Asterisk. No viable en sprint corta. Twilio + DID Chile cumple. SIP trunk como roadmap producción V2. |
| *¿Cómo evitan que el agente alucine regulación?* | `tool_choice: required` + schema `citations[]` minItems:1 + post-validator determinista que fetchea la URL citada (sin DB, sin RAG en MVP) y exige substring + Levenshtein ≥0.95. Si falla → respuesta literal *"no encontré fuente"*. |
| *¿Qué hacen con la PII?* | En MVP/PoC, no la persistimos: el audio entra por multipart, se procesa en memoria, se descarta tras devolver el verdict. **Cero PII en reposo** = cumplimiento Ley 21.719 por diseño, no como feature. Redacción regex chilena pre-modelo y pre-logs aplicación. Hashing irreversible de shared words/KBA en el config demo. ARCO+ trivialmente cumplido por ausencia de almacenamiento. |
| *¿Y el consentimiento del llamante?* | En MVP Lean: checkbox obligatorio al subir audio (el cuidador asume responsabilidad de notificar) + texto en onboarding PWA. La marca no se persiste; se valida por request. En V2 con telefonía: primer TTS de Vigía notifica al llamante *"esta llamada está siendo analizada para protección"* (one-party-consent satisfecho). |
