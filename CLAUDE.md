# CLAUDE.md — Vigía (Claude Impact Lab 2026 · Chile)

## Misión
Construir un **detector de vishing con firewall de identidad** que protege a adultos mayores chilenos contra estafas telefónicas. **MVP/PoC Lean (N20, 2026-05-06):** el cuidador o la persona protegida sube audios sospechosos en una PWA installable; Claude los analiza con una cascada agéntica (Call Triage → Identity Verifier → Regulatory Translator → Vishing Analyst Opus 4.7) y entrega verdict + citas regulatorias validadas + render en pantalla en ~30s. **El MVP es deliberadamente lean: sin Twilio, sin Deepgram, sin base de datos, sin auth.** Servidor stateless, audio en memoria, fuentes y config demo en JSON estático. **Roadmap V2:** persistencia (Supabase), auth (magic link), notificaciones cross-channel (Web Push + WhatsApp + SMS), llamada en vivo (call forwarding GSM + DID Twilio + Media Streams).

Track de competencia: **Línea 02 — Ciberseguridad Ciudadana**. Por diseño cruza Línea 01 (traduce regulación a lenguaje ciudadano con citas obligatorias) y Línea 03 (consentimiento legal explícito vía checkbox al subir audio + texto en onboarding PWA, PII no persistida — el audio se descarta tras el response, derechos ARCO+ Ley 21.719 trivialmente cumplidos por ausencia de almacenamiento en MVP).

**Estructura de docs (3 archivos):** concepto + ficha cívica + arquitectura + decisiones + privacidad en `docs/PROYECTO.md`. Plan operativo (capas Core/Sólido/Wow + tracks técnicos + fallbacks + sub-checks operativos + KPIs + Q&A) en `docs/PLAN.md` — **Anexo C contiene el plan operativo Lean MVP vigente (post-N20); Anexo B = histórico audio-first con DB; cuerpo principal = roadmap V2 phone-first**. Threat model + identity firewall + PWA + prompts canónicos + golden set + decisiones cerradas N1-N20 en `docs/SEGURIDAD.md`. Texto literal de bases, rúbrica y datasets oficiales en `docs/EVENT/` — autoridad para cualquier disputa interna. Resúmenes para onboarding del equipo (10 min) en `RESUMEN/`. Slash command `/ultraplan` (`.claude/commands/ultraplan.md`) regenera el plan en vivo leyendo el repo.

## Filosofía del MVP/PoC (N20)

**"Algo funcional vale más que algo arquitectónicamente correcto."** El MVP/PoC del Lab existe para validar el motor de detección frente al jurado y mentores, no para entrar a producción. Por eso:

- **Sin Twilio, sin Deepgram** — N19 ya los descartó, N20 lo confirma.
- **Sin base de datos** — servidor stateless. Audio entra por multipart, se transcribe, se procesa por la cascada, se devuelve verdict en JSON. No hay tablas, no hay TTL, no hay signed URLs, no hay PII en reposo.
- **Sin auth** — la PWA es single-page demo público. No hay login, ni magic link, ni cuentas, ni RLS.
- **Fuentes oficiales en JSON estático** — snapshot manual de quotes pre-extraídos de las ~7 URLs canónicas (Wiki Legal Fintech, BCN Ley Fácil, CMF, Sernac, CSIRT, PDI, Subtel) en `apps/web/data/sources/*.json`, más fetch HTTP en caliente para el post-validator. Sin RAG vectorial, sin pgvector, sin Voyage embeddings.
- **Whitelist + shared word + KBA hardcoded** para María en `apps/web/data/demo-config.json`. El Identity Verifier compara contra ese config in-memory. La configuración por cuidador es V2.
- **Notificación = render en pantalla** + opcional `Notification` API in-page del browser. Sin Web Push persistido, sin WhatsApp Cloud, sin SMS Twilio.

Lo que **NO se sacrifica**: cascada agéntica completa, citation validator post-generación (substring + Levenshtein 0.95), PII redaction regex chilena pre-modelo, `tool_choice: required` + schema `citations[] minItems:1`, bias defensivo en system prompts, golden set adversarial ≥35 casos, threat model V1-V22. Esos son el aporte central y miden M2/M3.

## Principios no negociables

1. **Decisiones sólidas, no parches.** Antes de implementar algo no trivial, justifico técnicamente y pido alineamiento con Marco. Los hacks no sobreviven al red team del Q&A en vivo.
2. **Respuestas concisas y al hueso.** Cada respuesta a Marco fundamenta brevemente el "por qué" detrás del "qué". Sin paja, pero con justificación técnica explícita.
3. **Cita o calla.** Toda afirmación regulatoria del agente cita fuente oficial (Wiki Legal Fintech, BCN Ley Fácil, CMF, Sernac, CSIRT, PDI Cibercrimen, SII) o responde literal *"no encontré fuente para esta consulta"*. El sub-check **A6 (sin alucinaciones)** es binario. Aplicamos `tool_choice: required` + schema `citations[]` minItems:1 + post-validator determinista (substring + Levenshtein 0.95 sobre fuente fetcheada). Detalle `SEGURIDAD.md` §7.
4. **Deny-by-default en el firewall de identidad.** El llamante no toca a la persona protegida hasta ganarse el derecho. La transferencia es excepción, no default. Caller-ID solo NO basta — siempre exigir factor adicional (shared word/KBA + cross-channel ack). En MVP el firewall opera como motor de detección + challenge plan recomendado contra `data/demo-config.json`. Detalle `SEGURIDAD.md` Parte II.
5. **PII al mínimo y efímera.** En MVP no se persiste nada — el audio entra, se procesa, se descarta. Redacción determinista regex chileno antes del modelo, antes de logs. Diseñado desde día 1 alineado con Ley 21.719 (vigencia 1-dic-2026); cero almacenamiento en MVP es la forma más fuerte de cumplimiento por diseño.
6. **Consentimiento legal explícito.** En MVP/PoC: checkbox obligatorio al subir audio (*"el llamante fue notificado de esta grabación o la grabación fue obtenida bajo one-party-consent"*) + texto en onboarding PWA. La marca no se persiste; se valida por request. En V2 con telefonía: notificación legal en el primer TTS de Vigía.
7. **Ventana de construcción sagrada.** Código de aplicación se commitea solo dentro de la ventana de build. Antes y después: solo planning docs en `docs/`. Sub-check **B3** exige consola Anthropic con ≥3 mensajes en ventana — primer call al API debe ocurrir el 6-mayo después de las 00:00, no antes.
8. **Lean over correcto (N20).** Cuando la decisión es "stack rico que no termino" vs "stack mínimo que funciona end-to-end en vivo", elijo el segundo. Cada componente justifica su existencia frente al pitch + Q&A.

## Stack MVP/PoC (Lean, post-N20)

| Capa | Elección | Por qué |
|---|---|---|
| LLM motor | **Sonnet 4.6** (Call Triage, Identity Verifier, Regulatory, Notifier) + **Opus 4.7 + extended thinking** (Vishing Analyst post-call) + **Haiku 4.5** (Classifier secundario) | Sonnet 4.6 latencia/costo óptimo para batch <2s sobre transcript. Opus 4.7 con extended thinking en Vishing Analyst donde latencia 10-20s es aceptable y un FN es máximo costo. Haiku para clasificación trivial. Multi-modelo declarado = bonus M3. |
| SDK | `@anthropic-ai/sdk` TypeScript | Mismo lenguaje frontend ↔ backend ↔ tools. Skill `claude-api` aplicable. |
| Patrón agéntico | Cascada **Call Triage → Identity Verifier → Regulatory Translator → Vishing Analyst → Notifier** con `tool_choice: required` por agente. | M3 mide arquitectura agéntica; cascada Triage rápido + Analyst lento es defendible y auditable. ~10-15 calls Claude por audio procesado → sostiene B3 sobradamente. |
| Audio input | **Audios pre-grabados subidos a la PWA** (drag-and-drop, MP3/M4A/WAV ≤60s) | N19/N20: cero infra telefónica. La cascada procesa el audio en ~30s y entrega verdict + render en pantalla. Phone-first vivo = V2. |
| STT | **Groq · Whisper Large v3 Turbo** (endpoint OpenAI-compatible, modelo `whisper-large-v3-turbo`) | N21 (2026-05-07): switch desde ElevenLabs Scribe. Latencia <1s típica para audio ≤60s vs. 5-15s de Scribe — saca al STT del path crítico de J3.3. Whisper Large v3 soporta es-CL. Groq es STT (no LLM de razonamiento) → misma categoría I/O sensorial que Scribe, no rompe "Claude motor principal". NO Deepgram, NO whisper.cpp, NO Whisper-vía-OpenAI en MVP. |
| TTS | **ElevenLabs TTS** (modelo `eleven_v3`, voz es-CL) | Doble uso: (1) generar los 3 audios demo (cuento del tío, banco oficial, familiar legítimo, ≤60s c/u); (2) opcional reproducir verdict hablado en PWA para accesibilidad 65+. NO Twilio Polly. |
| Backend | **Next.js 16 API route `/api/audio/process`** (Vercel serverless) | Stateless: parse multipart → Groq Whisper → cascada → response JSON. Audio buffer en memoria por request, descarte tras response. **Cero DB, cero storage.** |
| Persistencia | **Ninguna en MVP.** Audio en memoria por request; verdict devuelto al cliente y renderizado. | Cero PII en reposo es ventaja regulatoria, no carencia. Postgres + pgvector + Storage = V2. |
| Auth | **Sin auth en MVP.** PWA single-page demo público. | Auth + cuentas multi-cuidador = V2. Para el demo del Lab no aporta. |
| Fuentes regulatorias | **JSON estático** en `apps/web/data/sources/*.json` con quotes pre-extraídos + **fetch HTTP** en caliente sobre URLs canónicas para el post-validator | Sin RAG vectorial, sin pgvector, sin Voyage. Las ~7 fuentes oficiales son finitas y conocidas; el snapshot estático es defendible y auditable; el fetch en vivo cubre el post-validator A6. |
| Identity Firewall | **`apps/web/data/demo-config.json`** con whitelist + shared word + KBA hardcoded para María | Modo demostración: el Verifier evalúa contra ese config in-memory y genera "challenge plan recomendado". Configuración por cuidador = V2. |
| Notificación | **Render en pantalla de la PWA** + opcional `Notification` API in-page del browser | Sin Web Push persistido, sin WhatsApp Cloud, sin SMS Twilio. El verdict + severity + citations + tools + modelo se ven directamente en la UI durante el demo. |
| PWA | Next.js 16 + React 19 + Tailwind v4 + shadcn/ui + manifest installable | Add-to-Home-Screen indistinguible de nativa. Single-page demo público. |
| Hosting | **Vercel** free tier (PWA + edge functions + route handlers `/api/*`) | Free tier suficiente. Deploy en minutos. Sin Supabase, sin Fly.io. |

**Decisiones que NO tomamos (y por qué):**
- **Twilio Voice + Media Streams** → N19/N20: KYC DID Chile incierto + complejidad WebSocket µ-law vs. ventana ~20h. **Roadmap V2.**
- **Twilio SMS** → N20: no hay backend que mantenga sesiones de notificación. SMS = V2.
- **Deepgram** → N19: descartado por streaming no necesario (audio-first batch). Reemplazado primero por Scribe (N19), luego por Groq Whisper Large v3 Turbo (N21).
- **ElevenLabs Scribe v1** → N21 (2026-05-07): reemplazado por Groq Whisper Large v3 Turbo. Razón: 5-15s de Scribe para audio ≤60s era ~30-40% del budget E2E; Groq baja eso a <1s. ElevenLabs queda solo para TTS (eleven_v3) en `scripts/render-scams.ts`.
- **Supabase (Postgres + pgvector + Auth + Storage)** → N20: el MVP es stateless; el snapshot JSON + fetch HTTP cubre A5/A6 sin DB. Persistencia + auth = V2.
- **Voyage AI embeddings + RAG vectorial** → N20: las fuentes son finitas (~7 dominios oficiales); RAG aporta valor con corpus grande, no aquí. V2.
- **Web Push (VAPID)** → N20: requiere persistir endpoints de subscription en server. Render en pantalla cumple para demo. V2.
- **WhatsApp Cloud API** → N20: requiere KYC Meta + tokens persistidos. V2.
- **App nativa Android/iOS** → costo App Store review > beneficio MVP. PWA installable cumple. V2.
- **Voice cloning detection** → estado del arte cambiante. Defensa real = factor de conocimiento (KBA + shared word, no clonables) + cross-channel out-of-band. Eso ya está.
- **SIM card chileno físico** → no viable sin SIM gateway hardware en sprint 48h.
- **Whisper vía OpenAI directo** → conservador con la regla "Claude motor principal" + dependencia directa de OpenAI como vendor de IA. Groq hostea Whisper (modelo abierto, MIT) en su propio hardware → no es OpenAI-as-a-service.
- **Streaming bidireccional con interrupciones naturales** → no aplica MVP. V2 usaría turn-by-turn simple sobre Media Streams.
- **LangChain/LangGraph** → abstracción especulativa que estorba el Q&A.
- **GPT-4 / Gemini como motor** → **descalifica**.
- **Embeddings de OpenAI** → no aplica (sin embeddings en MVP).
- **Multi-idioma** → solo es-CL en MVP. Migrantes/multi-idioma en V2 explícito.
- **Multi-cuidador por persona protegida** → V2.

## Git & gitflow

- `main` → solo releases estables; merge desde `develop` en hitos (`v0.1-mvp-audio`, `v0.5-solid`, `v1.0-demo-final`).
- `develop` → integración continua durante la sprint.
- `feat/<scope>` por feature, `fix/<scope>` por bug, `docs/<scope>` para documentación.
- **Conventional Commits en español:** `feat: call triage agent`, `fix: cita Sernac en respuesta de vishing`, `docs: identity firewall protocolo`.
- Tags al cierre de cada hito.
- Todo commit relevante DENTRO de la ventana. Si aparece commit fuera, se revierte o re-empaqueta.
- **Nunca** `--no-verify`, `--amend` sobre commits compartidos, ni `push --force` a `main`/`develop`.

## Cómo colaboramos (Marco ↔ Claude)

- **Antes de implementar** algo no trivial, propongo approach (qué, por qué, alternativas descartadas) y pido feedback.
- **Foco técnico:** Marco maneja logística del evento (entregables, deadlines, submits). Mi valor está en arquitectura, seguridad, componentes — no cronograma. Detalle en `feedback_focus_technical.md` de memoria.
- **Lean default (N20):** ante propuesta nueva, primero pregunto "¿se puede sin DB, sin auth, sin servicio externo extra?". Solo si la respuesta es no, se justifica el componente. La regla es "cada capa demuestra valor frente al jurado".
- **Agentes (`Agent` tool):** uso `Explore` para búsquedas amplias en repo y `Plan` para diseño de implementación. No los uso para tareas de una sola llamada.
- **Skills:** invoco las del repo cuando aplican (`init`, `review`, `security-review`, `simplify`, `update-config`, `frontend-design`, `claude-api`). No invento skills que no estén disponibles.
- **Memoria:** persisto decisiones, feedback y contexto del proyecto en el sistema de memoria. Si Marco corrige algo, queda guardado para futuras sesiones.
- **Tareas:** `TaskCreate` durante la sprint para tracking visible. Cierro cada tarea al cumplirla, no en batch.
- **Reportes:** al finalizar bloques de trabajo, una o dos frases sobre qué cambió y qué sigue.
- **Idioma:** Marco escribe en español, le respondo en español. Código y nombres de variables en inglés (estándar); commits y comentarios en español.

## Defensas frente a la rúbrica v3.3

La rúbrica oficial está en `docs/EVENT/RUBRICA.md`. Score final = **40% mentor + 60% juez**. Tabla operativa con evidencia exigida en `docs/PLAN.md` §12 "Sub-checks operativos".

**Resumen Mentor (10 sub-checks):**

| Dim | Peso | Sub-check | Cómo lo cumplimos |
|---|---|---|---|
| M1 Problema y ciudadano | 20% | A1 sin jerga / A2 segmento / A3 canal / A4 impacto | Adultos mayores 65+ Chile (2.4M INE 2026), **PWA installable + audio upload** (canal MVP), tiempo detección 72h → ~30s (procesamiento Scribe + cascada). |
| M2 Datos responsables | 20% | A5 ≥2 fuentes / A6 sin alucinaciones | ≥7 fuentes oficiales (Wiki Legal Fintech, BCN Ley Fácil, CMF, Sernac, CSIRT, PDI, Subtel) en `data/sources/*.json` + fetch HTTP en caliente para post-validator + `tool_choice: required` + schema `citations[]` minItems:1 + Levenshtein 0.95. **El stack lean refuerza M2:** cero PII en reposo = compliance trivial. |
| M3 Uso de Claude + arquitectura agéntica | 35% | B1 system prompts / B2 ≥2 tools / B3 ≥3 mensajes consola | 5+ system prompts dedicados (`docs/SEGURIDAD.md` Parte IV); ≥6 tools del SDK (citation-fetch, phone-lookup, phishtank, urlhaus, shared-word-check, kba-random-question, denuncia-build); pipeline Lean genera ~10-15 calls por audio. |
| M4 Funciona | 25% | B4 demo end-to-end | Demo principal: subida en vivo de los 3 audios pre-validados + cascada procesa + verdict renderizado en pantalla. Demo ultra-estable (sin Twilio, sin DB, sin auth = sin puntos de falla externos). |

**Resumen Juez (12 sub-checks, si finalistas):**

| Dim | Peso | Sub-checks | Cómo lo cumplimos |
|---|---|---|---|
| J1 Pitch | 35% | J1.1 ≤3 min · J1.2 ciudadano · J1.3 cita · J1.4 Q&A | María (78, Ñuñoa) → demo en vivo: cuidador sube audio del cuento del tío a la PWA → cascada detecta vishing + cita Ley 21.459 + Sernac → render en pantalla. Q&A red team con foco en "¿qué pasa si el estafador dice ser la nieta?" + "¿por qué no en vivo?" + "¿por qué sin DB?". |
| J2 Impacto | 35% | J2.1 métrica · J2.2 alcanzable · J2.3 nuevo · J2.4 canal | 2.4M adultos mayores + cero instalación + B2NGO con SENAMA. Único motor de detección de vishing con citas regulatorias obligatorias en LATAM. Canal MVP: PWA + audio upload. **Roadmap V2 declarado:** persistencia + auth + cross-channel + llamada en vivo con call forwarding GSM. |
| J3 Demo en vivo | 30% | J3.1 no crashea · J3.2 I/O visible · J3.3 latencia · J3.4 Claude evidente | Demo Lean ultra-estable (sin servicios externos persistidos = sin crash en vivo). PWA muestra transcript Scribe + decisión por nivel + tools invocadas + modelo (Sonnet/Opus/Haiku) + citations validadas. Latencia E2E <30s para audio 60s. |

**Selección:**
- Top 4 por vertical → 12 finalistas (cron 7-mayo 09:00 sobre score_mentor).
- Desempate: M3 > M2 > M1 > timestamp.
- 6 ganadores totales (2 por vertical).
- **M3 (35% peso + primer desempate) = inversión con mejor ROI.** La cascada Triage + Verifier + Regulatory + Vishing + Notifier sostiene M3 generando decenas de calls por audio.

## Reglas críticas (descalificadores y penalizaciones)

- **Claude motor principal.** Sin uso real verificado en consola Anthropic durante la ventana → descalificación. Otros LLMs como base → descalificados. **Groq Whisper solo STT, ElevenLabs TTS solo TTS** — componentes I/O sensoriales no-LLM (Whisper es modelo de transcripción, no de razonamiento; Groq es la infraestructura de inference). Cero LLM-as-a-Service externo en cualquier capa de razonamiento.
- **Construido en la ventana.** Código y consola Anthropic con mensajes fuera de la ventana no cuentan para B3.
- **Cero re-identificación de datasets.** No intentar des-anonimizar PhishTank, URLhaus, CMF, Subtel.
- **Cero plagio.** Toda decisión arquitectónica documentada y defendible en Q&A.

## Anti-patrones (qué NO hacer)

- No inventar features en el pitch que no aparezcan en la demo (J1.4 cae si los jueces piden mostrarla).
- No mockear datos regulatorios — todos vienen de fuente oficial citable, validados por el citation validator (A6).
- No transferir una llamada solo porque el caller_id está whitelisted. V22 lo hace insuficiente; siempre exigir factor adicional.
- No confirmar al llamante el resultado de su shared word (oracle attack).
- No revelar al llamante si la persona protegida está en casa o disponible.
- No persistir transcripts plain ni shared words/KBA en plain text. **(En MVP, no persistir nada — punto.)**
- No omitir la notificación legal de grabación: en MVP/PoC vía checkbox obligatorio al subir audio + texto en onboarding PWA; en V2 con telefonía vía primer TTS.
- **No reintroducir Supabase, magic link, Web Push persistido, WhatsApp Cloud o SMS Twilio en el MVP** sin reabrir N20 con justificación. Si se agrega DB o auth, el demo deja de ser stateless y los Q&A "¿qué hacen con la PII?" / "¿cómo manejan cuentas?" abren superficie nueva.
- No agregar abstracciones especulativas; cada capa justifica su existencia.
- No commitear secrets ni `.env`. Sí `.env.example`.
- No `--amend` sobre commits compartidos.
- No respuestas largas a Marco si una corta resuelve.
- **No hacer test calls al API Anthropic antes del 6-mayo 00:00** — pueden activar la heurística de "consola con mensajes en ventana" en el lado equivocado.

## Recursos clave

**Datasets oficiales del Lab (`docs/EVENT/DATOS.md`):**
- **BCN API Ley Fácil:** https://www.bcn.cl/leyfacil — JSON con explicaciones ciudadanas. Clave para A1 sin jerga + A5 fuentes.
- **CMF Registro Prestadores Fintec:** https://www.cmfchile.cl — entidades autorizadas Ley 21.521.
- **CMF Alertas al público:** https://www.cmfchile.cl/portal/principal/613/w3-propertyvalue-43545.html
- **CMF Circulares y normativas** (PDF/HTML, scraping respetuoso 1 req/s).
- **PDI Cibercrimen:** https://www.pdichile.cl — boletines sobre vishing chileno y "cuento del tío 2.0".
- **Sernac Alertas:** https://www.sernac.cl — procedimientos de denuncia y alertas vigentes.
- **CSIRT Nacional:** https://www.csirt.gob.cl — boletines de incidentes.
- **Subtel:** https://www.subtel.gob.cl — asignación de numeración por operador, listas reportadas.
- **SII normativas** (Res. 113/2025, 114/2025 cripto): https://www.sii.cl
- **PhishTank:** https://phishtank.org — registro free.
- **URLhaus:** https://urlhaus.abuse.ch — API pública sin auth.
- **Banco Central API BDE** (series estadísticas): https://si3.bcentral.cl/Bdemovil/BDE

**Wiki y leyes:**
- **Wiki Legal Fintech (fuente canónica del evento):** https://fintech.benditaia.cl/es/wiki-legal
- **BCN textos completos:** https://www.bcn.cl/leychile
- **Leyes relevantes Línea 02:** 21.459 (delitos informáticos), 21.663 (ANCI/ciberseguridad — plazos CSIRT 3h/72h/15d), 21.521 (Fintech), 19.628 (datos personales vigente), 21.719 (nueva protección datos vigencia 1-dic-2026).

**Aliados de distribución (segmento adultos mayores):**
- **SENAMA** (Servicio Nacional del Adulto Mayor).
- **Fundación Las Rosas, Hogar de Cristo, gremios adulto mayor.**
- **CCAF** (Cajas de Compensación) para B2B2C.

**Créditos:** USD $50 en créditos Claude API por participante. Suficiente para sprint completo si Haiku lleva clasificación trivial y Opus se usa solo en post-call analysis.

## Decisiones de seguridad cerradas

Las decisiones N1–N21 están confirmadas y documentadas en `docs/SEGURIDAD.md` §31. Cualquier cambio requiere actualizar `SEGURIDAD.md` + memoria + revisión por pares. Resumen no exhaustivo:

- **N21 (2026-05-07) Switch STT a Groq Whisper Large v3 Turbo.** ElevenLabs Scribe v1 (5-15s para audio ≤60s) era ~30-40% del budget E2E; Groq Whisper Large v3 Turbo entrega <1s típico sobre el mismo input. Reformula N7 (STT pasa de Scribe a Groq Whisper). ElevenLabs sigue activa **solo para TTS** (`eleven_v3` en `scripts/render-scams.ts`). Misma categoría I/O sensorial — no toca la regla "Claude motor principal" ni la cascada agéntica. `.env.local` requiere `GROQ_API_KEY` (https://console.groq.com/keys, free tier suficiente para los ~9 calls del demo).

- **N20 (2026-05-06) Pivote Lean MVP/PoC.** "Algo funcional > arquitectónicamente correcto". Sin Twilio (Voice/SMS), sin Deepgram, sin DB (Supabase Postgres + pgvector + Storage), sin auth (magic link), sin Web Push persistido, sin WhatsApp Cloud, sin RAG vectorial Voyage. Servidor stateless, audio en memoria, fuentes en JSON estático, config demo hardcoded, render en pantalla. Reformula N9/N10/N11/N13/N15. Reemplaza N17, N18. Hace obsoletas para MVP el bloque de persistencia + RAG. Intactas: cascada agéntica completa, citation validator, PII redaction, threat model V1-V22.
- **N19 (2026-05-06) Pivote audio-first MVP.** Audios pre-grabados en lugar de llamadas en vivo. Reformula N1/N5/N11/N13. Reemplaza N2 (Twilio Voice→sin telefonía MVP), N3/N7 (Deepgram→ElevenLabs Scribe), N8 (Polly→ElevenLabs TTS), N9 (call forwarding→audio upload PWA). Hace obsoleta N12. Traslada canal de N10 (consentimiento). Phone-first vivo es V2.
- Política B (secretaria) por defecto + per-contact configurable (B/A/always_pass) — en MVP aplicada sobre `data/demo-config.json` hardcoded para María.
- FP-permissive: ante duda, "trátalo como sospechoso".
- Consentimiento legal: checkbox al subir audio + texto en onboarding (V2 = primer TTS); en MVP la marca no se persiste.
- Verdict (`fraud`/`suspicious`/`legit`) + severity (HIGH/MEDIUM/LOW) renderizado en pantalla. En V2 con telefonía: HIGH→hangup, MEDIUM→message, LOW→transfer.
- Identity Firewall multi-factor: caller_id + (shared word OR KBA) + cross-channel ack. AND, no OR. En MVP: motor de detección + challenge plan recomendado contra config demo (no ejecuta verificación en vivo).
- Bias defensivo explícito en Call Triage system prompt.
- Sin voice cloning detection (out of scope).
- PWA installable, no nativa.
- STT Groq Whisper Large v3 Turbo (post-N21) + TTS ElevenLabs `eleven_v3` (Marco tiene API key + suscripción).
