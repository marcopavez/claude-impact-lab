# Plan Vigía — capas, tracks técnicos y fallbacks

> **🔄 PIVOTE 2026-05-06 (N19) audio-first MVP.** El plan operativo vigente está en el **Anexo B** al final de este doc. El cuerpo principal abajo (§1 Capa Core con Twilio + Deepgram, §6 Track A telefonía, etc.) queda como **roadmap V2 + contexto histórico**. Para el MVP del Lab se eliminan: Twilio Voice + Media Streams, Deepgram, call forwarding GSM, TwiML, Polly Lupe, whisper.cpp Fly.io. Stack MVP: ElevenLabs Scribe (STT) + ElevenLabs TTS + audios pre-grabados subidos a la PWA. Slash command `/ultraplan` regenera el plan en vivo.

> **Filosofía:** capas concéntricas + tracks técnicos paralelos. Decisiones de scope tomadas en frío, no en caliente. Cada capa con Definition of Done binaria, cada componente con fallback explícito. **Mejor un Core impecable (audio-first cascada agéntica con citas validadas) que un Wow chambón.**
> **Restricción de la ventana:** todo código de aplicación y mensajes a la consola Anthropic deben estar dentro de la ventana de build (gate B3). Logística de submits y cronograma fino lo lleva Marco aparte; este doc es el plan técnico de implementación.
> **Foco del doc:** scope por capa + ruta crítica + DoDs binarias + fallbacks + decisiones congeladas + KPIs + Q&A defensivo.

---

## 0. Premisa de scope

Tres capas concéntricas. **Cerrar la capa N antes de pasar a N+1.** Si algo de la capa N se atasca > su timebox, se aplica el fallback documentado y se sigue. **Nunca** se interrumpe el progreso de la capa N para empezar la N+1.

| Capa | Nombre | Compromiso | Demo |
|---|---|---|---|
| **1** | **Core (Opción B — live screening)** | No negociable. Llamada en vivo con firewall. | En vivo |
| **2** | **Sólido (Opción A — post-call + PWA cuidador full)** | Alta probabilidad si Core cierra. | En vivo o pre-grabado limpio |
| **3** | **Wow (canales secundarios + Civic Intel)** | Stretch real solo si finalistas. | Pre-grabado / mock |

**Regla de oro:** mejor un Core impecable que un Wow chambón. La rúbrica v3.3 sub-check **B4 (demo end-to-end)** y **J3.1 (demo no crashea)** penalizan features rotas más de lo que premia features extras. Una llamada filtrada perfectamente es mejor que llamada + texto + imagen + dashboard todos a medias.

---

## 1. Capa Core — el MVP irrenunciable

### Alcance funcional

**Llamada en vivo end-to-end con firewall de identidad.** La llamada se desvía desde un celular real (Marco simula a María) hacia el DID Twilio chileno → Twilio Media Streams envía audio a backend → Deepgram transcribe en streaming → Call Triage (Sonnet 4.6) decide → Identity Verifier corre shared word + KBA + cross-channel WhatsApp → Vigía contesta vía Twilio Polly TTS → si pasa el firewall, transfiere; si no, toma mensaje y pushea al cuidador. Vishing Analyst (Opus 4.7 + extended thinking) corre en background con análisis post-call y citas regulatorias.

**Para el demo:** 3 llamadas de prueba pre-validadas:
1. **Cuento del tío** — "soy tu nieta, tuve un accidente". Esperado: hangup + push al cuidador con cita Ley 21.459.
2. **Banco oficial verificado** — "soy de BancoEstado". Esperado: lookup CMF, toma mensaje, no transfiere.
3. **Familiar real legítimo** — caller_id whitelisted + shared word correcta + WhatsApp ack. Esperado: transferencia limpia.

### Componentes técnicos

| Componente | Tecnología | Rol | Sub-check |
|---|---|---|---|
| **Twilio Programmable Voice + Media Streams** | DID Chile + WebSocket bidireccional µ-law 8kHz/20ms | Captura audio en vivo y reproduce TTS de respuesta. | A3, J2.4 |
| **Deepgram Nova-3 streaming** | WebSocket es-CL multi-acento | STT con interim transcripts <300ms. | — |
| **Twilio Polly Lupe-Neural TTS** | TwiML `<Say>` con `<prosody rate="slow">` | Voz neutra chilena, dicción para audiencia 65+. | A1 |
| **Call Triage Agent** | Claude Sonnet 4.6, latencia <2s p50, `tool_choice: {type:"tool", name:"decide_action"}` | Clasifica intent (`claim_family/bank/authority/service/unclear/obvious_scam_pattern`), decide siguiente paso. **Bias defensivo en system prompt.** | B1 |
| **Identity Verifier (sub-agente)** | Sonnet 4.6 con tools `shared_word_check`, `kba_random_question`, `cross_channel_whatsapp_ack` | Implementa el firewall multi-factor. | B1, B2 |
| **Vishing Analyst** | Claude Opus 4.7 + extended thinking (4000–8000 tokens), corre post-call en background | Análisis profundo, patrones cuento del tío, citas Ley 21.459 / Sernac / PDI. | B1, J3.4 |
| **Regulatory Translator** | Sonnet 4.6 + RAG sobre `mcp-wiki-legal` con `tool_choice: required` | Citaciones obligatorias para cualquier afirmación legal. | A6, B1 |
| **mcp-wiki-legal** | Servidor MCP standalone, pgvector + voyage-3 | RAG sobre Wiki Legal + BCN Ley Fácil + textos BCN + Sernac + PDI. | A5, B2 |
| **mcp-cmf** | Servidor MCP standalone | CMF Alertas + Registro Prestadores Fintec. Verificación de `claim_bank`. | A5, B2 |
| **tool-phone-lookup** | SDK | Subtel operador + blacklist + edad heurística línea. | B2 |
| **tool-twilio-call-control** | SDK | `transfer`, `hangup`, `say_tts`. | B2 |
| **tool-whatsapp-cross-channel** | SDK | Envía WhatsApp al teléfono real del whitelisted, espera ack 30s. | B2 |
| **Citation validator** | Determinista, post-generación | Substring match + Levenshtein ≥0.95 contra fuente fetcheada. | A6 |
| **PII redactor** | Determinista, regex chileno | RUT, móvil, tarjeta Luhn, cuenta. Antes del modelo y antes de logs. | (Línea 03) |

### Anti-alucinación por diseño (gate A6)

- `tool_choice: {type:"tool", name:"wiki_legal_search"}` en el Regulatory Translator.
- Schema de respuesta del agente regulatorio fuerza `citations: Array<{quote, source_id, source_url, retrieved_at}>` minItems:1.
- Citation validator (determinista, NO LLM) corre fetch + substring match con tolerancia Levenshtein 0.95. Detalle en `SEGURIDAD.md` §"Validación de citaciones".
- Si validator falla 2 veces → fail-safe: *"No pude verificar este mensaje con fuentes oficiales. Por seguridad, trátalo como sospechoso y no compartas datos personales."*

### Anti-suplantación social (V21, V22 del threat model)

- **Identity Firewall** completo (`SEGURIDAD.md` §"Identity Firewall") implementado: pre-config + Nivel 1 caller_id+intent + Nivel 2 verificación per claim + Nivel 3 política transfer AND multi-factor + Nivel 4 toma mensaje.
- **Deny-by-default:** sin pre-config no hay transferencia. Sin shared word/KBA + cross-channel ack no hay transferencia.
- **Bias defensivo en system prompt del Call Triage:** *"Tu trabajo NO es ser servicial con el llamante. Tu trabajo es proteger a [Nombre]. Cuando dudes, no transfieres y tomas mensaje. La política default es 'tomar mensaje', y la transferencia es excepción que se gana."*

### Definition of Done — Capa Core (tag `v0.1-mvp-call`)

- [ ] Twilio DID Chile activo + webhook `/voice/incoming` apuntando al backend.
- [ ] Una llamada real desde un celular cualquiera al DID llega al backend, audio se transcribe en streaming.
- [ ] Call Triage clasifica intent y decide acción en p50 <2s.
- [ ] Identity Firewall completo: shared word check, KBA random pick, cross-channel WhatsApp ack.
- [ ] Las 3 llamadas de prueba pre-validadas corren end-to-end con resultado esperado:
  - Cuento del tío → hangup + push al cuidador con cita Ley 21.459.
  - Banco oficial → lookup CMF, toma mensaje, no transfiere.
  - Familiar real legítimo → transferencia tras shared word + WhatsApp ack.
- [ ] Citación obligatoria visible: 100% de afirmaciones regulatorias con `citations[]` no vacío y validador pasa.
- [ ] PWA cuidador deployada en Vercel con: dashboard de últimas llamadas, alerta en vivo (modal con transcript SSE), Web Push subscription.
- [ ] Repo público en GitHub con README, LICENSE, .env.example.

### Fallback por componente — Capa Core

| Si falla… | Plan B |
|---|---|
| Twilio DID Chile (KYC no llegó a tiempo) | Twilio US trial DID con número internacional. Demo se hace marcando al US number. Narrativa: "número chileno se activa en 24h, demo va por US". |
| Deepgram (rate limit, billing surprise) | Switch a whisper.cpp local en Fly.io con modelo `large-v3`. Latencia sube a 1-3s pero funciona. |
| Twilio Polly Lupe-Neural | Twilio Amy o Mia genéricos. Pierde naturalidad pero funciona. |
| `mcp-wiki-legal` (servidor MCP standalone) | Misma RAG como tool del SDK. La narrativa baja a 1 MCP custom (`mcp-cmf`) — sigue cumpliendo B2. |
| `mcp-cmf` | Snapshot JSON estático en `packages/db/seeds/cmf-prestadores.json`, expuesto como tool SDK. |
| WhatsApp Cloud API (KYC Meta no llegó) | Cross-channel ack vía SMS Twilio. Narrativa "WhatsApp en producción, SMS en demo por compliance Meta". |
| Web Push API en algún navegador | WhatsApp Cloud API es redundante para alertas críticas. Cuidador igual recibe. |
| Vercel deploy | Demo desde localhost con backup video pre-grabado. |
| Cualquier cosa en vivo durante demo | Backup video pre-grabado de las 3 llamadas, sin transición visible. |

---

## 2. Capa Sólido — Opción A (post-call) + PWA cuidador full

### Alcance funcional

**Opción A — Análisis post-call sobre audio subido.** Caso de uso: el cuidador o un familiar recibió una grabación / nota de voz / voicemail de una llamada sospechosa antes de que Vigía existiera, o desde un canal donde Vigía no actuó. Sube el archivo a la PWA → Whisper local (whisper.cpp) o Deepgram batch transcribe → Vishing Analyst (Opus + extended thinking) analiza, cita, recomienda → respuesta multi-cita en la PWA + opción de generar denuncia Sernac.

**PWA cuidador completa:**
- Onboarding wizard 5 pasos (whitelist + shared word + KBA + WhatsApp + activación desvío).
- Dashboard con timeline de llamadas y feedback (legítima/sospechosa).
- Configuración full (whitelist editable, rotación shared word, KBA editable, política per-contacto).
- Alerta en vivo (modal con transcript SSE durante llamada activa).
- Export ARCO+ (Ley 21.719) en endpoint `/api/export`.
- Delete cuenta cascade en `/api/account DELETE`.

**Denuncia Builder.** Generación automática de borrador Sernac/PDI Cibercrimen pre-llenado con los datos de la llamada filtrada, citas regulatorias validadas, y siguiente paso. Descarga PDF/markdown.

### Componentes adicionales

| Componente | Tecnología | Rol | Sub-check |
|---|---|---|---|
| **Audio upload + STT batch** | whisper.cpp local Fly.io OR Deepgram batch | Transcribe audio subido por el cuidador. **No es agente, transcribe.** | — |
| **Vishing Analyst post-call (modo audio file)** | Opus 4.7 + extended thinking | Análisis profundo sobre transcript completo. Comparte código con el modo "background" del Core. | B1, J3.4 |
| **PWA full (4 pantallas)** | Next.js 15 + React 19 + Tailwind + shadcn + Supabase Auth | Onboarding, Dashboard, Configuración, Live. Detalle `SEGURIDAD.md` §"PWA cuidador". | A1, A3, J3.2 |
| **Denuncia Builder** | Sonnet 4.6 + templates Sernac/PDI | Genera borrador estructurado descargable. | A1 |
| **Citation validator post-generation** | Determinista | Mismo del Core. |
| **Set golden ampliado** | ≥35 inputs (`SEGURIDAD.md` §"Golden set adversarial") | Test reproducible documentado. | B4 |

### Definition of Done — Capa Sólido (tag `v0.5-solid`)

- [ ] Audio file upload corre end-to-end en ≤ 12s (Whisper batch + Opus + extended thinking + citation validator).
- [ ] Denuncia Builder genera PDF descargable con citas reales validadas.
- [ ] PWA Onboarding completo: las 5 pantallas funcionan, datos persisten en Supabase con RLS, primer push test al cuidador.
- [ ] PWA Dashboard muestra timeline de llamadas con audio playable y feedback button.
- [ ] PWA Configuración permite editar whitelist, rotar shared word, editar KBA, cambiar política per-contacto.
- [ ] PWA Live (modal SSE) muestra transcripts streaming durante llamada activa real.
- [ ] Endpoint `/api/export` genera ZIP con datos del cuidador (Ley 21.719 ARCO+).
- [ ] Endpoint `/api/account DELETE` cascade delete.
- [ ] Set golden ampliado a ≥35 inputs phone-first: ≥95% accuracy + 100% en bloques de seguridad (V21, V22, V17, V19).
- [ ] Multi-modelo declarado: logs muestran qué modelo respondió cada request (Haiku/Sonnet/Opus).

### Fallback por componente — Capa Sólido

| Si falla… | Plan B |
|---|---|
| whisper.cpp en Fly.io | Deepgram batch (mismo proveedor que streaming, una integración menos). |
| Vision pipeline (canal imagen — capa Wow) | Pre-cargado con respuesta cacheada en demo. |
| Opus 4.7 latencia >30s | Bajar `thinking.budget_tokens` o usar Sonnet 4.6 + chain of thought explícito. Sub-check J3.3 exige <30s. |
| Denuncia Builder PDF | Markdown descargable con copia pegable. |
| PWA Live modal SSE | Refresh manual del dashboard cada 5s. Pierde "wow" pero funciona. |

---

## 3. Capa Wow — diferenciación final (solo si finalistas)

### Alcance funcional

**Canales secundarios texto/imagen** — el cuidador puede reenviar a Vigía un SMS sospechoso o screenshot, y Vigía responde con análisis Phishing/Vision-OCR + citas. Para el segmento adultos mayores, este canal lo usa el cuidador, no la persona protegida (que ya está protegida por el firewall de llamadas).

**Civic Intel Dashboard mockeado.** Vista B2G para CMF/PDI/Sernac con tendencias agregadas anónimas: tipos de fraude por región, números reincidentes, picos por hora del día, casos por segmento. Datos sintéticos generados a partir del set golden + ruido realista.

**WhatsApp Cloud API integration completa.** Webhook handler que permite al cuidador interactuar con Vigía vía WhatsApp (no solo recibir alertas — también consultar análisis y reenviar contenido).

### Componentes adicionales

| Componente | Tecnología | Rol |
|---|---|---|
| **Phishing Analyst (canal texto)** | Sonnet 4.6 + tools PhishTank/URLhaus + mcp-cmf | Analiza SMS/URL reenviado por el cuidador. |
| **Vision pipeline (canal imagen)** | Sonnet 4.6 con `image` content blocks | OCR + extracción de entidad en una sola llamada. |
| **Civic Intel page** | Next.js + Recharts/Tremor | Dashboard B2G con datos sintéticos. |
| **WhatsApp webhook full** | Bun/Hono handler | Recibe mensajes del cuidador, dispara orquestador, responde. |

### Definition of Done — Capa Wow (tag `v1.0-demo-final`)

- [ ] Canal texto: el cuidador pega URL en la PWA, recibe veredicto Phishing + citas en <8s.
- [ ] Canal imagen: el cuidador sube screenshot, recibe análisis vision + citas Ley 21.521 si cripto-scam.
- [ ] Civic Intel Dashboard accesible en `/civic-intel`, deployado en Vercel.
- [ ] Mínimo 4 visualizaciones (heatmap regional, line chart 24h, bar chart por segmento, lista números top).
- [ ] WhatsApp webhook: cuidador interactúa con Vigía por WhatsApp para consultar mensajes sospechosos.

### Fallback por componente — Capa Wow

| Si falla… | Plan B |
|---|---|
| Civic Intel | Mockup estático en deck con screenshots de Figma. La narrativa "Civic Intel como fase 2" se sostiene. |
| WhatsApp Cloud API completa | Web Push + alertas básicas (capa Sólido) son suficientes para demo. |
| Canal imagen vision | Canal texto solo (URL + SMS). |

---

## 4. Explícitamente fuera de scope (decisión consciente)

- **App nativa Android/iOS.** PWA installable cumple. Roadmap V2.
- **Multi-idioma (es-MX, es-AR, en, pt).** Solo es-CL en MVP. Migrantes en V2.
- **Voice cloning detection.** Estado del arte cambiante, datos de referencia complejos. Decisión N4.
- **Captura de audio en background con app nativa.** Out of scope. Audio viene por Twilio Media Streams en server.
- **Multi-cuidador por persona protegida** (varios hijos coordinando). V2.
- **Streaming bidireccional con interrupciones naturales** (cuando Vigía está hablando y el llamante interrumpe). MVP usa turn-by-turn simple.
- **Persistencia de historial conversacional con PII.** PII es efímera por principio (TTL 24h + redacción).
- **Más de 7 fuentes regulatorias en RAG.** Cobertura suficiente para los casos del set golden.
- **Onboarding tutorial extenso para el cuidador.** Wizard 5 pasos lo cubre.
- **Integración FHIR/HL7 a registros médicos** (path B2B con cuidadores formales). V2 cuando justifique.
- **Análisis acústico real** (prosody/emotion detection con modelos especializados). MVP usa Sonnet leyendo el transcript con system prompt especializado.

---

## 5. Fase 0 — Pre-ventana (preparación, sin código de aplicación)

**Restricción dura:** NO code de aplicación. NO calls de prueba al API Anthropic. Solo planning, research, mockups, cuentas, docs. Sub-check B3 exige consola Anthropic con ≥3 mensajes EN LA VENTANA — calls antes no cuentan.

**Cuentas y keys (registrar; no emitir calls):**
- Anthropic API key (Sonnet 4.6 + Opus 4.7 + Haiku 4.5).
- **Twilio:** cuenta + KYC iniciado + DID Chile pre-comprado (puede tomar 1-2 días en activarse) + webhook target placeholder.
- **Deepgram:** cuenta + API key + crédito free tier USD 200.
- Supabase proyecto (Postgres + pgvector + Auth + Storage para audios temporales).
- Vercel proyecto.
- Fly.io proyecto (worker para whisper.cpp fallback).
- Voyage AI key (`voyage-3` embeddings).
- **WhatsApp Cloud API:** número Business + KYC Meta iniciado (toma 24-48h).
- PhishTank API key.

**Research operativo (sin codear):**
- Twilio Programmable Voice + Media Streams docs: TwiML `<Connect><Stream>`, formato µ-law 8kHz, WebSocket bidireccional.
- Deepgram WebSocket API: subscription, interim transcripts, language es-CL.
- Códigos GSM por operador chileno para call forwarding (`**21*`, `**61*`, `**67*`, `**62*`).
- BCN API Ley Fácil endpoint y formato JSON.
- CMF Alertas y Registro Prestadores Fintec scrapers.
- Wiki Legal Fintech estructura HTML para chunking RAG.
- Boletines PDI Cibercrimen y Sernac estructura.
- Subtel asignación de numeración por bloque a operadores.

**Diseño:**
- Sketches UI de la PWA del cuidador (Onboarding 5 pasos + Dashboard + Configuración + Live).
- Pitch deck draft (problema → demo en vivo → identidad firewall → tracción y visión → equipo).
- Lectura completa Wiki Legal Fintech + mapeo de chunks relevantes para RAG.

**Set golden draft (≥35 inputs phone-first):**
- 6 llamadas vishing puro (cuento del tío, Carabineros, BancoEstado, AFP, premio Caja, ISP).
- 4 llamadas legítimas (médico, hija titular, banco notificación, courier).
- 5 V21 suplantación social ("soy la nieta", etc.).
- 3 V22 caller-ID spoof matching whitelist.
- 3 V17 inyección audio en vivo.
- 2 V19 audio degradado.
- 4 SMS phishing.
- 3 SMS + inyección directa V1.
- 2 cripto-scam.
- 2 ARCO+ Ley 21.719.
- 1 encoding attack V14.

---

## 6. Tracks técnicos en la ventana

> Estos son **tracks técnicos**, no horarios. Se ejecutan en paralelo cuando la ventana se abre. La ruta crítica es Track A (telefonía + STT + TTS) porque sin eso no hay demo en vivo. Track B (agentes Claude) y Track C (PWA cuidador) corren en paralelo. Track D (RAG) bloquea Track B parcialmente.

### Track A — Telefonía y audio (RUTA CRÍTICA)

Owner: telephony.

1. **Infra inicial.** `git init` (commit "init"), monorepo (`apps/api` Bun+Hono, `apps/web-caregiver` Next.js 15, `packages/agents`, `packages/mcps`, `packages/db`, `packages/eval`). CI básico. **Primer call API Anthropic = abre B3.**
2. **Twilio webhook `/voice/incoming`.** Recibe POST de Twilio cuando entra llamada al DID Chile. Responde TwiML `<Connect><Stream url="wss://..."/></Connect>`.
3. **WebSocket relay backend.** Bun/Hono WebSocket server. Recibe frames µ-law 8kHz/20ms de Twilio Media Streams en una sesión. Hace bridge bidireccional con Deepgram (mismo formato).
4. **Deepgram WebSocket integration.** Subscribe a transcripts streaming es-CL. Emite interim + final transcripts via SSE al frontend de live.
5. **Twilio Polly TTS via TwiML.** Cuando Vigía decide responder, emite TwiML `<Say voice="Polly.Lupe-Neural"><prosody rate="slow">...</prosody></Say>` insertado en el stream.
6. **Test loop end-to-end:** llamada al DID → audio recibido → transcript visible → backend responde TTS → llamante escucha. Sin Claude todavía, solo ping/pong.
7. **Fallback whisper.cpp local en Fly.io.** Worker con modelo `large-v3.es` corriendo. API HTTP local que recibe chunks de audio y devuelve transcript. Documentado y listo para switch si Deepgram falla en demo.

### Track B — Agentes Claude (depende de Track A para test E2E)

Owner: agentes.

1. **Call Triage Agent (Sonnet 4.6).** Implementación con `tool_choice: {type:"tool", name:"decide_action"}`. System prompt copiado de `SEGURIDAD.md` §"Prompts canónicos" a `packages/agents/prompts/call-triage.md`. Bias defensivo aplicado. Canary token rotation per-request.
2. **Identity Verifier (Sonnet 4.6, sub-agente).** Tools: `shared_word_check`, `kba_random_question`, `kba_check`, `cross_channel_whatsapp_ack`, `decide_verification_outcome`. Hashing bcrypt server-side.
3. **Vishing Analyst (Opus 4.7 + extended thinking).** Background worker que se dispara post-call. Budget 4-8k tokens. Output schema con citations[] minItems:1 si verdict_kind regulatory.
4. **Regulatory Translator (Sonnet 4.6 + RAG).** `tool_choice: required` en `mcp_wiki_legal.search`. Citation validator post-generation determinista (substring + Levenshtein 0.95 sobre fuente fetcheada con cache 24h).
5. **Caregiver Notifier (Sonnet 4.6).** Tools: `tool_web_push.send`, `tool_whatsapp.send_message`, `tool_sms_twilio.send`. Severidad HIGH/MEDIUM/LOW.
6. **Phishing Analyst (Sonnet 4.6).** Canal secundario texto/imagen. Vision input para imágenes. Tools PhishTank, URLhaus, mcp-cmf.
7. **Denuncia Builder (Sonnet 4.6).** Templates Sernac/PDI/CMF. Output PDF/markdown.
8. **Classifier (Haiku 4.5).** Solo canal secundario texto. Output JSON estricto.
9. **Spotlighting + canary token + PII redactor + cost budgets + loop circuit breaker.** Aplicados en wrapper de cada agente.

### Track C — PWA Cuidador (paralelo a Tracks A y B)

Owner: frontend.

1. **Setup Next.js 15 + React 19 + Tailwind + shadcn/ui + Supabase Auth.** Magic link flow. RLS por `caregiver_id`.
2. **Pantalla 1 — Onboarding wizard (5 pasos).** Identidad cuidador → whitelist (mínimo 3) → shared word con generador → KBA con guía de buenas/malas preguntas → activación desvío con códigos GSM por operador chileno.
3. **Pantalla 2 — Dashboard.** Timeline de `CallSession`. Audio playable signed URL. Feedback button. Métricas agregadas.
4. **Pantalla 3 — Configuración.** Tabs: whitelist, shared word, KBA, notificaciones, persona protegida, cuenta. Endpoint `/api/export` (Ley 21.719 ARCO+) y `/api/account DELETE` (right-to-be-forgotten).
5. **Pantalla 4 — Live (modal SSE).** Transcript streaming en vivo durante llamada activa. Botones "tomar control" / "colgar" / "dejar que Vigía decida".
6. **PWA assets.** `manifest.ts` con icons 192/512/maskable, theme color, display standalone. Service worker para Web Push handling y cache UI shell.
7. **Web Push subscription + VAPID keys.** Persistencia en Supabase. Test push end-to-end al cuidador.
8. **WhatsApp Cloud API integration.** Webhook handler para alertas críticas. Send message via Cloud API.
9. **Skill `frontend-design` aplicada** para identidad visual: tipografía clara, paleta calmada profesional, microinteracciones útiles, sin look genérico AI.

### Track D — RAG y MCPs (bloquea parte de Track B)

Owner: data.

1. **Ingest scripts en `packages/db/ingest/`:**
   - Scrape CMF Alertas (1 req/s respetuoso).
   - Parse Wiki Legal Fintech HTML → chunks con metadata.
   - Fetch BCN Ley Fácil JSON (todas las leyes relevantes: 21.459, 21.663, 21.521, 19.628, 21.719).
   - Parse leyes BCN textos completos.
   - Parse alertas Sernac sobre estafas telefónicas.
   - Parse boletines PDI Cibercrimen sobre vishing.
   - Subtel numeración por operador (snapshot).
2. **Esquema pgvector** con tablas: `wiki_legal_chunks`, `bcn_leyfacil_chunks`, `leyes_chunks`, `cmf_alertas`, `sernac_alertas`, `pdi_cibercrimen_chunks`. Embeddings Voyage `voyage-3` batch.
3. **`mcp-wiki-legal` standalone server.** Tools: `search` (semantic), `lookup_law` (id), `lookup_alerta` (id). Cita resultado con `{quote, source_id, source_url, retrieved_at}`.
4. **`mcp-cmf` standalone server.** Tools: `lookup_entity(razon_social|rut)`, `search_alertas(keyword)`. Snapshot diario de Prestadores Fintec.
5. **Tools SDK:** `tool-phishtank`, `tool-urlhaus`, `tool-phone-lookup` (Subtel + heurística), `tool-twilio-call-control`, `tool-whatsapp-cross-channel`, `tool-web-push`, `tool-sms-twilio`, `tool-denuncia-build`. Schemas exportables a `packages/agents/tools-schema.json`.

### Track E — Quality (paralelo, depende de A+B+C+D para tests E2E)

Owner: quality.

1. **Set golden adversarial ≥35 inputs** en `packages/eval/golden/*.json`. Schema: `{id, input, expected: {verdict_in, must_cite_one_of, must_flag_si: bool}}`.
2. **Runner CI** que corre el set y bloquea release si <100% en bloques de seguridad (V21 suplantación social, V22 caller-ID spoof, V17 inyección audio, V19 anti-STT) o <90% accuracy general.
3. **Las 3 llamadas pre-validadas del demo** en CI: cuento del tío bloqueado, banco oficial toma mensaje, familiar real transferido.
4. **Citation validator standalone** en `packages/eval/citation-validator.ts` con tests unitarios contra fuentes mock + reales.
5. **Reasoning panel checks** que verifican que cada respuesta tenga tool calls, modelo declarado, citations clickeables, canary check pasado.

### Track F — Polish + entregables

Owner: producto.

1. **README en repo público** con: problema, solución, arquitectura, cómo correr local, decisiones tomadas, sección privacidad y dataflow (qué cruza a Twilio/Deepgram/Polly/WhatsApp/Supabase, retención de cada uno), licencia.
2. **Tools schema JSON exportado** en `packages/agents/tools-schema.json` (suma en M3 / declaración herramientas Anthropic).
3. **Screenshot consola Anthropic** mostrando uso real durante la ventana (gate B3).
4. **System prompts finales** en `packages/agents/prompts/*.md`.
5. **Demo video 3-5 min ≤100 MB.** Llamada en vivo real con call forwarding + las 3 llamadas pre-validadas + PWA cuidador en pantalla mostrando transcript SSE + decisión por nivel + push notification. Backup pre-grabado sin transición visible. Subtítulos español. Audio limpio.
6. **Pitch deck PDF** 10-12 slides en `docs/pitch.pdf`.
7. **Tags por hito:** `v0.1-mvp-call` (Core cierra), `v0.5-solid` (Sólido cierra), `v1.0-demo-final` (Wow si llega).

---

## 7. Dependencias y ruta crítica

```
                ┌──────────────────────┐
                │ Pre-ventana (cuentas)│
                └─────────┬────────────┘
                          │
                          ▼
                ┌──────────────────────┐
                │ Track A: Twilio +    │ ← RUTA CRÍTICA
                │ Deepgram + TTS E2E   │
                │ test loop ping/pong  │
                └─────────┬────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                  ▼
  ┌──────────┐     ┌─────────────┐    ┌──────────────┐
  │ Track D: │     │ Track B:    │    │ Track C:     │
  │ RAG +    │     │ Call Triage │    │ PWA          │
  │ MCPs     │ ──→ │ + Verifier  │    │ Onboarding+  │
  │          │     │ + Vishing+  │    │ Dashboard +  │
  └──────────┘     │ Regulatory+ │    │ Live SSE     │
                   │ Notifier    │    │              │
                   └──────┬──────┘    └──────┬───────┘
                          │                   │
                          └─────────┬─────────┘
                                    ▼
                          ┌──────────────────┐
                          │ Track E: Quality │
                          │ Golden set + CI  │
                          │ + 3 llamadas     │
                          │ pre-validadas    │
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │ Track F: Polish  │
                          │ + Demo video     │
                          │ + Tags           │
                          └──────────────────┘
```

**Bloqueos críticos:**
- Track B no puede testear E2E hasta que Track A tenga loop ping/pong.
- Track B Regulatory Translator + Vishing Analyst dependen de Track D (MCPs custom + RAG ingest).
- Track C puede avanzar mucho independiente, pero el Live modal SSE requiere Track A + Track B operativos.
- Track E requiere Tracks A+B+C+D para el set golden corriendo end-to-end.

**Punto de integración 1:** Track A loop ping/pong + Track B Call Triage stub → primera llamada al DID + decisión hardcoded "take_message" + TTS de respuesta. Confirma toda la cadena de audio antes de la lógica.

**Punto de integración 2:** Track A + Track B Call Triage real + Track D MCPs → primera decisión basada en intent detectado por Sonnet con tools reales.

**Punto de integración 3:** todo lo anterior + Track C Live modal SSE → demo end-to-end con PWA cuidador en pantalla.

**Punto de integración 4 (final):** todo + Track E set golden corriendo + Track F polish → tag `v0.1-mvp-call`.

---

## 8. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Twilio DID Chile demora en KYC | Media | Pre-comprar pre-ventana. Twilio US trial DID como backup demo. |
| Deepgram falla / rate limit | Baja | Switch a whisper.cpp local en Fly.io documentado y testeado. |
| WhatsApp Cloud API KYC Meta tarda | Alta | SMS Twilio como fallback declarado para alertas críticas. Web Push siempre funciona. |
| Cuotas LLM se agotan (USD 50 créditos) | Media | Cache agresivo en memoria. Pre-computar embeddings. Haiku para clasificación. Cost budget hard cap por request. |
| Alucinación regulatoria en demo | Baja con `tool_choice: required` + post-validator | Set golden pre-validado. Demo en vivo sobre las 3 llamadas pre-validadas, jamás ad-libitum. |
| Demo en vivo con Twilio falla | Media | Backup video pre-grabado de las 3 llamadas. Opción A (post-call sobre audio subido) como respaldo defensivo. |
| Latencia Triage > 3s p95 | Baja | Sonnet 4.6 con prompt corto + Deepgram interim transcripts. Si Opus va >25s en post-call, switch a Sonnet + CoT. |
| Equipo de 1-2 personas | Alta | Ruta crítica = Track A. Si recursos ajustados, Track Wow se pospone sin ceremonia. |
| Citation validator falsos negativos sobre fuentes con whitespace/OCR | Media | Tolerancia Levenshtein 0.95 + normalización NFKC + retry con feedback al modelo. |

---

## 9. Decisiones tomadas en frío (no se renegocian en caliente)

Esto es contrato del proyecto. Cualquier cambio requiere actualizar este doc + memoria + decisiones cerradas en `SEGURIDAD.md` §"Decisiones cerradas N1-N18".

1. **Canal principal = llamada en vivo con call forwarding desde celular real a DID Twilio.** Texto/imagen son canales secundarios para el cuidador.
2. **Identity Firewall multi-factor** (caller_id + shared word/KBA + cross-channel WhatsApp) es non-negotiable. La transferencia es excepción que se gana, deny-by-default.
3. **Política B (secretaria) por defecto + política configurable per-contacto.** `take_message_only` por default; `pass_after_verification` y `always_pass` opt-in.
4. **STT = Deepgram Nova-3 default + whisper.cpp local fallback.** TTS = Twilio Polly Lupe-Neural.
5. **PWA installable, no app nativa.** Cuidador configura, persona protegida no instala.
6. **Segmento único = adultos mayores 65+ Chile.** Multi-idioma migrantes en V2 explícito.
7. **Citación obligatoria por diseño** (`tool_choice: required` + schema + post-validator determinista).
8. **Consentimiento legal en primer TTS** ("esta llamada está siendo analizada para protección"). Línea 03 explícita.
9. **PII redaction antes del modelo, antes de logs, antes de embeddings.** Audios TTL 24h con signed URLs.
10. **No indexar contenido de usuario en pgvector.** Solo fuentes oficiales.
11. **Demo en vivo = una llamada real con call forwarding.** Backup video pre-grabado sin transición visible.
12. **Pitch ensayado mínimo 3 veces con cronómetro.** Si timing >3:10 en último ensayo, se recorta.
13. **Set golden adversarial ≥35 inputs phone-first** corre en CI antes de release. Bloquea si <100% en bloques V21/V22/V17/V19.

---

## 10. KPIs verificables en demo

Métricas concretas, medidas durante el demo, defendibles en Q&A:

- **Latencia Triage en vivo:** mediana < 2s, p95 < 3s. (J3.3 latencia <30s ✓ con margen amplio)
- **Latencia análisis post-call (Opus + extended thinking):** mediana < 12s, p95 < 20s.
- **Tasa de cita en respuestas regulatorias:** 100% (gate A6).
- **Aciertos en golden set adversarial:** ≥ 95% accuracy + 100% en bloques de seguridad (V21, V22, V17, V19).
- **Falsos negativos en bloque suplantación social V21:** **0** sobre el set golden.
- **Reducción del time-to-detection:** 72h → tiempo real durante la llamada. **El estafador nunca llega a la víctima.** (Métrica titular del pitch — J2.1)
- **Cero PII en logs:** 100% de los registros de telemetría con `pii_redacted: true`.
- **Cero canary leaks:** 0 ocurrencias del canary en outputs sobre el golden set.

---

## 11. Defensa para Q&A (anticipos)

| Pregunta probable | Respuesta defendible |
|---|---|
| *"¿Y si el estafador dice ser la nieta?"* | María nunca lo escucha. El firewall exige caller_id whitelisted + (shared word OR KBA) + cross-channel WhatsApp ack. Si falla cualquiera → toma mensaje + push al cuidador. Default deny. |
| *"¿Por qué Twilio y no SIM chileno?"* | SIM físico no es viable sin SIM gateway hardware (USD 200-500 + Asterisk). Twilio Media Streams es la única infra madura con audio bidireccional µ-law 8kHz vía WebSocket en setup minutos. SIP trunk chileno es roadmap producción. |
| *"¿Y si el jurado interpreta 'solo Claude' como Whisper también?"* | Switch a whisper.cpp local en Fly.io con modelo open source MIT. Argumento "no llamamos a OpenAI, corremos pesos open en nuestra infra" definitivo. Cambio toma horas, no días. |
| *"¿Voice cloning detection?"* | Out of scope MVP. Estado del arte cambiante, datos de referencia complejos. La defensa real para clonación de voz es factor de conocimiento (KBA + shared word, que no se clonan) + cross-channel out-of-band. Eso ya está. |
| *"¿Por qué PWA y no app nativa?"* | Cero fricción de distribución, no requiere App Store review. Add-to-Home-Screen indistinguible de app nativa. Web Push cubre alertas. Roadmap V2 a nativa cuando justifique capabilities (audio capture Android). |
| *"¿Qué pasa si el cuidador no está disponible?"* | Vigía decide según protocolo deny-by-default: si después de 30s sin respuesta del cuidador y el firewall no autorizó transferencia, toma mensaje y hangup. Default conservador. |
| *"¿Cómo escalan a 100k usuarios?"* | Twilio Voice escala horizontalmente. Backend stateless excepto Supabase. Costo por minuto Twilio + Deepgram + Claude Sonnet hace que el modelo de negocio funcione con USD 4-8/mes por persona protegida. |
| *"¿Por qué deny-by-default y no balanced?"* | Ver decisión 9.1 en `SEGURIDAD.md`. El costo de un falso negativo (estafa pasa) es terminal — pérdida económica + trauma + pérdida de confianza. El costo de un falso positivo (legítima va a buzón) es recuperable. Bias asimétrico justificado. |

---

## 12. Sub-checks operativos (matriz con evidencia y owner)

> **Fuente:** texto literal de la rúbrica en `docs/EVENT/RUBRICA.md`. Score final = **40% mentor + 60% juez**.
> **Función:** convertir los 22 sub-checks abstractos en evidencia accionable, con owner y artefacto entregable. "Definition of done" maestro y contrato interno de calidad.
> **Convención:** cada sub-check es **binario** (cumple/no cumple). No hay grises.

### Fase 1 — Mentor (10 sub-checks, 40% del score)

Bendi (Haiku 4.5) pre-evalúa con evidencia → mentor confirma.

#### M1 — Problema y ciudadano (peso 20%)

| ID | Sub-check | Evidencia exigida | Dónde queda | Owner |
|---|---|---|---|---|
| **A1** | sin jerga | Ficha cívica + TTS de Vigía + responses en PWA legibles a nivel sexto básico. TTS con `<prosody rate="slow">` para audiencia 65+. Sin "MCP", "embeddings", "agéntico" ni jurídico denso. | `docs/PROYECTO.md` §1-9 + transcripts demo + system prompts en `SEGURIDAD.md` §"Prompts canónicos" | producto |
| **A2** | segmento específico | Adultos mayores 65+ Chile = 2.4M (INE 2026) + cifras Sernac/PDI vishing + penetración smartphone >70% en 65-74 (Subtel). | `docs/PROYECTO.md` §3 | producto |
| **A3** | canal concreto | **Llamada telefónica con call forwarding** desde celular real de la persona protegida a DID Twilio chileno. PWA cuidador (Next.js + manifest installable) deployada en Vercel pública. | `docs/PROYECTO.md` §6 + URL Twilio DID + URL Vercel | telephony + frontend |
| **A4** | impacto cuantificado | **Tiempo detección 72h → tiempo real durante la llamada.** El estafador nunca llega a la víctima. Cifras adicionales: denuncias Sernac/PDI vishing por año. | `docs/PROYECTO.md` §2 + slide del deck | producto |

#### M2 — Datos responsables (peso 20%)

| ID | Sub-check | Evidencia exigida | Dónde queda | Owner |
|---|---|---|---|---|
| **A5** | ≥2 fuentes regulatorias | ≥7 fuentes oficiales conectadas: Wiki Legal Fintech, BCN Ley Fácil, CMF Alertas, CMF Registro Prestadores Fintec, CSIRT, PDI Cibercrimen, Sernac, BCN textos completos, Subtel. | `mcp-wiki-legal` chunks + `mcp-cmf` snapshot + `docs/PROYECTO.md` §8 | data |
| **A6** | sin alucinaciones | `tool_choice: required` en Regulatory Translator + schema con `citations[]` minItems:1 + **citation validator determinista** (substring + Levenshtein 0.95 sobre fuente fetcheada). Si no hay fuente, literal "no encontré fuente". Set golden valida 0 alucinaciones. | `packages/agents/regulatory-translator.ts` + `packages/eval/citation-validator.ts` + `packages/eval/golden/regulatory.json` + `SEGURIDAD.md` §"Validación de citaciones" | agentes |

#### M3 — Uso de Claude + arquitectura agéntica (peso 35%)

| ID | Sub-check | Evidencia exigida | Dónde queda | Owner |
|---|---|---|---|---|
| **B1** | system prompt específico | **6+ system prompts dedicados** por agente (no genéricos): Call Triage (con bias defensivo), Identity Verifier, Vishing Analyst (Opus + extended thinking), Regulatory Translator (`tool_choice: required`), Caregiver Notifier, Phishing Analyst, Denuncia Builder, Classifier. Cada uno con rol, tools, política de citación, output schema, canary, spotlighting. | `packages/agents/prompts/*.md` (borradores en `SEGURIDAD.md` §"Prompts canónicos") | agentes |
| **B2** | ≥2 tools válidas | **2 MCPs custom** (`mcp-wiki-legal`, `mcp-cmf`) + tools SDK: `tool-phone-lookup`, `tool-twilio-call-control`, `tool-whatsapp-cross-channel`, `tool-web-push`, `tool-sms-twilio`, `tool-phishtank`, `tool-urlhaus`, `tool-denuncia-build`. **≥10 tools, 2 MCPs custom.** Tools schema JSON exportable. | `packages/mcps/*` + `packages/agents/tools.ts` + `packages/agents/tools-schema.json` | MCPs |
| **B3** | consola con ≥3 mensajes en ventana | Pipeline phone-first genera **decenas de calls Anthropic por llamada** (Triage + Verifier + Vishing Analyst + Regulatory + Notifier + Denuncia). **Primer call API el 6-mayo 00:00 EXACTO**, ni un minuto antes. Screenshot consola Anthropic. | screenshot adjunto al entregable técnico | tech lead |

#### M4 — Funciona (peso 25%)

| ID | Sub-check | Evidencia exigida | Dónde queda | Owner |
|---|---|---|---|---|
| **B4** | demo video 3-5 min end-to-end | Video MP4 ≤100 MB, 3-5 min. **Demo principal: llamada en vivo real** (Marco activa desvío en su celular, compañero llama, Vigía contesta, jurado ve transcript SSE en pantalla + decisión por nivel del firewall + push a la PWA cuidador). Las 3 llamadas de prueba pre-validadas: cuento del tío, banco oficial, familiar real. **Backup pre-grabado sin transición visible.** Subtítulos. Audio limpio. | adjunto al entregable técnico | producto |

### Fase 3 — Juez (12 sub-checks, 60% del score, solo si Top 4 en Línea 02)

3 jueces en doble ciego, score = mediana de los 3.

#### J1 — Pitch (3 min + 2 Q&A) (peso 35%)

| ID | Sub-check | Evidencia exigida | Cómo lo aseguramos |
|---|---|---|---|
| **J1.1** | ≤3 min | Cronómetro en pitch ≤3:00. | 3 ensayos cronómetro mínimo. Recorte si >3:10 en último ensayo. |
| **J1.2** | ciudadano específico | María (78, Ñuñoa) en los primeros 30s. No abstracción. | Estructura fija: 0:00-0:30 = María; 0:30-2:00 = demo en vivo de llamada cuento del tío bloqueada; 2:00-2:45 = visión + tracción; 2:45-3:00 = cierre. |
| **J1.3** | cita fuente regulatoria | Mostrar en pantalla (PWA cuidador panel) la cita real durante el demo: Ley 21.459 art. fraude informático + alerta Sernac sobre cuento del tío 2.0 + boletín PDI Cibercrimen vishing. | Cita aparece en respuesta del Vishing Analyst + slide de cierre. Pre-validada con set golden. |
| **J1.4** | Q&A respondido | Las preguntas más probables tienen respuesta ensayada. **Top 1: "¿qué pasa si el estafador dice ser la nieta?" → respuesta vía Identity Firewall multi-factor.** | Red team interno previo: arquitectura, decisiones modelo, identity firewall, edge cases, costos, escalabilidad, privacidad, why Twilio, why Deepgram, why PWA. |

#### J2 — Impacto ciudadano real (peso 35%)

| ID | Sub-check | Evidencia exigida | Cómo lo aseguramos |
|---|---|---|---|
| **J2.1** | métrica concreta | **Tiempo detección 72h → tiempo real durante la llamada.** El estafador nunca llega a la víctima. + 2.4M adultos mayores 65+ Chile + cifras denuncias Sernac/PDI. | Slide 1 + cierre del pitch. Cifras con fuente citable. |
| **J2.2** | alcanzable | Adultos mayores 65+ accesibles (>70% smartphone). Distribución vía SENAMA realista. **Cero instalación para la persona protegida** (solo cuidador instala PWA). | Stakeholder identificado en `docs/PROYECTO.md` §7 + slide go-to-market. |
| **J2.3** | resuelve algo nuevo | **Único filtro de identidad multi-factor para llamada al adulto mayor en LATAM.** TrueCaller no autentica, apps de banco solo protegen propios, bloqueadores spam solo lista negra de números. | Tabla comparativa en deck + Q&A respaldado por `SEGURIDAD.md` §"Identity Firewall". |
| **J2.4** | canal realista | **Llamada telefónica con call forwarding** = penetración total Chile, accesible para 65+, nativo del operador chileno (Movistar/Entel/WOM/VTR), gratuito. **Cero instalación**. | Demo en vivo confirma operativo + `docs/PROYECTO.md` §6. |

#### J3 — Producto / demo en vivo (peso 30%)

| ID | Sub-check | Evidencia exigida | Cómo lo aseguramos |
|---|---|---|---|
| **J3.1** | demo no crashea | Demo en vivo completa al menos una llamada filtrada sin errores visibles. Si Twilio falla → backup video de las 3 llamadas pre-grabadas, sin transición visible. | 3 llamadas pre-validadas en CI. Backup video listo y proyectable sin anuncio. Opción A (post-call sobre audio subido) como respaldo defensivo si falla call forwarding en vivo. |
| **J3.2** | I/O visible | PWA cuidador en pantalla muestra: caller_id, intent detectado, transcript streaming SSE, decisión por nivel del firewall (caller_id → intent → factors → outcome), citaciones clickeables. | UI con reasoning panel siempre visible durante demo. Skill `frontend-design` aplicada para identidad visual. |
| **J3.3** | latencia <30s | Triage en vivo p50 <2s, p95 <3s. Análisis post-call (Opus + extended thinking) <12s p50. | Cost budget 30s wall-clock + Sonnet 4.6 con prompt corto + Deepgram interim transcripts <300ms. Si Opus va >25s, plan B con Sonnet + CoT. |
| **J3.4** | Claude evidente | PWA cuidador y reasoning panel declaran "Powered by Claude" + modelo usado + tokens en cada decisión. | UI muestra `Sonnet 4.6` / `Opus 4.7 + extended thinking` / `Haiku 4.5` en cada step del pipeline. |

### Resumen de status (a actualizar durante el sprint)

**Leyenda:** 🟢 cumplido · 🟡 en progreso · 🔴 pendiente · ⚫ bloqueado

| Sub-check | Status | Owner | Notas |
|---|---|---|---|
| A1 sin jerga | 🟡 | producto | revisar TTS de Vigía + respuestas demo |
| A2 segmento específico | 🟢 | producto | adultos mayores 65+ con cifras INE/Sernac/PDI |
| A3 canal concreto | 🟡 | telephony+frontend | Twilio DID activo + PWA Vercel |
| A4 impacto cuantificado | 🟢 | producto | tiempo real durante la llamada |
| A5 ≥2 fuentes regulatorias | 🟢 | data | 7 fuentes en RAG |
| A6 sin alucinaciones | 🟡 | agentes | citation validator determinista |
| B1 system prompt específico | 🟢 (borrador) | agentes | 6+ prompts en `SEGURIDAD.md` |
| B2 ≥2 tools válidas | 🟡 | MCPs | 2 MCPs custom + ≥8 tools SDK |
| B3 consola ≥3 mensajes en ventana | 🔴 | tech lead | NO ABRIR ANTES DE LA VENTANA |
| B4 demo video 3-5 min | 🔴 | producto | grabar al cierre del día 1 |

### Reglas críticas del evento (no son sub-checks, pero descalifican)

| Regla | Cómo lo cumplimos |
|---|---|
| **Claude motor principal** (otros LLMs base = descalificación) | Sonnet 4.6 + Opus 4.7 + Haiku 4.5 son las únicas decisiones de razonamiento. Deepgram solo STT, Twilio Polly solo TTS, Voyage solo embeddings — todos componentes I/O sensoriales no-LLM. |
| **Entregables completos** (sin ficha O sin entregable técnico → sin score) | Manejado por Marco (foco logístico fuera del scope técnico de este equipo). |
| **No re-identificar datasets** | PhishTank, URLhaus, CMF, Subtel se consultan tal cual; no se intenta des-anonimizar. |
| **Equipo domina lo que construyó** | Cada decisión arquitectónica documentada en `docs/`. Q&A ensayado pre-pitch con red team interno. |
| **Construido en la ventana** | `SEGURIDAD.md` §"Decisiones cerradas" + `feedback_build_window.md` en memoria. Primer call API el 6-mayo 00:00 exacto. |

### Desempates (cron Top 4 del 7-mayo 09:00 — referencial)

**Para entrar a finalistas:**
1. Score mentor (M1+M2+M3+M4) más alto.
2. Si empate → mayor M3 (uso de Claude).
3. Si empate → mayor M2 (datos responsables).
4. Si empate → mayor M1 (problema y ciudadano).
5. Si empate → timestamp más temprano del último entregable.
6. Si empate → voto del comité.

**Implicación operativa:** **M3 es el desempate más fuerte (35% peso + primer desempate).** Cualquier inversión que mejore M3 (B1 prompts más específicos, B2 más tools válidas, B3 más calls visibles en consola) tiene el mejor ROI. La cascada Triage + Verifier + Analyst + Regulatory + Notifier sostiene M3 generando decenas de calls por llamada y mostrando arquitectura agéntica real.

---

## Apéndice A — Producto final ideal (visión post-MVP)

> **Función:** snapshot del producto completo que las capas Core+Sólido+Wow describen + roadmap V2-V3. **Lo que se construye en el Lab es un MVP recortado** por restricción de tiempo (1 builder, ~12h hábiles, deadline técnico 6-mayo 20:00). Este apéndice queda como contrato del estado al que apuntamos en producción y como respaldo de Q&A: cuando el jurado pregunte "¿y esto?", se cita esta sección.

### A.1 Telefonía en vivo bidireccional

- **Twilio DID Chile** activo con KYC completo (no US trial).
- **Twilio Programmable Voice + Media Streams** con WebSocket bidireccional µ-law 8kHz/20ms.
- **Deepgram Nova-3 streaming** con interim transcripts <300ms; fallback `whisper.cpp` local en Fly.io.
- **Twilio Polly Lupe-Neural** vía TwiML `<Say>` con `<prosody rate="slow">` durante la llamada.
- **VAD bidireccional** que permite al llamante interrumpir naturalmente a Vigía.
- **Call forwarding GSM `**21*<DID>#`** desde celular real de la persona protegida — cero instalación en su lado.
- **SIP trunk chileno** como roadmap producción cuando volumen lo justifique (independencia de Twilio).

### A.2 Cascada completa de agentes (8)

- **Call Triage** (Sonnet 4.6, latencia <2s p50, bias defensivo).
- **Identity Verifier** (Sonnet 4.6 sub-agente con `shared_word_check` + `kba_random_question` + `cross_channel_whatsapp_ack`).
- **Vishing Analyst** (Opus 4.7 + extended thinking 4-8k tokens, post-call background).
- **Regulatory Translator** (Sonnet 4.6 + RAG con `tool_choice: required`).
- **Caregiver Notifier** (Sonnet 4.6 con tools web_push + whatsapp + sms).
- **Phishing Analyst** (Sonnet 4.6 + Vision para canal secundario texto/imagen).
- **Denuncia Builder** (Sonnet 4.6 + templates Sernac/PDI/CMF, output PDF).
- **Classifier** (Haiku 4.5 para clasificación trivial canal secundario).
- **Multi-modelo declarado y visible** en cada step del pipeline.

### A.3 MCPs custom + tools completas

- **`mcp-wiki-legal`** standalone server (pgvector + Voyage `voyage-3` embeddings) con tools `search`, `lookup_law`, `lookup_alerta`.
- **`mcp-cmf`** standalone server con tools `lookup_entity`, `search_alertas` sobre snapshot diario.
- **Tools SDK:** `tool-phone-lookup` (Subtel + heurística), `tool-twilio-call-control`, `tool-whatsapp-cross-channel`, `tool-web-push`, `tool-sms-twilio`, `tool-phishtank`, `tool-urlhaus`, `tool-denuncia-build`.
- Tools schema JSON exportable + spotlighting + canary token + PII redactor + cost budgets + loop circuit breaker en cada wrapper.

### A.4 PWA cuidador full

- **Onboarding wizard 5 pasos:** identidad → whitelist (mín 3) → shared word → KBA → activación desvío con códigos GSM por operador chileno.
- **Dashboard** con timeline `CallSession` + audio playable (signed URL TTL 24h) + feedback button + métricas agregadas.
- **Configuración** con tabs whitelist / shared word / KBA / notificaciones / persona protegida / cuenta + endpoints ARCO+ (`/api/export`, `/api/account DELETE`).
- **Live alerta** modal SSE durante llamada activa con botones "tomar control", "colgar", "dejar que Vigía decida".
- **Web Push API + VAPID** primario + **WhatsApp Cloud API** redundante para HIGH risk + **SMS Twilio** fallback.
- **Supabase Auth magic link** + RLS por `caregiver_id`.
- **Service Worker** + manifest installable + cache UI shell.

### A.5 RAG completo (≥7 fuentes)

Wiki Legal Fintech, BCN Ley Fácil, BCN textos completos (leyes 21.459 / 21.663 / 21.521 / 19.628 / 21.719), CMF Alertas + Registro Prestadores Fintec, Sernac alertas, PDI Cibercrimen boletines, CSIRT Nacional boletines, Subtel asignación numeración.

- **Citation validator determinista** (substring + Levenshtein 0.95 + normalización NFKC + cache 24h).
- **Set golden adversarial ≥35 inputs phone-first** corriendo en CI con threshold 100% en bloques V21/V22/V17/V19 y ≥90% accuracy general.

### A.6 Canales secundarios + Civic Intel

- **Canal texto** PWA + WhatsApp: cuidador reenvía SMS sospechoso, recibe veredicto con citas en <8s.
- **Canal imagen** PWA + WhatsApp: screenshot de SMS o app phishing, OCR + análisis Vision.
- **Civic Intel Dashboard B2G** para CMF/PDI/Sernac con tendencias agregadas anónimas (k-anonymity por región/segmento, hash sobre URLs/audios). Heatmap regional + line chart 24h + bar chart por segmento + lista números top.

### A.7 Privacidad y compliance Ley 21.719

- **PII redactor determinista** (RUT, móvil, tarjeta Luhn, cuenta) antes del modelo, antes de logs, antes de embeddings.
- **Audios y transcripts TTL 24h** con signed URLs.
- **Shared words y KBA bcrypt/argon2id** en reposo.
- **Endpoints ARCO+** funcionales (`/api/export` ZIP + `/api/account` DELETE cascade).
- **Notificación de brechas <72h** en runbook operativo.
- **Registro de actividades de tratamiento** documentado.

### A.8 Distribución y go-to-market

- **B2NGO** vía SENAMA, Fundación Las Rosas, Hogar de Cristo, gremios adulto mayor.
- **B2G** Civic Intel para CMF / PDI / Sernac / CSIRT (sustentabilidad + señal temprana).
- **B2B2C** integración con bancos cooperativos y CCAF (Cajas de Compensación).
- **Freemium** cuidador familiar (PWA básica gratis, multi-cuidador + exports médicos en plan pago).

### A.9 Roadmap V2-V3 fuera de visión MVP

- **App nativa Android/iOS** con captura de audio en background.
- **Multi-idioma** (es-MX, es-AR, en, pt) para segmento migrantes ~1.5M.
- **Voice cloning detection** cuando estado del arte madure y datasets de referencia estén disponibles.
- **Multi-cuidador por persona protegida** con coordinación entre hijos.
- **Integración FHIR/HL7** a registros médicos (path B2B con cuidadores formales).
- **Análisis acústico real** (prosody/emotion detection con modelos especializados).
- **Microempresarios** (~1.8M SII 2025) con vishing suplantando SII y proveedores.
- **Jóvenes 15-25** (~3M) con foco smishing y redes.

### A.10 Métricas de producto en estado ideal

- **Latencia Triage en vivo:** mediana <2s, p95 <3s.
- **Latencia post-call (Opus + extended thinking):** mediana <12s, p95 <20s.
- **Tasa de cita en respuestas regulatorias:** 100%.
- **Aciertos en golden set adversarial:** ≥95% + 100% en bloques de seguridad.
- **Falsos negativos en V21 suplantación social:** **0**.
- **Tiempo detección:** real-time durante la llamada (vs 72h pre-Vigía).
- **Cobertura de población protegida:** ≥10k personas año 1, ≥100k año 2.
- **Costo unitario:** USD 4-8/mes por persona protegida (Twilio + Deepgram + Claude Sonnet).

---

### A.11 Brecha MVP-Lab vs ideal (matriz explícita)

| Componente | MVP Lab (HOY) | Ideal (visión producción) | Gap a cerrar |
|---|---|---|---|
| **Telefonía** | Audio batch pre-grabado | Twilio Media Streams live + VAD bidireccional | DID Chile + KYC + WebSocket bidireccional + interrupciones naturales |
| **Cascada agentes** | 4 (Triage + Verifier + Regulatory + Vishing) | 8 (+ Notifier + Phishing + Denuncia + Classifier) | 4 agentes adicionales + canal secundario texto/imagen |
| **Tools** | 3 SDK + 1 MCP custom (`mcp-wiki-legal`) | 8 SDK + 2 MCPs custom | `mcp-cmf` standalone + 5 tools adicionales |
| **RAG** | 1 fuente (Wiki Legal) | 7+ fuentes con ingest scheduled | 6 ingest scripts + cron diario + reindexing |
| **PWA** | 1 pantalla pública (timeline mock + 3 reales) | 4 pantallas + auth + Web Push + endpoints ARCO+ | Wizard onboarding + Configuración + Live SSE + magic link + VAPID + Service Worker |
| **Notificaciones** | UI mock | Web Push + WhatsApp Cloud + SMS Twilio | VAPID setup + Meta KYC + templates aprobados + fallback chain |
| **Privacidad** | PII redactor mínimo regex chileno | Redactor + bcrypt/argon2id + TTL 24h signed URLs + ARCO+ + brechas <72h | Hashing en reposo + cascade delete + runbook operativo |
| **Quality** | 10-15 inputs golden | ≥35 inputs adversariales + CI threshold 100% bloques seguridad | 20+ inputs adicionales + GH Actions + bloqueo release |
| **Civic Intel** | No | Dashboard B2G con 4 visualizaciones | Página completa + agregación anónima + viz Recharts/Tremor |
| **Multi-canal** | Solo llamada simulada | Llamada + texto SMS + imagen | Phishing Analyst + Vision pipeline + WhatsApp webhook |
| **Demo** | Video pre-grabado 3-5 min | Live demo + video backup | DID activo + ensayos + 3 llamadas pre-validadas en CI |

**Defensa Q&A genérica:** *"Eso es parte del producto final descrito en `PLAN.md` Apéndice A. El MVP del Lab demuestra la lógica core (Identity Firewall + cascada de agentes + citación obligatoria) sobre audios pre-procesados; las capas live, multi-canal y B2G están en el plan ya escrito como continuación inmediata."*

---

# Anexo B — Plan operativo audio-first vigente (N19, 2026-05-06)

> **Estado:** este Anexo es la fuente de verdad operativa para el MVP. El cuerpo principal de PLAN.md queda como contexto histórico + roadmap V2. Si hay contradicción, gana este Anexo.

## B.1 Stack MVP (deltas vs. cuerpo principal)

| Capa | MVP audio-first (N19) | Antes (phone-first, V2) |
|---|---|---|
| Audio input | Audios pre-grabados subidos a la PWA (MP3/M4A/WAV ≤60s) | Twilio Voice + Media Streams µ-law 8kHz/20ms |
| STT | **ElevenLabs Scribe v1** batch (modelo `scribe_v1`) | Deepgram Nova-3 streaming + whisper.cpp Fly.io fallback |
| TTS | **ElevenLabs TTS** (generar 3 audios demo + opcional verdict hablado en PWA) | Twilio Polly Lupe-Neural via TwiML |
| Canal de adopción | Audio upload en PWA (cuidador sube audio sospechoso) | Call forwarding GSM `**21*<DID>#` desde celular real |
| Consentimiento legal | Checkbox al subir + texto onboarding PWA | Notificación en primer TTS de Vigía |
| Decisión por nivel | Verdict `fraud`/`suspicious`/`legit` + push severity HIGH/MEDIUM/LOW | HIGH→hangup, MEDIUM→message, LOW→transfer |
| LLM cascada | **Sin cambios:** Sonnet 4.6 + Opus 4.7 + Haiku 4.5 | igual |
| RAG / MCPs / DB / Push / Auth | **Sin cambios** | igual |

## B.2 Path crítico

```
[1. install web-push]
        ↓
[A. 3 audios demo ElevenLabs TTS]   [10. Supabase migrations + RLS + audio_uploads]
        │                                    │
        └────────────┬───────────────────────┘
                     ↓
        [B. ElevenLabs client wrapper (Scribe + TTS)]
                     ↓
        [C. /api/audio/process (POST audio → STT → cascada)]
                     ↓
        [7'. Call Triage post-STT, p50 <2s sobre transcript]
                     ↓
   [11. PII redactor]   [12. Citation validator NFKC + Levenshtein 0.95]
                     ↓
        [8'. Identity Verifier modo batch — challenge plan recomendado]
                     ↓
   [13. mcp-cmf snapshot]   [14. mcp-wiki-legal pgvector + Voyage]
                     ↓
        [15. Regulatory Translator (tool_choice: required, citations[] minItems:1)]
                     ↓
        [16. Caregiver Notifier + Web Push VAPID + WhatsApp + SMS fallback]
                     ↓
        [17. Vishing Analyst Opus 4.7 + extended thinking 4-8k tokens]
                     ↓
        [18'. PWA: manifest + iconos + SW + onboarding + dashboard + upload UI + alerta SSE]
                     ↓
        [19'. 3 audios E2E pre-validados]
                     ↓
                  tag v0.1-mvp-audio
```

## B.3 Capa Core revisada (`v0.1-mvp-audio`)

| # | Ítem | Δ | Sub-check | Esfuerzo |
|---|---|---|---|---|
| 1 | `npm install web-push @types/web-push` (twilio + deepgram fuera; ElevenLabs ya en `package.json`) | MOD | prereq | 0.1h |
| A | 3 audios demo con ElevenLabs TTS (cuento del tío / banco oficial / familiar legítimo, ≤60s c/u, voz es-CL) en `apps/web/public/demo-audios/` | NUEVO | A3, B4, J3.1 | 1h |
| 10 | Supabase migrations: `whitelists`, `shared_words` argon2id, `kba_questions`, `call_sessions`, **`audio_uploads`** (file_url signed, ttl 24h), índices pgvector, RLS por `caregiver_id` | MOD | A4, N18 | 1.5h |
| B | `apps/web/lib/clients/elevenlabs.ts` — `transcribeAudio(buf)` (Scribe v1) + `generateAudio(text, voiceId)` (TTS) | NUEVO | B2 | 0.75h |
| C | `apps/web/app/api/audio/process/route.ts` — POST audio (multipart o signed URL Supabase Storage) → STT → cascada agéntica → verdict | NUEVO | A3, B4 | 2h |
| 7' | Conectar Call Triage existente (`apps/web/lib/agents/call-triage.ts` + fix red team v2) al `/api/audio/process` post-STT | MOD | B1, B3 | 0.75h |
| 11 | PII redactor regex chileno (`apps/web/lib/validators/pii.ts`): RUT + móvil chileno + IBAN + tarjeta + dirección | igual | A4, A6 | 1h |
| 12 | Citation validator (`apps/web/lib/validators/citation.ts`) substring NFKC + Levenshtein 0.95 + retry 1× con feedback + fail-safe | igual | A6 | 1.5h |
| 8' | Identity Verifier **modo batch**: detecta claim de identidad en transcript + genera "challenge plan recomendado" (shared word + KBA + cross-channel) sin ejecutar en vivo. Activa N11+N13+N16 reformulados | MOD | B1, B2 | 1.5h |
| 9' | Tool wrappers SDK: `tool-whatsapp-cc` (send + poll ack), `tool-phone-lookup` (Subtel), `tool-shared-word-check`, `tool-kba-random-question`, `tool-sms-twilio` (fallback). **Eliminado** `tool-twilio-call-control` | MOD | B2 (≥2 tools) | 1h |
| 13 | `mcp-cmf` tool inline (`apps/web/lib/tools/mcp-cmf.ts`) — snapshot JSON Prestadores Fintec + Alertas | igual | B2, A5 | 1.5h |
| 14 | `mcp-wiki-legal`: ingest 5 fuentes (Wiki Legal Fintech + BCN Ley Fácil + Sernac + PDI + CSIRT) → embeddings Voyage `voyage-3` → pgvector + tool `mcp_wiki_legal.search` | igual | B2 (MCP custom), A5 | 3h |
| 15 | Regulatory Translator (Sonnet 4.6, `tool_choice: required` sobre `mcp_wiki_legal.search`, schema `citations[] minItems:1`) | igual | B1, A5, A6 | 1h |
| 16 | Caregiver Notifier + Web Push API VAPID + WhatsApp Cloud + SMS Twilio fallback | igual | B1, B2, A4 | 2h |
| 17 | Vishing Analyst (Opus 4.7 + extended thinking 4-8k tokens) — agente principal post-Triage. Multi-modelo en una sola corrida | MOD | B1 multi-modelo, B3, J3.4 | 1.5h |
| 18' | PWA: `manifest.json` + iconos 192/512 + SW + push subscribe + onboarding (whitelist + shared word + KBA + checkbox consentimiento) + dashboard (últimos audios con verdict) + **upload audio UI drag-and-drop** + alerta SSE + reproductor audio signed URL | MOD | A3, A1, N14 | 4h |
| 19' | 3 audios E2E pre-validados: cuento del tío→**fraud HIGH**, banco oficial→**suspicious MEDIUM** + lookup CMF, familiar legítimo→**legit LOW**. Cada uno con verdict + citations[] validadas + push al cuidador | MOD | B4, J1.3, J3.1 | 1h |

**Total Capa Core: ~24h** (vs. 27.75h del plan phone-first original). Entra en la ventana de ~20h con paralelización Tracks A+D+C en branches separados.

## B.4 Capa Sólido (`v0.5-solid`) — deltas

S1 absorbe el flujo principal (audio upload + post-call analysis). Capa Sólido suma: **batch processing de múltiples audios** (cuidador sube histórico), **comparación cross-audio** (mismo caller_id repetido = patrón sospechoso), Denuncia Builder PDF (S2), PWA Onboarding 5 pasos completo (S3), Configuración full (S4), Live SSE como progress streaming durante procesamiento (S5), endpoints ARCO+ Ley 21.719 (S6), golden set ≥35 (S7), multi-modelo en logs (S8). Total Sólido: ~16h.

## B.5 Capa Wow — sin cambios estructurales

W1 Phishing Analyst (texto), W2 Vision pipeline (imagen), W3 Civic Intel page, W4 WhatsApp webhook full. Total Wow: ~8.5h.

## B.6 Riesgos top actualizados

| Riesgo | Probabilidad | Mitigación inmediata |
|---|---|---|
| ~~Twilio DID Chile KYC~~ | eliminado (N12 obsoleta) | — |
| ~~Deepgram rate limit~~ | eliminado | — |
| ~~Demo Twilio crash en vivo~~ | eliminado; demo audio-first es radicalmente más estable | — |
| ElevenLabs Scribe latencia (5-15s sobre audio 60s) | baja | Pre-procesar los 3 audios demo en build time y cachear transcripts. Bajo umbral J3.3 (<30s). |
| Identity Firewall debilitado en narrativa | media | Defender en Q&A: *"el firewall en vivo es V2 con telefonía; MVP demuestra el motor de detección + challenge plan que alimenta ese firewall — los 35 casos del golden set lo validan en CI"*. Reformular pitch J1.2/J1.3. |
| Cuotas LLM USD 50 | media | Haiku en Classifier + cache embeddings + cost budget hard cap por sesión + circuit breaker de loops en cascada. |
| WhatsApp Cloud API KYC Meta | alta | SMS Twilio fallback ya declarado N17. Identity Verifier acepta SMS ack equivalente. |

## B.7 Próximas 3 acciones concretas

1. **Formalizar N19** — `/decision-record` con título *"Pivote audio-first MVP"* consolidando reaperturas N1, N2, N3, N5, N7-N11, N12 (obsoleta), N13. Sustenta defensa Q&A. **[Marco aprueba contenido].** [0.25h] — **YA HECHO en este commit**.
2. **Generar 3 audios demo con ElevenLabs TTS** — Marco redacta scripts (cuento del tío, banco oficial, familiar legítimo, ≤60s c/u, español neutro Chile), renderiza con voz es-CL, guarda en `apps/web/public/demo-audios/`. Sin esto no hay demo. [1h]
3. **Crear `apps/web/lib/clients/elevenlabs.ts`** — wrapper `transcribeAudio(buffer): Promise<{ text, language, duration }>` (Scribe v1 modelo `scribe_v1`) + `generateAudio(text, voiceId): Promise<Buffer>` (TTS). Smoke test: transcribir uno de los 3 audios. **Es el primer call API en ventana → activa sub-check B3.** [0.75h]

## B.8 Sub-checks: cómo cumplen en audio-first

| Sub-check | Cómo cumple en MVP audio-first |
|---|---|
| **A1 sin jerga** | Voz ElevenLabs es-CL en TTS opcional + UI PWA legible nivel sexto básico + transcripts redactados con PII out. |
| **A2 segmento** | Adultos mayores 65+ Chile (2.4M INE 2026). |
| **A3 canal concreto** | **PWA installable Vercel + audio upload** (drag-and-drop). Add-to-Home-Screen. |
| **A4 impacto cuantificado** | **Tiempo detección 72h → ~30s** (procesamiento Scribe ~10s + cascada ~15s + push ~5s). |
| **A5 ≥2 fuentes** | ≥7 fuentes via `mcp-wiki-legal` + `mcp-cmf` (BCN, CMF, Sernac, CSIRT, PDI, Subtel, SII). |
| **A6 sin alucinaciones** | `tool_choice: required` + schema `citations[] minItems:1` + post-validator determinista (substring NFKC + Levenshtein 0.95 sobre fuente fetcheada). |
| **B1 system prompts** | 6+ dedicados (Triage, Identity Verifier modo batch, Regulatory Translator, Vishing Analyst Opus, Caregiver Notifier, Phishing Analyst, Denuncia Builder, Classifier Haiku). |
| **B2 ≥2 tools válidas** | 2 MCPs custom (`mcp-wiki-legal`, `mcp-cmf`) + ≥7 tools SDK (whatsapp-cc, phone-lookup, web-push, sms-twilio, shared-word-check, kba-random-question, denuncia-build, phishtank, urlhaus). |
| **B3 ≥3 mensajes consola** | Pipeline genera ~10-15 calls por audio (Triage + Verifier + Regulatory + Vishing + Notifier + tools). 3 audios demo × 10 calls = 30+ mensajes en ventana. |
| **B4 demo end-to-end** | Subida en vivo de los 3 audios → cascada → verdict + push. Demo ultra-estable (sin telefonía = sin crash). |
