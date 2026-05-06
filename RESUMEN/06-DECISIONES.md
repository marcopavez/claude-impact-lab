# 06 — Decisiones tomadas (y descartadas)

Atajo para responder Q&A "¿y por qué no usaron X?". Cada elección con su trade-off explícito.

> 🔄 **Pivote N20 (2026-05-06) Lean MVP/PoC.** "Algo funcional > arquitectónicamente correcto". El MVP elimina **Twilio (Voice + SMS), Deepgram, base de datos (Supabase Postgres + pgvector + Storage), auth (magic link), Web Push persistido, WhatsApp Cloud API, RAG vectorial Voyage**. Reformula N9/N10/N11/N13/N15. Reemplaza N17, N18. Detalle en `docs/SEGURIDAD.md §31` Bloque 7.
>
> Antes de N20, el plan audio-first (N19) ya había descartado Twilio Voice + Deepgram + Polly del MVP, pero conservaba Supabase + auth + Web Push + WhatsApp + SMS. N20 lleva la lógica al límite: stateless, sin auth, render en pantalla.

## Decisiones MVP Lean (vigentes post-N20)

| Decisión | Por qué | Trade-off aceptado |
|---|---|---|
| **Claude motor único** (Sonnet 4.6 + Opus 4.7 + extended thinking + Haiku 4.5) | Regla del Lab: otro LLM como motor → descalifica. Multi-modelo declarado = bonus M3. | Dependencia de Anthropic; mitigado por skill `claude-api` y caching. |
| **Audios pre-grabados subidos a la PWA** (drag-and-drop, MP3/M4A/WAV ≤60s) | N19/N20: cero infra telefónica, cero KYC DID Chile, cero WebSocket bidireccional. Procesamiento batch encaja con la ventana de ~20h. | Sin acciones telefónicas en vivo (transfer/hangup). Identity Firewall opera en modo "detección + challenge plan recomendado". |
| **ElevenLabs Scribe v1** STT batch (modelo `scribe_v1`) | Marco tiene API key + suscripción activa. Vendor neutro (no OpenAI). Latencia 5-15s sobre audio 60s OK <30s sub-check J3.3. Multi-acento es-CL. | Sin streaming; aceptable porque MVP es batch. |
| **ElevenLabs TTS** (modelo `eleven_v3`, voz es-CL) | Doble uso: generar 3 audios demo + opcional verdict hablado en PWA. Mismo proveedor que Scribe. | Voz no premium real-time; aceptable para batch + accesibilidad. |
| **Servidor stateless (sin DB)** | N20: cero PII en reposo es la forma más fuerte de cumplimiento Ley 21.719. Reduce blast radius del demo (sin migraciones, sin RLS bugs). El motor de detección no necesita persistir nada para validar M2/M3. | No hay historial entre requests; no hay cuentas; no hay audit trail persistido. Aceptable: el MVP es PoC para validar el motor; producción real es V2. |
| **Sin auth en MVP** | N20: la PWA es single-page demo público para el Lab. Auth + cuentas + multi-cuidador = V2 cuando haya cuidadores reales con datos sensibles. | Anyone con la URL puede usar la API. Aceptable durante el demo (deploy privado/local). |
| **Fuentes regulatorias en JSON estático** (`apps/web/data/sources/*.json`) + **fetch HTTP en caliente para post-validator** | N20: las ~7 fuentes oficiales son finitas y conocidas. RAG vectorial aporta valor con corpus grande, no aquí. Snapshot estático + fetch en vivo cubre A5/A6 sin DB. | Hay que actualizar manualmente el snapshot cuando una fuente se modifica. Aceptable: para demo del Lab los quotes pre-extraídos son suficientes. |
| **Identity Firewall contra `apps/web/data/demo-config.json`** | N20: hardcoded para María (whitelist + shared word `quiltro feliz` + 3 KBA). Sin configuración por usuario en MVP. | Demo único; no se puede demostrar onboarding por cuidador. Aceptable: el motor de detección + challenge plan se ve igual. |
| **Render del verdict en pantalla** + opcional `Notification` API in-page | N20: sin Web Push persistido (requiere DB de subscriptions), sin WhatsApp Cloud (requiere KYC Meta), sin SMS Twilio. El verdict + tools + modelo se ven en la UI durante el demo. | Sin alertas redundantes cross-channel; aceptable porque el cuidador está mirando la PWA durante el demo. V2 introduce push redundante. |
| **PWA installable** (Next.js 16 + manifest, sin auth, sin login) | Cero fricción de distribución (no App Store), Add-to-Home-Screen indistinguible de nativa. | iOS Web Push requiere instalación previa; en MVP no aplica (no hay Web Push). |
| **Política B (secretaria) por defecto** | Modelo de uso real: víctimas reciben mayoritariamente llamadas transaccionales o fraudulentas. La nieta llamando solo a conversar es la excepción. | Llamadas legítimas requieren un step extra; documentado en config demo de María. |
| **Deny-by-default en el Identity Firewall** | Caller-ID es trivialmente spoofeable (V20, V22). Single-factor es insuficiente por diseño. | Falsos positivos si la verificación falla; FP-permissive es la línea editorial. |
| **`tool_choice: required` + post-validator de citations (fetch HTTP en caliente)** | Gate A6 binario. Sin esto el agente alucina regulación. N20: el post-validator hace fetch directo (sin DB, sin RAG). | Latencia extra por fetch + Levenshtein; mitigado con cache de fuentes en memoria por boot. |
| **Consentimiento legal vía checkbox al subir audio** + texto en onboarding PWA (sin persistir) | One-party-consent satisfecho a nivel UX: el cuidador (que sube el audio) declara que el llamante fue notificado o que la grabación es legítima. La marca no se persiste — se valida por request. | Confianza en el cuidador; no auditable post-hoc en MVP. V2 persiste la marca. |
| **Conventional Commits en español** | Marco escribe español, queremos historia legible. | Linters multilingües pueden quejarse; ignorable. |

## Decisiones diferidas a Roadmap V2 (post-MVP)

| Decisión V2 | Por qué quedó en V2 (N19/N20) | Cuándo se activa |
|---|---|---|
| **Twilio Programmable Voice + Media Streams** (DID Chile) | KYC DID Chile incierto + complejidad WebSocket bidireccional µ-law en ventana ~20h. | V2 cuando se haga la capa telefónica live. Reemplaza N2. |
| **Twilio SMS** (fallback de notificación) | N20: sin backend que mantenga sesiones de notificación, no aplica. | V2 con persistencia activa. |
| **Call forwarding GSM** (`**21*<DID>#`) | Sin DID activo no aplica. | V2 con Twilio activo. Reemplaza N9. |
| **Deepgram Nova-3 streaming + whisper.cpp local fallback** | ElevenLabs Scribe batch cubre MVP. Streaming + fallback abierto = V2 si hace falta. | V2 cuando latencia real-time sea crítica. Reemplaza N3, N7. |
| **Twilio Polly Lupe-Neural** TTS via TwiML | Sin Twilio Voice no aplica TwiML. ElevenLabs TTS cumple. | V2 con Twilio activo. Reemplaza N8. |
| **Notificación legal en primer TTS** | Sin TTS en vivo no aplica. Checkbox + onboarding cumple one-party-consent en MVP. | V2 con telefonía. Traslada N10. |
| **Decisión telefónica HIGH→hangup, MEDIUM→message, LOW→transfer** | Sin llamada en curso no hay cómo colgar/transferir. MVP devuelve verdict + render. | V2 con telefonía. Reformula N11. |
| **DID Twilio Chile pre-comprado** | No aplica MVP. | V2 con telefonía. **Obsoleta N12.** |
| **Supabase Postgres + pgvector + Storage** | N20: el MVP es stateless. Persistencia, RLS, signed URLs, TTL — todo es V2. | V2 cuando se introduzca multi-cuidador y persistencia. **Reemplaza el bloque DB de N19.** |
| **Supabase Auth magic link** | N20: sin auth en MVP. PWA single-page demo público. | V2. **Reemplaza N18.** |
| **Web Push (VAPID) persistido** | N20: requiere DB de subscriptions. Render en pantalla cumple para demo. | V2. **Reemplaza N17 (parte 1).** |
| **WhatsApp Cloud API** (cross-channel + alertas) | N20: KYC Meta + tokens persistidos. | V2. **Reemplaza N17 (parte 2).** |
| **RAG vectorial Voyage `voyage-3` + pgvector** | N20: las ~7 fuentes oficiales son finitas; RAG aporta con corpus grande, no aquí. Snapshot estático + fetch en vivo cubre A5/A6. | V2 cuando el corpus crezca (boletines diarios CMF/CSIRT/PDI, alertas Sernac dinámicas). |
| **Multi-cuidador por persona protegida** | V2. Complica auth, alertas y consentimiento. | V2. |
| **Endpoints ARCO+ (`/api/export`, `/api/account DELETE`)** | N20: en MVP no hay datos persistidos que exportar/borrar. ARCO+ se cumple por ausencia. | V2 con DB activa. |

## Lo que descartamos definitivamente (no V2 tampoco)

| Descartado | Por qué |
|---|---|
| **App nativa Android/iOS** | Costo de App Store review + builds nativos > beneficio MVP. PWA installable cumple. Roadmap V3 si justifica capabilities (audio capture nativo). |
| **GPT-4 / Gemini como motor** | **Descalifica.** Regla del Lab. |
| **Whisper de OpenAI** | Conservador con "Claude motor principal". ElevenLabs Scribe es vendor neutro. |
| **Embeddings de OpenAI** | Acoplamiento innecesario a otro proveedor LLM. En V2 con RAG: Voyage `voyage-3`. |
| **LangChain / LangGraph** | Abstracción especulativa que estorba el Q&A. SDK directo + cascada custom es más defendible. |
| **Voice cloning detection** | Estado del arte cambiante, datos de referencia complejos. Defensa real para clonación = factor de conocimiento (KBA + shared word, no clonables) + cross-channel out-of-band. Eso ya está. |
| **SIM card chileno físico** | No viable sin SIM gateway hardware (USD 200–500 + Asterisk) en sprint 48h. SIP trunk chileno como roadmap V2. |
| **Streaming bidireccional con interrupciones naturales** | MVP no aplica (batch). V2 usaría turn-by-turn simple sobre Media Streams. Manejar interrupciones requiere VAD bidireccional non-trivial. |
| **Captura de audio con app nativa Android** | Out of scope. Audio en MVP viene del cuidador subiendo a la PWA; en V2 viene por Twilio Media Streams en server. |
| **Multi-idioma** | Solo es-CL en MVP y V2. Migrantes/multi-idioma en V3 explícito. |
| **Indexar contenido del usuario en pgvector** | Inyección indirecta (V5). En V2 cuando exista pgvector: solo fuentes oficiales. |
| **Confirmar al llamante el resultado de su shared word** | Oracle attack. Vigía nunca dice "esa palabra está mal" — solo procede o niega. |
| **Test calls al API Anthropic antes del 6-mayo 00:00** | Sub-check B3 exige consola Anthropic con ≥3 mensajes **dentro** de la ventana. Llamadas previas pueden activar la heurística en el lado equivocado. |

## Decisiones de seguridad (N1–N20)

Cerradas y documentadas en `docs/SEGURIDAD.md §31` Bloques 1-7. Cualquier cambio exige actualizar ese documento + memoria + revisión por pares. Resumen ya está en `RESUMEN/05-PRIVACIDAD.md`.

- **N19 (2026-05-06)** consolida formalmente el pivote audio-first MVP: reformula N1/N5/N11/N13, reemplaza N2/N3/N7/N8/N9, hace obsoleta N12, traslada canal de N10.
- **N20 (2026-05-06)** consolida formalmente el pivote Lean MVP/PoC: reformula N9/N10/N11/N13/N15, reemplaza N17/N18, hace obsoletas para MVP el bloque de persistencia (Supabase + RLS + signed URL + TTL) + RAG vectorial.

## Cómo proponer un cambio de decisión

1. Abrir issue en `develop` referenciando la decisión exacta a revisar.
2. Aportar evidencia técnica (no opinión) de por qué la decisión actual deja de ser óptima.
3. Documentar el cambio en `docs/PROYECTO.md` o `docs/SEGURIDAD.md` según corresponda (skill `decision-record` automatiza la inserción al §31 Bloque siguiente).
4. Actualizar memoria del proyecto (`project_decisions_locked.md`).
5. Revisión por pares antes de merge a `develop`.
