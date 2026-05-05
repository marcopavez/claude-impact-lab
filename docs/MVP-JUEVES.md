# MVP — Vigía (capas concéntricas y fallbacks)

> **Filosofía:** decisiones de scope tomadas en frío, no en caliente. Cada capa tiene Definition of Done binaria; cada componente tiene fallback explícito. **Mejor un Core impecable (llamada en vivo filtrada) que un Wow chambón.**

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
- Citation validator (determinista, NO LLM) corre fetch + substring match con tolerancia Levenshtein 0.95. Detalle en `THREAT-MODEL.md` §7.
- Si validator falla 2 veces → fail-safe: *"No pude verificar este mensaje con fuentes oficiales. Por seguridad, trátalo como sospechoso y no compartas datos personales."*

### Anti-suplantación social (V21, V22 del threat model)

- **Identity Firewall** completo (`IDENTITY-FIREWALL.md`) implementado: pre-config + Nivel 1 caller_id+intent + Nivel 2 verificación per claim + Nivel 3 política transfer AND multi-factor + Nivel 4 toma mensaje.
- **Deny-by-default:** sin pre-config no hay transferencia. Sin shared word/KBA + cross-channel ack no hay transferencia.
- **Bias defensivo en system prompt del Call Triage:** *"Tu trabajo NO es ser servicial con el llamante. Tu trabajo es proteger a [Nombre]. Cuando dudes, no transfieres y tomas mensaje. La política default es 'tomar mensaje', y la transferencia es excepción que se gana."*

### Definition of Done — Capa Core

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
- [ ] Tag `v0.1-mvp-call`.

### Fallback por componente

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
| **PWA full (4 pantallas)** | Next.js 15 + React 19 + Tailwind + shadcn + Supabase Auth | Onboarding, Dashboard, Configuración, Live. Detalle `CAREGIVER-PWA.md`. | A1, A3, J3.2 |
| **Denuncia Builder** | Sonnet 4.6 + templates Sernac/PDI | Genera borrador estructurado descargable. | A1 |
| **Citation validator post-generation** | Determinista | Mismo del Core. |
| **Set golden ampliado** | ≥35 inputs (`THREAT-MODEL.md` §8) | Test reproducible documentado. | B4 |

### Definition of Done — Capa Sólido

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
- [ ] Tag `v0.5-solid`.

### Fallback por componente

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

### Definition of Done — Capa Wow (solo si finalistas)

- [ ] Canal texto: el cuidador pega URL en la PWA, recibe veredicto Phishing + citas en <8s.
- [ ] Canal imagen: el cuidador sube screenshot, recibe análisis vision + citas Ley 21.521 si cripto-scam.
- [ ] Civic Intel Dashboard accesible en `/civic-intel`, deployado en Vercel.
- [ ] Mínimo 4 visualizaciones (heatmap regional, line chart 24h, bar chart por segmento, lista números top).
- [ ] WhatsApp webhook: cuidador interactúa con Vigía por WhatsApp para consultar mensajes sospechosos.
- [ ] Tag `v1.0-demo-final`.

### Fallback por componente

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

## 5. Plan operativo (ejecución dentro de la ventana)

> Esta sección es contrato técnico interno, no del entregable. La logística del Lab la maneja el equipo aparte.

| Bloque | Owner | Salida |
|---|---|---|
| **Infra inicial** | tech | `git init`, monorepo (`apps/api` Bun+Hono + `apps/web-caregiver` Next.js 15, `packages/agents`, `packages/mcps`, `packages/db`, `packages/eval`). Supabase + Vercel + Fly.io provisioned. **Primer call API Anthropic = abre B3.** |
| **Twilio integration** | telephony | Webhook `/voice/incoming` con TwiML `<Connect><Stream>`. WebSocket relay para Media Streams. Twilio Polly TTS en TwiML. Test loop: llamada → backend recibe audio → backend responde TTS. |
| **Deepgram integration** | telephony | WebSocket relay backend → Deepgram. Interim transcripts en SSE al frontend de live. |
| **Ingest + RAG** | data | Scrape CMF Alertas, parse Wiki Legal HTML, fetch BCN Ley Fácil JSON, parse leyes BCN, parse alertas Sernac y boletines PDI. Embeddings `voyage-3` batch a pgvector. |
| **MCPs custom** | data | `mcp-wiki-legal` + `mcp-cmf` standalone con search + lookup_entity. Tool schemas exportables. |
| **Call Triage + Identity Verifier** | agentes | System prompts en `packages/agents/prompts/`. Implementación `tool_choice: {type:"tool", name:"decide_action"}`. Bias defensivo aplicado. |
| **Vishing Analyst (post-call background)** | agentes | Opus 4.7 + extended thinking budget 4-8k. Corre asíncrono después de cierre de llamada. Citas obligatorias. |
| **Regulatory Translator + Citation validator** | agentes | `tool_choice: required` + post-validator determinista con substring + Levenshtein 0.95 sobre fuente fetcheada. |
| **PWA cuidador (Onboarding + Dashboard)** | frontend | Auth Supabase magic link. 4 pantallas. Service worker. Web Push VAPID. Manifest con Add-to-Home-Screen. Skill `frontend-design` aplicada para identidad visual de alta calidad. |
| **WhatsApp Cloud API integration** | infra | Bot account verificada (KYC iniciado pre-ventana). Webhook handler. Send message para alertas. |
| **PII redactor + canary tokens + egress allow-list + cost budgets** | seguridad | Determinista. Aplicado en 3 puntos del pipeline. |
| **Tests + golden adversarial set** | quality | ≥35 inputs phone-first en `packages/eval/golden/`. Runner CI bloquea release si <100% en bloques de seguridad. |
| **E2E test + las 3 llamadas pre-validadas** | quality | Las 3 llamadas del demo corren end-to-end en CI. |
| **Polish + reasoning panel + reviews** | producto | Tag `v0.1-mvp-call` cuando Core cierra. `v0.5-solid` cuando Sólido cierra. `v1.0-demo-final` si Wow llega. |

---

## 6. Decisiones tomadas en frío (no se renegocian en caliente)

Esto es contrato del proyecto. Cualquier cambio requiere actualizar este doc + memoria + decisiones cerradas en `THREAT-MODEL.md` §9.

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

## 7. KPIs verificables en demo

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

## 8. Defensa para Q&A (anticipos)

| Pregunta probable | Respuesta defendible |
|---|---|
| *"¿Y si el estafador dice ser la nieta?"* | María nunca lo escucha. El firewall exige caller_id whitelisted + (shared word OR KBA) + cross-channel WhatsApp ack. Si falla cualquiera → toma mensaje + push al cuidador. Default deny. |
| *"¿Por qué Twilio y no SIM chileno?"* | SIM físico no es viable sin SIM gateway hardware (USD 200-500 + Asterisk). Twilio Media Streams es la única infra madura con audio bidireccional µ-law 8kHz vía WebSocket en setup minutos. SIP trunk chileno es roadmap producción. |
| *"¿Y si el jurado interpreta 'solo Claude' como Whisper también?"* | Switch a whisper.cpp local en Fly.io con modelo open source MIT. Argumento "no llamamos a OpenAI, corremos pesos open en nuestra infra" definitivo. Cambio toma horas, no días. |
| *"¿Voice cloning detection?"* | Out of scope MVP. Estado del arte cambiante, datos de referencia complejos. La defensa real para clonación de voz es factor de conocimiento (KBA + shared word, que no se clonan) + cross-channel out-of-band. Eso ya está. |
| *"¿Por qué PWA y no app nativa?"* | Cero fricción de distribución, no requiere App Store review. Add-to-Home-Screen indistinguible de app nativa. Web Push cubre alertas. Roadmap V2 a nativa cuando justifique capabilities (audio capture Android). |
| *"¿Qué pasa si el cuidador no está disponible?"* | Vigía decide según protocolo deny-by-default: si después de 30s sin respuesta del cuidador y el firewall no autorizó transferencia, toma mensaje y hangup. Default conservador. |
| *"¿Cómo escalan a 100k usuarios?"* | Twilio Voice escala horizontalmente. Backend stateless excepto Supabase. Costo por minuto Twilio + Deepgram + Claude Sonnet hace que el modelo de negocio funcione con USD 4-8/mes por persona protegida. |
| *"¿Por qué deny-by-default y no balanced?"* | Ver decisión 9.1 del threat model. El costo de un falso negativo (estafa pasa) es terminal — pérdida económica + trauma + pérdida de confianza. El costo de un falso positivo (legítima va a buzón) es recuperable. Bias asimétrico justificado. |
