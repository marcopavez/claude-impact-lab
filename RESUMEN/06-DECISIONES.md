# 06 — Decisiones tomadas (y descartadas)

Atajo para responder Q&A "¿y por qué no usaron X?". Cada elección con su trade-off explícito.

> 🔄 **Pivote N19 (2026-05-06) audio-first MVP.** Antes de N19, las decisiones N1-N18 se tomaron asumiendo phone-first vivo (Twilio Voice + Media Streams + Deepgram + call forwarding GSM + Polly). N19 reformula N1/N5/N11/N13, reemplaza N2/N3/N7/N8/N9, hace obsoleta N12 y traslada el canal de N10. Estas decisiones no están "descartadas" sino **diferidas a roadmap V2 explícito**. Detalle en `docs/SEGURIDAD.md §31` Bloque 6.

## Decisiones MVP audio-first (vigentes)

| Decisión | Por qué | Trade-off aceptado |
|---|---|---|
| **Claude motor único** (Sonnet 4.6 + Opus 4.7 + extended thinking + Haiku 4.5) | Regla del Lab: otro LLM como motor → descalifica. Multi-modelo declarado = bonus M3. | Dependencia de Anthropic; mitigado por skill `claude-api` y caching. |
| **Audios pre-grabados subidos a la PWA** (drag-and-drop, MP3/M4A/WAV ≤60s) | N19: cero infra telefónica, cero KYC DID Chile, cero WebSocket bidireccional. Procesamiento batch encaja con la ventana de ~20h. | Sin acciones telefónicas en vivo (transfer/hangup). Identity Firewall opera en modo "detección + challenge plan recomendado". |
| **ElevenLabs Scribe v1** STT batch (modelo `scribe_v1`) | Marco tiene API key + suscripción activa. Vendor neutro (no OpenAI). Latencia 5-15s sobre audio 60s OK <30s sub-check J3.3. Multi-acento es-CL. | Sin streaming; aceptable porque MVP es batch. |
| **ElevenLabs TTS** (voz es-CL, modelo `eleven_multilingual_v2`) | Doble uso: generar 3 audios demo + opcional verdict hablado en PWA. Mismo proveedor que Scribe. | Voz no premium real-time; aceptable para batch + accesibilidad. |
| **pgvector sobre Supabase** | Estándar, free tier suficiente, RLS por `caregiver_id` nativo. | Latencia mayor que Pinecone en escala; aceptable para MVP. |
| **Voyage AI `voyage-3` embeddings** | Calidad alta es-CL, costo bajo, **no acopla a otro LLM** (preserva gate "Claude motor único"). | Vendor adicional; mitigado por aislar a un solo módulo. |
| **PWA installable** (Next.js 16 + Supabase magic link + Web Push) | Cero fricción de distribución (no App Store), Add-to-Home-Screen indistinguible de nativa. | Web Push en iOS requiere instalación previa; mitigado con WhatsApp y SMS redundantes. |
| **Política B (secretaria) por defecto** | Modelo de uso real: víctimas reciben mayoritariamente llamadas transaccionales o fraudulentas. La nieta llamando solo a conversar es la excepción. | Llamadas legítimas requieren un step extra; documentado en onboarding. |
| **Deny-by-default en el Identity Firewall** | Caller-ID es trivialmente spoofeable (V20, V22). Single-factor es insuficiente por diseño. | Falsos positivos si el cuidador no configuró bien; FP-permissive es la línea editorial. |
| **MCPs custom standalone** (`mcp-wiki-legal`, `mcp-cmf`) | Sostiene narrativa "MCP custom" sin sobre-ingeniar. Resto son tools del SDK. | Dos servidores extra que mantener; aceptable para demo. |
| **`tool_choice: required` + post-validator de citations** | Gate A6 binario. Sin esto el agente alucina regulación. | Latencia extra por fetch + Levenshtein; mitigado con cache de fuentes. |
| **Consentimiento legal vía checkbox al subir audio** + texto en onboarding PWA | One-party-consent satisfecho: el cuidador (que sube el audio) declara que el llamante fue notificado o que la grabación es legítima. | Confianza en el cuidador; auditable en `audio_uploads.consent_checkbox`. |
| **Conventional Commits en español** | Marco escribe español, queremos historia legible. | Linters multilingües pueden quejarse; ignorable. |

## Decisiones diferidas a Roadmap V2 (post-MVP, requieren telefonía activa)

| Decisión V2 | Por qué quedó en V2 (N19) | Cuándo se activa |
|---|---|---|
| **Twilio Programmable Voice + Media Streams** (DID Chile) | KYC DID Chile incierto + complejidad WebSocket bidireccional µ-law en ventana ~20h. | V2 cuando se haga la capa telefónica live. Reemplaza N2. |
| **Call forwarding GSM** (`**21*<DID>#`) | Sin DID activo no aplica. | V2 con Twilio activo. Reemplaza N9. |
| **Deepgram Nova-3 streaming + whisper.cpp local fallback** | ElevenLabs Scribe batch cubre MVP. Streaming + fallback abierto = V2 si hace falta. | V2 cuando latencia real-time sea crítica. Reemplaza N3, N7. |
| **Twilio Polly Lupe-Neural** TTS via TwiML | Sin Twilio Voice no aplica TwiML. ElevenLabs TTS cumple. | V2 con Twilio activo. Reemplaza N8. |
| **Notificación legal en primer TTS** | Sin TTS en vivo no aplica. Checkbox + onboarding cumple one-party-consent en MVP. | V2 con telefonía. Traslada N10. |
| **Decisión telefónica HIGH→hangup, MEDIUM→message, LOW→transfer** | Sin llamada en curso no hay cómo colgar/transferir. MVP devuelve verdict + push. | V2 con telefonía. Reformula N11. |
| **DID Twilio Chile pre-comprado** | No aplica MVP. | V2 con telefonía. **Obsoleta N12**. |

## Lo que descartamos definitivamente (no V2 tampoco)

| Descartado | Por qué |
|---|---|
| **App nativa Android/iOS** | Costo de App Store review + builds nativos > beneficio MVP. PWA installable cumple. Roadmap V2 lejano si justifica capabilities (audio capture Android). |
| **GPT-4 / Gemini como motor** | **Descalifica.** Regla del Lab. |
| **Whisper de OpenAI** | Conservador con "Claude motor principal". ElevenLabs Scribe es vendor neutro. |
| **Embeddings de OpenAI** | Acoplamiento innecesario a otro proveedor LLM. Voyage `voyage-3` cumple sin riesgo. |
| **LangChain / LangGraph** | Abstracción especulativa que estorba el Q&A. SDK directo + cascada custom es más defendible. |
| **Voice cloning detection** | Estado del arte cambiante, datos de referencia complejos. Defensa real para clonación = factor de conocimiento (KBA + shared word, no clonables) + cross-channel out-of-band. Eso ya está. |
| **SIM card chileno físico** | No viable sin SIM gateway hardware (USD 200–500 + Asterisk) en sprint 48h. SIP trunk chileno como roadmap producción V2. |
| **Streaming bidireccional con interrupciones naturales** | MVP no aplica (batch). V2 usaría turn-by-turn simple sobre Media Streams. Manejar interrupciones requiere VAD bidireccional non-trivial. |
| **Captura de audio con app nativa Android** | Out of scope. Audio en MVP viene del cuidador subiendo a la PWA; en V2 viene por Twilio Media Streams en server. |
| **Multi-idioma** | Solo es-CL en MVP y V2. Migrantes/multi-idioma en V3 explícito. |
| **Multi-cuidador por persona protegida** | V2. Complica auth, alertas y consentimiento. |
| **Indexar contenido del usuario en pgvector** | Inyección indirecta (V5). Solo indexamos fuentes oficiales. |
| **Confirmar al llamante el resultado de su shared word** | Oracle attack. Vigía nunca dice "esa palabra está mal" — solo procede o niega. |
| **Test calls al API Anthropic antes del 6-mayo 00:00** | Sub-check B3 exige consola Anthropic con ≥3 mensajes **dentro** de la ventana. Llamadas previas pueden activar la heurística en el lado equivocado. |

## Decisiones de seguridad (N1–N19)

Cerradas y documentadas en `docs/SEGURIDAD.md §31` Bloques 1-6. Cualquier cambio exige actualizar ese documento + memoria + revisión por pares. Resumen ya está en `RESUMEN/05-PRIVACIDAD.md`.

**N19 (2026-05-06)** consolida formalmente el pivote audio-first MVP: reformula N1/N5/N11/N13, reemplaza N2/N3/N7/N8/N9, hace obsoleta N12, traslada canal de N10.

## Cómo proponer un cambio de decisión

1. Abrir issue en `develop` referenciando la decisión exacta a revisar.
2. Aportar evidencia técnica (no opinión) de por qué la decisión actual deja de ser óptima.
3. Documentar el cambio en `docs/PROYECTO.md` o `docs/SEGURIDAD.md` según corresponda (skill `decision-record` automatiza la inserción al §31 Bloque siguiente).
4. Actualizar memoria del proyecto (`project_decisions_locked.md`).
5. Revisión por pares antes de merge a `develop`.
