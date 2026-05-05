# Sprint Vigía — plan operativo (phone-first)

> **Restricción técnica de la ventana:** todo código de aplicación y mensajes a la consola Anthropic deben estar dentro de la ventana de build (gate B3). Logística de submits y cronograma fino lo lleva Marco aparte; este doc es el plan técnico de implementación.
> **Foco del doc:** orden de tracks, dependencias entre componentes, puntos de integración críticos. No fechas/horas — el track técnico se ejecuta cuando la ventana se abre.

---

## Fase 0 — Pre-ventana (preparación, sin código de aplicación)

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

## Fase 1 — Tracks técnicos durante la ventana

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

1. **Call Triage Agent (Sonnet 4.6).** Implementación con `tool_choice: {type:"tool", name:"decide_action"}`. System prompt copiado de `docs/PROMPTS.md` a `packages/agents/prompts/call-triage.md`. Bias defensivo aplicado. Canary token rotation per-request.
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

## Dependencias y ruta crítica

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

## Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Twilio DID Chile demora en KYC | Media | Pre-comprar pre-ventana. Twilio US trial DID como backup demo. |
| Deepgram falla / rate limit | Baja | Switch a whisper.cpp local en Fly.io documentado y testeado. |
| WhatsApp Cloud API KYC Meta tarda | Alta | SMS Twilio como fallback declarado para alertas críticas. Web Push siempre funciona. |
| Cuotas LLM se agotan (USD 50 créditos) | Media | Cache agresivo en memoria. Pre-computar embeddings. Haiku para clasificación. Cost budget hard cap por request. |
| Alucinación regulatoria en demo | Baja con `tool_choice: required` + post-validator | Set golden pre-validado. Demo en vivo sobre las 3 llamadas pre-validadas, jamás ad-libitum. |
| Demo en vivo con Twilio falla | Media | Backup video pre-grabado de las 3 llamadas. Opción A (post-call sobre audio subido) como respaldo defensivo. |
| Latencia Triage > 3s p95 | Baja | Sonnet 4.6 con prompt corto + Deepgram interim transcripts. Si Opus va >25s en post-call, switch a Sonnet + CoT. |
| Equipo de 1-2 personas | Alta | Plan MVP-mínimo (sección 10 de `MVP-JUEVES.md`). Track A es el único irrenunciable. |
| Citation validator falsos negativos sobre fuentes con whitespace/OCR | Media | Tolerancia Levenshtein 0.95 + normalización NFKC + retry con feedback al modelo. |

---

## Definition of done por hito

### Tag `v0.1-mvp-call` (Core cierra)

- [ ] Twilio DID Chile activo + webhook `/voice/incoming` operativo.
- [ ] Llamada real al DID llega al backend, audio se transcribe en streaming, Vigía responde TTS.
- [ ] Call Triage clasifica intent y decide acción en p50 <2s.
- [ ] Identity Firewall completo: shared word check, KBA random, cross-channel WhatsApp ack.
- [ ] Las 3 llamadas pre-validadas corren end-to-end con resultado esperado.
- [ ] Citation validator: 100% de afirmaciones regulatorias con `citations[]` no vacío.
- [ ] PWA cuidador deployada con Onboarding + Dashboard + Live modal SSE.
- [ ] Repo público en GitHub con README + LICENSE + .env.example.

### Tag `v0.5-solid` (Sólido cierra)

- [ ] Audio file upload corre end-to-end en ≤12s (Whisper batch + Opus + extended thinking + citation validator).
- [ ] Denuncia Builder genera PDF descargable con citas reales validadas.
- [ ] PWA Onboarding completo + Dashboard + Configuración + Live: las 4 pantallas funcionan.
- [ ] Endpoint `/api/export` (ARCO+) + `/api/account DELETE`.
- [ ] Set golden ≥35 inputs phone-first: ≥95% accuracy + 100% en V21/V22/V17/V19.
- [ ] Multi-modelo declarado en logs y reasoning panel.

### Tag `v1.0-demo-final` (Wow si llega)

- [ ] Canal texto: cuidador pega URL, recibe veredicto Phishing + citas en <8s.
- [ ] Canal imagen: cuidador sube screenshot, recibe análisis vision + citas.
- [ ] Civic Intel Dashboard accesible en `/civic-intel` con ≥4 visualizaciones.
- [ ] WhatsApp Cloud API webhook completo bidireccional.
