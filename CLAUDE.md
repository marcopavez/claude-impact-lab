# CLAUDE.md — Vigía (Claude Impact Lab 2026 · Chile)

## Misión
Construir un **detector de vishing con firewall de identidad** que protege a adultos mayores chilenos contra estafas telefónicas. **MVP audio-first (N19, 2026-05-06):** el cuidador o la persona protegida sube audios sospechosos en una PWA installable; Claude los analiza con una cascada agéntica (Call Triage → Identity Verifier → Regulatory Translator → Vishing Analyst Opus 4.7) y entrega verdict + citas regulatorias validadas + push al cuidador en ~30s. **Roadmap V2:** llamada en vivo con call forwarding GSM hacia DID Twilio Chile + Media Streams µ-law + decisión transfer/message/hangup en tiempo real.

Track de competencia: **Línea 02 — Ciberseguridad Ciudadana**. Por diseño cruza Línea 01 (traduce regulación a lenguaje ciudadano con citas obligatorias) y Línea 03 (consentimiento legal explícito vía checkbox al subir audio + texto en onboarding PWA, PII efímera con TTL 24h, derechos ARCO+ Ley 21.719 expuestos vía endpoints export/delete).

**Estructura de docs (3 archivos):** concepto + ficha cívica + arquitectura + decisiones + privacidad en `docs/PROYECTO.md`. Plan operativo (capas Core/Sólido/Wow + tracks técnicos + fallbacks + sub-checks operativos + KPIs + Q&A) en `docs/PLAN.md` — **Anexo B contiene el plan operativo audio-first vigente; el cuerpo principal queda como roadmap V2 + contexto histórico**. Threat model + identity firewall + PWA cuidador + prompts canónicos + golden set + decisiones cerradas N1-N19 en `docs/SEGURIDAD.md`. Texto literal de bases, rúbrica y datasets oficiales en `docs/EVENT/` — autoridad para cualquier disputa interna. Resúmenes para onboarding del equipo (10 min) en `RESUMEN/`. Slash command `/ultraplan` (`.claude/commands/ultraplan.md`) regenera el plan en vivo leyendo el repo.

## Principios no negociables

1. **Decisiones sólidas, no parches.** Antes de implementar algo no trivial, justifico técnicamente y pido alineamiento con Marco. Los hacks no sobreviven al red team del Q&A en vivo.
2. **Respuestas concisas y al hueso.** Cada respuesta a Marco fundamenta brevemente el "por qué" detrás del "qué". Sin paja, pero con justificación técnica explícita.
3. **Cita o calla.** Toda afirmación regulatoria del agente cita fuente oficial (Wiki Legal Fintech, BCN Ley Fácil, CMF, Sernac, CSIRT, PDI Cibercrimen, SII) o responde literal *"no encontré fuente para esta consulta"*. El sub-check **A6 (sin alucinaciones)** es binario. Aplicamos `tool_choice: required` + schema `citations[]` minItems:1 + post-validator determinista (substring + Levenshtein 0.95 sobre fuente fetcheada). Detalle `SEGURIDAD.md` §7.
4. **Deny-by-default en el firewall de identidad.** El llamante no toca a la persona protegida hasta ganarse el derecho. La transferencia es excepción, no default. Caller-ID solo NO basta — siempre exigir factor adicional (shared word/KBA + cross-channel ack). Detalle `SEGURIDAD.md` Parte II.
5. **PII al mínimo y efímera.** No persistimos RUT, datos bancarios ni transcripts plain. Redacción determinista regex chileno antes del modelo, antes de logs, antes de embeddings. Audios TTL 24h con signed URLs. Diseñado desde día 1 alineado con Ley 21.719 (vigencia 1-dic-2026).
6. **Consentimiento legal explícito.** En MVP audio-first: checkbox obligatorio al subir audio (*"el llamante fue notificado de esta grabación o la grabación fue obtenida bajo one-party-consent"*) + texto en onboarding PWA. En V2 con telefonía: notificación legal en el primer TTS de Vigía (*"esta llamada está siendo analizada para protección"*).
7. **Ventana de construcción sagrada.** Código de aplicación se commitea solo dentro de la ventana de build. Antes y después: solo planning docs en `docs/`. Sub-check **B3** exige consola Anthropic con ≥3 mensajes en ventana — primer call al API debe ocurrir el 6-mayo después de las 00:00, no antes.

## Stack (decidido, justificado)

| Capa | Elección | Por qué |
|---|---|---|
| LLM motor | **Sonnet 4.6** (Call Triage, Identity Verifier, Phishing, Regulatory, Denuncia, Notifier) + **Opus 4.7 + extended thinking** (Vishing Analyst post-call) + **Haiku 4.5** (Classifier secundario) | Sonnet 4.6 latencia/costo óptimo para llamada en vivo (<2s p50). Opus 4.7 con extended thinking en post-call donde latencia 10-30s es aceptable y un FN es máximo costo. Haiku para clasificación trivial. Multi-modelo declarado = bonus M3. |
| SDK | `@anthropic-ai/sdk` TypeScript | Mismo lenguaje frontend ↔ backend ↔ MCPs. Skill `claude-api` aplicable. |
| Patrón agéntico | Cascada **Call Triage → Identity Verifier → Vishing Analyst** con `tool_choice` forzado por agente. **MCPs custom** como tools de primera clase. | M3 mide arquitectura agéntica; cascada Triage rápido + Analyst lento es defendible y auditable. |
| Audio input MVP | **Audios pre-grabados subidos a la PWA** (drag-and-drop, MP3/M4A/WAV ≤60s). Twilio Voice + Media Streams = roadmap V2 | N19 (2026-05-06): el MVP no requiere telefonía. Cero infra telefónica, cero KYC DID Chile, cero WebSocket bidireccional. La cascada agéntica procesa el audio en ~30s y entrega verdict + push al cuidador. Phone-first vivo (call forwarding GSM + DID Twilio + Media Streams µ-law) defendido como V2 explícito. |
| STT | **ElevenLabs Scribe v1** batch (modelo `scribe_v1`) | Marco tiene API key + suscripción. Latencia 5-15s para audio 60s — bajo el umbral J3.3 (<30s) sub-check. Español multi-acento incluyendo Chile. NO Deepgram, NO whisper.cpp en MVP (eran del plan phone-first; whisper.cpp queda V2 si hace falta). |
| TTS | **ElevenLabs TTS** (voz es-CL) | Doble uso: (1) generar los 3 audios demo (cuento del tío / banco oficial / familiar legítimo, ≤60s c/u); (2) opcional reproducir verdict hablado en PWA para accesibilidad 65+. NO Twilio Polly (era plan phone-first). |
| RAG | **pgvector sobre Postgres (Supabase)** | Estándar. Free tier suficiente. RLS por `caregiver_id`. |
| Embeddings | **Voyage AI `voyage-3`** | Calidad alta para español, costo bajo, no acopla a otro LLM (mantiene Claude motor único). |
| Canal de adopción MVP | **Audio upload en PWA** (cuidador o persona protegida sube audio sospechoso recibido en su celular) | N19: cero instalación, cero KYC, cero hardware. La persona protegida deriva el audio al cuidador (WhatsApp/SMS) o lo sube directo a la PWA. **V2:** call forwarding GSM `**21*<DID>#` hacia DID Twilio Chile (operadores Movistar/Entel/WOM/VTR lo soportan nativamente). |
| PWA cuidador | **Next.js 15 + React 19 + Tailwind + shadcn/ui + Supabase Auth (magic link) + Web Push API + manifest installable** | Distribución cero fricción. Add-to-Home-Screen indistinguible de app nativa. Detalle `docs/SEGURIDAD.md` Parte III. |
| Push al cuidador | **Web Push API** (primario) + **WhatsApp Cloud API** (redundante para HIGH risk) + **SMS Twilio** (fallback si WhatsApp KYC tarda) | Web Push gratis y suficiente para LOW/MEDIUM. WhatsApp para HIGH risk porque siempre llega. SMS por si Meta KYC se atrasa. |
| MCPs custom | `mcp-wiki-legal` + `mcp-cmf` (servidores standalone) | Sostiene narrativa "MCP custom" sin sobre-ingeniar. Phone-lookup, PhishTank, URLhaus, Twilio-call, WhatsApp-cc, Web-push, Denuncia-build = tools del SDK. |
| Hosting | **Vercel** (PWA + edge functions + route handlers `/api/*`) + **Supabase** (DB pgvector + Auth magic link + Storage para audios) | Free tier para todos. Deploy en minutos. Demos públicas accesibles. Fly.io worker whisper.cpp queda V2 si se activa fallback. |

**Decisiones que NO tomamos (y por qué):**
- **Twilio Voice + Media Streams en MVP** → N19: KYC DID Chile incierto + complejidad WebSocket µ-law bidireccional vs. ventana ~20h. Audio-first preserva el valor (cascada agéntica + citation validator + Vishing Opus + push) sin riesgo telefónico. **Roadmap V2 explícito.**
- **Deepgram en MVP** → N19: ElevenLabs Scribe cubre el caso (batch sobre audio pre-grabado, no necesitamos streaming real-time). Marco tiene API key. Whisper.cpp/Deepgram = V2 si streaming live.
- **App nativa Android/iOS** → costo de App Store review + builds nativos > beneficio MVP. PWA installable cumple. Roadmap V2.
- **Voice cloning detection** → estado del arte cambiante, datos de referencia complejos. Defensa real para clonación = factor de conocimiento (KBA + shared word, no clonables) + cross-channel out-of-band. Eso ya está.
- **SIM card chileno físico** → no viable sin SIM gateway hardware (USD 200-500 + Asterisk) en sprint 48h.
- **Whisper de OpenAI** → conservador con la regla "Claude motor principal"; ElevenLabs Scribe es vendor neutro y cumple para batch.
- **Streaming bidireccional con interrupciones naturales** → no aplica MVP audio-first. V2 usaría turn-by-turn simple sobre Media Streams.
- **LangChain/LangGraph** → abstracción especulativa que estorba el Q&A.
- **GPT-4 / Gemini como motor** → **descalifica**.
- **Embeddings de OpenAI** → acoplamiento innecesario; Voyage `voyage-3` cumple.
- **Multi-idioma** → solo es-CL en MVP. Migrantes/multi-idioma en V2 explícito.
- **Multi-cuidador por persona protegida** → V2.

## Git & gitflow

- `main` → solo releases estables; merge desde `develop` en hitos (`v0.1-mvp-call`, `v0.5-solid`, `v1.0-demo-final`).
- `develop` → integración continua durante la sprint.
- `feat/<scope>` por feature, `fix/<scope>` por bug, `docs/<scope>` para documentación.
- **Conventional Commits en español:** `feat: call triage agent`, `fix: cita Sernac en respuesta de vishing`, `docs: identity firewall protocolo`.
- Tags al cierre de cada hito.
- Todo commit relevante DENTRO de la ventana. Si aparece commit fuera, se revierte o re-empaqueta.
- **Nunca** `--no-verify`, `--amend` sobre commits compartidos, ni `push --force` a `main`/`develop`.

## Cómo colaboramos (Marco ↔ Claude)

- **Antes de implementar** algo no trivial, propongo approach (qué, por qué, alternativas descartadas) y pido feedback.
- **Foco técnico:** Marco maneja logística del evento (entregables, deadlines, submits). Mi valor está en arquitectura, seguridad, componentes — no cronograma. Detalle en `feedback_focus_technical.md` de memoria.
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
| M2 Datos responsables | 20% | A5 ≥2 fuentes / A6 sin alucinaciones | ≥7 fuentes oficiales (Wiki Legal Fintech, BCN Ley Fácil, CMF, Sernac, CSIRT, PDI, Subtel) + `tool_choice: required` + schema citations[] minItems:1 + post-validator determinista. |
| M3 Uso de Claude + arquitectura agéntica | 35% | B1 system prompts / B2 ≥2 tools / B3 ≥3 mensajes consola | 6+ system prompts dedicados (`docs/SEGURIDAD.md` Parte IV); 2 MCPs custom + ≥8 tools SDK; pipeline audio-first genera ~10-15 calls por audio (Triage + Verifier + Regulatory + Vishing Opus + Notifier + tools). |
| M4 Funciona | 25% | B4 demo end-to-end | Demo principal: subida en vivo de los 3 audios pre-validados (cuento del tío, banco oficial, familiar legítimo) + cascada procesa + verdict + push al cuidador en pantalla. Demo ultra-estable (sin telefonía = sin riesgos KYC ni Twilio crash). |

**Resumen Juez (12 sub-checks, si finalistas):**

| Dim | Peso | Sub-checks | Cómo lo cumplimos |
|---|---|---|---|
| J1 Pitch | 35% | J1.1 ≤3 min · J1.2 ciudadano · J1.3 cita · J1.4 Q&A | María (78, Ñuñoa) → demo en vivo: cuidador sube audio del cuento del tío a la PWA → cascada detecta vishing + cita Ley 21.459 + Sernac → push al cuidador. Q&A red team con foco en "¿qué pasa si el estafador dice ser la nieta?" + "¿por qué no en vivo?". |
| J2 Impacto | 35% | J2.1 métrica · J2.2 alcanzable · J2.3 nuevo · J2.4 canal | 2.4M adultos mayores + cero instalación + B2NGO con SENAMA. Único motor de detección de vishing con citas regulatorias obligatorias en LATAM. Canal MVP: PWA + audio upload. **Roadmap V2 declarado:** llamada en vivo con call forwarding GSM. |
| J3 Demo en vivo | 30% | J3.1 no crashea · J3.2 I/O visible · J3.3 latencia · J3.4 Claude evidente | Demo audio-first ultra-estable (sin Twilio = sin crash en vivo). PWA cuidador muestra transcript Scribe + decisión por nivel + tools invocadas + modelo (Sonnet/Opus/Haiku). Latencia E2E <30s para audio 60s. |

**Selección:**
- Top 4 por vertical → 12 finalistas (cron 7-mayo 09:00 sobre score_mentor).
- Desempate: M3 > M2 > M1 > timestamp.
- 6 ganadores totales (2 por vertical).
- **M3 (35% peso + primer desempate) = inversión con mejor ROI.** La cascada Triage + Verifier + Analyst + Regulatory + Notifier + Denuncia sostiene M3 generando decenas de calls por llamada y mostrando arquitectura agéntica real.

## Reglas críticas (descalificadores y penalizaciones)

- **Claude motor principal.** Sin uso real verificado en consola Anthropic durante la ventana → descalificación. Otros LLMs como base → descalificados. **ElevenLabs Scribe solo STT, ElevenLabs TTS solo TTS, Voyage solo embeddings** — todos componentes I/O sensoriales no-LLM. Cero LLM-as-a-Service externo en cualquier capa de razonamiento.
- **Construido en la ventana.** Código y consola Anthropic con mensajes fuera de la ventana no cuentan para B3.
- **Cero re-identificación de datasets.** No intentar des-anonimizar PhishTank, URLhaus, CMF, Subtel.
- **Cero plagio.** Toda decisión arquitectónica documentada y defendible en Q&A.

## Anti-patrones (qué NO hacer)

- No inventar features en el pitch que no aparezcan en la demo (J1.4 cae si los jueces piden mostrarla).
- No mockear datos regulatorios — todos vienen de fuente oficial citable, validados por el citation validator (A6).
- No transferir una llamada solo porque el caller_id está whitelisted. V22 lo hace insuficiente; siempre exigir factor adicional.
- No confirmar al llamante el resultado de su shared word (oracle attack).
- No revelar al llamante si la persona protegida está en casa o disponible.
- No persistir transcripts plain ni shared words/KBA en plain text.
- No omitir la notificación legal de grabación: en MVP audio-first vía checkbox obligatorio al subir audio + texto en onboarding PWA; en V2 con telefonía vía primer TTS.
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

Las decisiones N1–N19 están confirmadas y documentadas en `docs/SEGURIDAD.md` §31. Cualquier cambio requiere actualizar `SEGURIDAD.md` + memoria + revisión por pares. Resumen no exhaustivo:

- **N19 (2026-05-06) Pivote audio-first MVP.** Reformula N1/N5/N11/N13. Reemplaza N2 (Twilio Voice→sin telefonía MVP), N3/N7 (Deepgram→ElevenLabs Scribe), N8 (Polly→ElevenLabs TTS), N9 (call forwarding→audio upload PWA). Hace obsoleta N12. Traslada canal de N10 (consentimiento). Phone-first vivo es V2.
- Política B (secretaria) por defecto + per-contact configurable (B/A/always_pass).
- FP-permissive: ante duda, "trátalo como sospechoso".
- Consentimiento legal: checkbox al subir audio + texto en onboarding (V2 = primer TTS).
- Verdict (`fraud`/`suspicious`/`legit`) + push severity (HIGH/MEDIUM/LOW). En V2 con telefonía: HIGH→hangup, MEDIUM→message, LOW→transfer.
- Identity Firewall multi-factor: caller_id + (shared word OR KBA) + cross-channel ack. AND, no OR. En MVP: motor de detección + challenge plan recomendado al cuidador.
- Bias defensivo explícito en Call Triage system prompt.
- Sin voice cloning detection (out of scope).
- PWA installable, no nativa. Supabase Auth magic link.
- STT ElevenLabs Scribe + TTS ElevenLabs (Marco tiene API key + suscripción).
- WhatsApp Cloud API redundante para alertas críticas + SMS Twilio fallback.
