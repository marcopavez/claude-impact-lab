# 06 — Decisiones tomadas (y descartadas)

Atajo para responder Q&A "¿y por qué no usaron X?". Cada elección con su trade-off explícito.

## Lo que SÍ elegimos

| Decisión | Por qué | Trade-off aceptado |
|---|---|---|
| **Claude motor único** (Sonnet 4.6 vivo + Opus 4.7 post-call + Haiku 4.5 trivial) | Regla del Lab: otro LLM como motor → descalifica. Multi-modelo declarado = bonus M3. | Dependencia de Anthropic; mitigado por skill `claude-api` y caching. |
| **Twilio Programmable Voice + Media Streams** | Único viable en sprint 48h. µ-law 8kHz/20ms via WebSocket bidireccional, latencia real. DID Chile disponible. | Costo por minuto en producción; no hay vendor neutralidad. |
| **Call forwarding GSM** (`**21*<DID>#`) | Cero instalación, cero login para la persona protegida. Soportado en Movistar/Entel/WOM/VTR. | El operador puede cobrar el desvío; documentado. |
| **Deepgram Nova-3 streaming** + **whisper.cpp local fallback** | Vendor neutro, <300ms interim transcripts, es-CL probado. Whisper local como respuesta a "solo Claude" interpretado literal. | Costo Deepgram fuera de free tier; whisper local consume Fly.io. |
| **Twilio Polly Lupe-Neural** TTS | Incluido en Twilio, español neutro, integración trivial vía TwiML. Dicción para 65+. | Voz no premium; Cartesia Sonic como upgrade futuro. |
| **pgvector sobre Supabase** | Estándar, free tier suficiente, RLS por `caregiver_id` nativo. | Latencia mayor que Pinecone en escala; aceptable para MVP. |
| **Voyage AI `voyage-3` embeddings** | Calidad alta es-CL, costo bajo, **no acopla a otro LLM** (preserva gate "Claude motor único"). | Vendor adicional; mitigado por aislar a un solo módulo. |
| **PWA installable** (Next.js 15 + Supabase + Web Push) | Cero fricción de distribución (no App Store), Add-to-Home-Screen indistinguible de nativa. | Web Push en iOS requiere instalación previa; mitigado con WhatsApp y SMS redundantes. |
| **Política B (secretaria) por defecto** | Modelo de uso real: víctimas reciben mayoritariamente llamadas transaccionales o fraudulentas. La nieta llamando solo a conversar es la excepción. | Llamadas legítimas requieren un step extra; documentado en onboarding. |
| **Deny-by-default en el Identity Firewall** | Caller-ID es trivialmente spoofeable (V20, V22). Single-factor es insuficiente por diseño. | Falsos positivos si el cuidador no configuró bien; FP-permissive es la línea editorial. |
| **MCPs custom standalone** (`mcp-wiki-legal`, `mcp-cmf`) | Sostiene narrativa "MCP custom" sin sobre-ingeniar. Resto son tools del SDK. | Dos servidores extra que mantener; aceptable para demo. |
| **`tool_choice: required` + post-validator de citations** | Gate A6 binario. Sin esto el agente alucina regulación. | Latencia extra por fetch + Levenshtein; mitigado con cache de fuentes. |
| **Conventional Commits en español** | Marco escribe español, queremos historia legible. | Linters multilingües pueden quejarse; ignorable. |

## Lo que descartamos (y por qué)

| Descartado | Por qué |
|---|---|
| **App nativa Android/iOS** | Costo de App Store review + builds nativos > beneficio MVP. PWA installable cumple. Roadmap V2. |
| **GPT-4 / Gemini como motor** | **Descalifica.** Regla del Lab. |
| **Whisper de OpenAI** | Conservador con "Claude motor principal". Deepgram es vendor neutro; whisper.cpp local como fallback open MIT. |
| **Embeddings de OpenAI** | Acoplamiento innecesario a otro proveedor LLM. Voyage `voyage-3` cumple sin riesgo. |
| **LangChain / LangGraph** | Abstracción especulativa que estorba el Q&A. SDK directo + cascada custom es más defendible. |
| **Voice cloning detection** | Estado del arte cambiante, datos de referencia complejos. Defensa real para clonación = factor de conocimiento (KBA + shared word, no clonables) + cross-channel out-of-band. Eso ya está. |
| **SIM card chileno físico** | No viable sin SIM gateway hardware (USD 200–500 + Asterisk) en sprint 48h. SIP trunk chileno como roadmap producción. |
| **Streaming bidireccional con interrupciones naturales** | MVP usa turn-by-turn simple. Manejar interrupciones requiere VAD bidireccional non-trivial. |
| **Captura de audio con app nativa Android** | Out of scope. El audio viene por Twilio Media Streams en server. |
| **Multi-idioma** | Solo es-CL en MVP. Migrantes/multi-idioma en V2 explícito. |
| **Multi-cuidador por persona protegida** | V2. Complica auth, alertas y consentimiento. |
| **Indexar contenido del usuario en pgvector** | Inyección indirecta (V5). Solo indexamos fuentes oficiales. |
| **Confirmar al llamante el resultado de su shared word** | Oracle attack. Vigía nunca dice "esa palabra está mal" — solo procede o niega. |
| **Test calls al API Anthropic antes del 6-mayo 00:00** | Sub-check B3 exige consola Anthropic con ≥3 mensajes **dentro** de la ventana. Llamadas previas pueden activar la heurística en el lado equivocado. |

## Decisiones de seguridad (N1–N18)

Cerradas y documentadas en `docs/SEGURIDAD.md`. Cualquier cambio exige actualizar ese documento + memoria + revisión por pares. Resumen ya está en `RESUMEN/05-PRIVACIDAD.md`.

## Cómo proponer un cambio de decisión

1. Abrir issue en `develop` referenciando la decisión exacta a revisar.
2. Aportar evidencia técnica (no opinión) de por qué la decisión actual deja de ser óptima.
3. Documentar el cambio en `docs/PROYECTO.md` o `docs/SEGURIDAD.md` según corresponda.
4. Actualizar memoria del proyecto.
5. Revisión por pares antes de merge a `develop`.
