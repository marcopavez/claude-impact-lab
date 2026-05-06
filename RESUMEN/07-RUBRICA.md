# 07 — Defensa frente a la rúbrica v3.3

Score final = **40% mentor + 60% juez**. Texto literal en `docs/EVENT/RUBRICA.md`. Tabla operativa con evidencia exigida + owner + artefacto en `docs/PLAN.md`.

## Mentor (10 sub-checks)

| Dim | Peso | Sub-check | Cómo lo cumplimos |
|---|---|---|---|
| **M1 Problema y ciudadano** | 20% | A1 sin jerga · A2 segmento · A3 canal · A4 impacto | Adultos mayores 65+ Chile (2.4M, INE 2026). Canal: llamada con call forwarding. Impacto: tiempo de detección 72h → tiempo real durante la llamada. |
| **M2 Datos responsables** | 20% | A5 ≥2 fuentes · A6 sin alucinaciones | ≥7 fuentes oficiales (Wiki Legal Fintech, BCN Ley Fácil, CMF, Sernac, CSIRT, PDI, Subtel) + `tool_choice: required` + schema `citations[]` minItems:1 + post-validator (substring + Levenshtein 0.95). |
| **M3 Claude + arquitectura agéntica** | 35% | B1 system prompts · B2 ≥2 tools · B3 ≥3 mensajes consola | 6+ system prompts dedicados; 2 MCPs custom + ≥8 tools SDK; pipeline phone-first genera decenas de calls por llamada. |
| **M4 Funciona** | 25% | B4 demo end-to-end | Demo principal: llamada en vivo real con call forwarding + 3 llamadas pre-validadas + PWA cuidador en pantalla. Backup pre-grabado sin transición visible. |

## Juez (12 sub-checks, solo si Top 4 finalistas)

| Dim | Peso | Sub-checks | Cómo lo cumplimos |
|---|---|---|---|
| **J1 Pitch** | 35% | J1.1 ≤3 min · J1.2 ciudadano · J1.3 cita · J1.4 Q&A | María (78, Ñuñoa) → demo en vivo de cuento del tío bloqueado por el firewall → cita Ley 21.459 + Sernac. Q&A red team con foco en *"¿qué pasa si el estafador dice ser la nieta?"*. |
| **J2 Impacto** | 35% | J2.1 métrica · J2.2 alcanzable · J2.3 nuevo · J2.4 canal | 2.4M adultos mayores + cero instalación + B2NGO con SENAMA. Único filtro multi-factor de identidad para llamada en LATAM. Canal real: la llamada que ya recibe la víctima. |
| **J3 Demo en vivo** | 30% | J3.1 no crashea · J3.2 I/O visible · J3.3 latencia · J3.4 Claude evidente | Backup video + 3 llamadas pre-validadas. PWA muestra transcript SSE + decisión por nivel + tools + modelo. p50 Triage <2s. |

## Selección y desempate

- **Top 4 por vertical → 12 finalistas** (cron 7-mayo 09:00 sobre `score_mentor`).
- **Desempate finalistas:** M3 > M2 > M1 > timestamp.
- **6 ganadores totales** (2 por vertical).
- **M3 (35% peso + primer desempate) = inversión con mejor ROI.** La cascada Triage + Verifier + Analyst + Regulatory + Notifier + Denuncia sostiene M3 generando decenas de calls por llamada y mostrando arquitectura agéntica real.

## Reglas críticas (descalificadores)

- **Claude motor principal.** Sin uso real verificado en consola Anthropic dentro de la ventana → descalificación. Otros LLMs como base → descalificados. Deepgram solo STT, Twilio Polly solo TTS, Voyage solo embeddings (componentes I/O sensoriales no-LLM).
- **Construido en la ventana.** Código y consola Anthropic con mensajes fuera de la ventana no cuentan para B3. **Primer call al API después de 6-mayo 00:00**, no antes.
- **Cero re-identificación de datasets** (PhishTank, URLhaus, CMF, Subtel).
- **Cero plagio.** Toda decisión arquitectónica documentada y defendible en Q&A.

## Anti-patrones (qué NO hacer en pitch / demo)

- No inventar features que no aparezcan en la demo (J1.4 cae si los jueces piden mostrarla).
- No mockear datos regulatorios — todo viene de fuente oficial citable, validados por A6.
- No transferir una llamada solo porque caller_id está whitelisted (V22 lo hace insuficiente).
- No omitir la notificación legal de grabación al inicio del primer TTS.
- No respuestas largas a Marco si una corta resuelve.

## Q&A — preguntas duras esperadas

| Pregunta probable del jurado | Nuestra respuesta corta |
|---|---|
| *¿Qué pasa si el estafador dice ser la nieta?* | Identity Firewall multi-factor: caller_id no matchea → `take_message_only` forzado. Si matcheara, exigimos shared word + KBA + cross-channel WhatsApp al teléfono real, no al caller_id activo. |
| *¿Y si clonan la voz de la nieta?* | Voice cloning detection out of scope MVP, declarado. Defensa real: factor de conocimiento (KBA + shared word, no clonables) + canal out-of-band. |
| *¿Por qué Twilio y no SIM físico?* | SIM card chileno requiere SIM gateway hardware (USD 200–500) + Asterisk. No viable en 48h. Twilio + DID Chile cumple. SIP trunk como roadmap producción. |
| *¿Por qué Deepgram y no Whisper?* | Deepgram es vendor neutro y rápido. Whisper.cpp local en Fly.io declarado como fallback (modelo MIT). "No llamamos a OpenAI" en cualquier caso. |
| *¿Cómo evitan que el agente alucine regulación?* | `tool_choice: required` + schema `citations[]` minItems:1 + post-validator determinista que fetchea la URL citada y exige substring + Levenshtein ≥0.95. Si falla → respuesta literal *"no encontré fuente"*. |
| *¿Qué hacen con la PII?* | Redacción regex chileno antes del modelo, antes de logs y antes de embeddings. TTL 24h. Hashing irreversible para shared words/KBA. ARCO+ expuesto en PWA. Diseñado para Ley 21.719. |
| *¿Y el consentimiento del llamante?* | Primer TTS notifica: *"esta llamada está siendo analizada para protección"*. One-party-consent satisfecho + notificación al llamante. |
