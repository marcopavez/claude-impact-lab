# Vigía — Idea, arquitectura y mapeo a la rúbrica

> **Track de competencia:** Línea 02 — Ciberseguridad Ciudadana. Por diseño cruza Línea 01 (traduce regulación a lenguaje ciudadano) y Línea 03 (PII efímera, consentimiento legal de grabación, derechos ARCO+ Ley 21.719).

## Concepto en una frase

**Vigía es una secretaria inteligente con firewall de identidad** que protege a adultos mayores chilenos contra estafas telefónicas. Funciona vía desvío de llamadas desde el celular real de la persona protegida hacia un número Vigía, donde Claude analiza la llamada en tiempo real, verifica la identidad del llamante con un protocolo multi-factor, y decide si transferir, tomar mensaje o colgar — alertando al cuidador familiar por su PWA.

## Por qué esto, por qué ahora

- **Las estafas telefónicas a adultos mayores** son la categoría top de denuncias Sernac y PDI Cibercrimen en Chile en los últimos años. El "cuento del tío" mutó a la era smartphone (suplantación de bancos, Carabineros, SII, "tu nieto está detenido", premios Caja Los Andes).
- **2.4M adultos mayores 65+** en Chile (proyección INE 2026, 12% de la población). Penetración smartphone >70% en 65–74 años, >40% en 75+.
- **Cuando la víctima detecta el fraude, ya transfirió** — porque la decisión se tomó en una llamada de 3 minutos con presión emocional. Las alertas pasivas (CMF, banco) llegan tarde.
- **Las herramientas existentes no protegen al adulto mayor que recibe la llamada.** TrueCaller identifica números pero no analiza contenido, no aplica firewall de identidad, no entiende fraude chileno. Las apps de banco solo protegen a sus propios clientes. SENAMA distribuye material educativo que un adulto mayor no consume.
- **Existe la base regulatoria robusta** — Leyes 21.459 (delitos informáticos), 21.663 (ANCI/ciberseguridad), 21.521 (Fintech), 19.628 → 21.719 (datos personales). Falta la capa de IA que las traduzca a una respuesta accionable en el momento de la llamada.

**Vigía baja el tiempo de detección de 72 horas a tiempo real.** El llamante nunca llega a la víctima si no pasa el firewall.

## Diferenciador frente a lo existente

| Solución existente | Lo que le falta |
|---|---|
| **TrueCaller** | Identifica caller_id pero no analiza contenido en vivo, no autentica al llamante, no traduce regulación. |
| **Apps de bancos** | Solo protegen a clientes propios; el adulto mayor que recibe vishing del banco competidor está solo. |
| **SENAMA campañas educativas** | Educan en frío; cuando llega la llamada con presión emocional, la educación no alcanza. |
| **Bloqueadores de spam de operadores** (Movistar Aviso, etc.) | Solo bloquean por número en lista negra; no autentican llamadas de números desconocidos legítimos ni atrapan caller_id spoofeados que pasan los filtros. |
| **Voicemail tradicional** | Captura mensaje pero no analiza, no cita, no decide. |
| **HaloSafe** | Monitoreo familiar genérico, no análisis del contenido de la amenaza. |

**Vigía es lo que ninguno hace**: secretaria con razonamiento Claude + firewall de identidad multi-factor + citación obligatoria de fuente oficial + canal nativo (la llamada que la víctima recibe, sin instalar nada).

## Segmento

**Único en MVP — Adultos mayores 65+ en Chile.**

- Universo: ~2.400.000 personas (INE 2026).
- Canal natural: llamada telefónica al celular.
- Cuidador familiar (hijo/hija, 35–55 años) configura Vigía y recibe alertas.

Migrantes, microempresarios y jóvenes 15–25 quedan en **roadmap explícito**:
- **Migrantes (~1.5M):** requiere multi-idioma (es-MX, es-AR, en, pt). Posterior al MVP.
- **Microempresarios (+1.8M):** vishing suplantando SII, proveedores. Stack reusable, segmento V2.
- **Jóvenes 15–25 (~3M):** víctimas más por SMS/redes que llamada. Canal texto/imagen como capa secundaria del MVP los cubre parcialmente.

## User journey principal — María, 78, Ñuñoa

1. **Setup (5 min, una vez por la hija de María):** la hija crea cuenta en la PWA, agrega contactos a la whitelist (su propio número, la nieta Sofía, el médico), configura una palabra clave familiar y 3 preguntas KBA, conecta su WhatsApp Business para alertas. La PWA le entrega el número Twilio Vigía y le indica activar desvío incondicional en el celular de María (`**21*<numeroVigía>#`).

2. **Día normal — María recibe llamada de "Sofía" (nieta):**
   - La llamada va al desvío Twilio.
   - Vigía contesta: *"Hola, soy Vigía, asistente anti-fraude de María. Esta llamada está siendo analizada para protección. ¿Cuál es el motivo de su llamada?"*
   - Llamante: *"Hola abuela, soy Sofía, tu nieta. Tuve un accidente y necesito que me transfieras..."*
   - Call Triage (Sonnet 4.6) clasifica intent → `claim_family`. Caller_id NO está en whitelist (la verdadera Sofía sí está, con otro número).
   - Vigía: *"Antes de pasar contigo, ¿cuál es la palabra clave familiar?"*
   - Llamante evade: *"Ay no me acuerdo, pero es urgente, pásame con la abuela ya."*
   - Vigía aplica el firewall: caller_id no whitelisted + shared word fail + KBA fail + presión.
   - Vigía: *"María no puede atender ahora. Si quiere dejar un mensaje, soy Vigía y se lo entrego."* + cuelga al primer intento de presión.
   - **En paralelo:** Vishing Analyst (Opus 4.7 + extended thinking) corre análisis post-call, detecta patrón de cuento del tío + suplantación social, busca citas en `mcp-wiki-legal` (Ley 21.459 art. 7° fraude informático, alerta Sernac sobre cuento del tío 2.0).
   - Push al cuidador (Web Push + WhatsApp): *"📞 Llamada para María. Reclamó ser Sofía. Veredicto: 🚨 FRAUDE. Patrón de cuento del tío detectado. Audio 0:23."*

3. **Día normal — María recibe llamada de la nieta real:**
   - Caller_id matchea a "Sofía nieta" en whitelist con `policy: pass_after_verification`.
   - Vigía: *"Antes de pasar con María, ¿cuál es la palabra clave familiar?"*
   - Sofía: *"Quiltro feliz."* (la palabra del chiste interno).
   - Hash match. En paralelo, Vigía manda WhatsApp al teléfono real de Sofía: *"¿Estás llamando a tu abuela?"*. Sofía responde *"sí"* desde su WhatsApp.
   - Vigía transfiere: *"Listo, te paso con María."*

## Arquitectura

```
┌─────────────────────────────────────────────────────────────────┐
│   Celular de María (operador chileno: Movistar / Entel / WOM)   │
│   Configurado: desvío incondicional **21*<DID>#                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │ todas las llamadas entrantes
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│              DID Twilio Chile (+56 2 XXXX XXXX)                  │
│   Twilio Programmable Voice + Media Streams                      │
│   webhook /voice/incoming → TwiML <Connect><Stream>              │
└──────────────────────────┬──────────────────────────────────────┘
                           │ µ-law 8kHz / 20ms frames
                           ▼ WebSocket bidireccional
┌─────────────────────────────────────────────────────────────────┐
│           Backend Vigía (Vercel edge + Fly.io worker)            │
│                                                                   │
│   ┌──────────────────────────────────────────────────────────┐  │
│   │ Identity Firewall (deny-by-default)                       │  │
│   │  Nivel 1: lookup caller_id en whitelist + intent (Sonnet) │  │
│   │  Nivel 2: verificación según claim                        │  │
│   │  Nivel 3: política de transferencia AND multi-factor      │  │
│   │  Nivel 4: toma mensaje + push al cuidador                 │  │
│   └────────────────┬──────────────────────────────────────────┘  │
│                    │                                              │
│   ┌────────────────┴───────────┐  ┌──────────────────────────┐  │
│   │  Call Triage Agent          │  │ Identity Verifier         │  │
│   │  Sonnet 4.6, latencia <2s   │  │  Sonnet 4.6 (sub-agent)   │  │
│   │  decide_action tool          │  │  shared_word_check        │  │
│   │  bias defensivo en prompt    │  │  kba_random_question      │  │
│   └────────────────┬─────────────┘  │  cross_channel_whatsapp   │  │
│                    │                 └────────────────────────────┘  │
└────────────────────┼──────────────────────────────────────────────┘
                     │ paralelo
   ┌─────────────────┴────────┐  ┌──────────────────┐  ┌───────────────┐
   ▼                          ▼  ▼                  ▼  ▼               ▼
┌──────────────┐    ┌────────────────┐    ┌──────────────────────┐
│ Deepgram     │    │ Vishing Analyst│    │  TTS Twilio Polly     │
│ Nova-3       │    │ Opus 4.7 +     │    │  Lupe-Neural          │
│ STT streaming│    │ extended       │    │  prosody slow         │
│ es-CL        │    │ thinking       │    │  notif. consentimiento│
│              │    │ (post-call)    │    │  preguntas verif.     │
└──────────────┘    └────────┬───────┘    └──────────────────────┘
                             │
                             ▼ tool calls (todas con citation schema)
                  ┌────────────────────────────────────────────────┐
                  │ Tools                                            │
                  ├────────────────────────────────────────────────┤
                  │ • mcp-wiki-legal     RAG pgvector + voyage-3   │
                  │ • mcp-cmf            CMF Alertas + Prestadores │
                  │ • tool-phone-lookup  Subtel operador, blacklist│
                  │ • tool-phishtank     URL lookup                │
                  │ • tool-urlhaus       URL lookup                │
                  │ • tool-twilio-call   transfer/hangup           │
                  │ • tool-whatsapp-cc   cross-channel ack         │
                  │ • tool-web-push      alerta al cuidador        │
                  │ • tool-denuncia      Denuncia Builder template │
                  └────────────────────────────────────────────────┘
                             │
                             ▼
                  ┌────────────────────────────────────────────────┐
                  │ Postgres + pgvector (Supabase)                  │
                  │  • wiki_legal_chunks    (Wiki Fintech)         │
                  │  • bcn_leyfacil_chunks  (BCN API Ley Fácil)    │
                  │  • leyes_chunks         (textos BCN)           │
                  │  • cmf_alertas          (snapshot diario)      │
                  │  • sernac_alertas       (cuento del tío 2.0)   │
                  │  • pdi_cibercrimen      (boletines vishing)    │
                  │  • whitelists           (RLS por caregiver)    │
                  │  • shared_words (hash)                         │
                  │  • kba_questions (hash)                        │
                  │  • call_sessions        (TTL 24h, redacted)    │
                  │  • audio_storage        (TTL 24h, signed)      │
                  └────────────────────────────────────────────────┘
                             │
                             ▼ alertas redundantes
       ┌─────────────────────┴───────────────────────┐
       ▼                     ▼                        ▼
  ┌─────────────┐    ┌──────────────────┐     ┌───────────────┐
  │ Web Push    │    │ WhatsApp Cloud   │     │ SMS Twilio    │
  │ VAPID       │    │ API (HIGH risk)  │     │ (fallback)    │
  └─────────────┘    └──────────────────┘     └───────────────┘
                             │
                             ▼
                  ┌────────────────────────────────────────────────┐
                  │ PWA del Cuidador (Next.js 15 + RSC)             │
                  │  Onboarding · Dashboard · Configuración · Live  │
                  │  Auth: Supabase magic link                      │
                  └────────────────────────────────────────────────┘

───────────────────────────────────────────────────────────────────────
[Canales secundarios — texto/imagen, capa Wow]

┌─────────────┐   ┌────────────────────┐   ┌──────────────────────┐
│ Web chat    │   │ WhatsApp Cloud API │   │ Reenvío imagen/audio │
│ (cuidador)  │   │ (cuidador reenvía) │   │ (cuidador analiza    │
│             │   │                    │   │  SMS sospechoso)     │
└──────┬──────┘   └─────────┬──────────┘   └──────────┬───────────┘
       │                    │                         │
       └────────────────────┴─────────────────────────┘
                            │
                            ▼
                  ┌─────────────────────────────────┐
                  │  Phishing Analyst (Sonnet 4.6)  │
                  │  Vision (imagen) + URL analysis │
                  │  → mismas tools regulatorias    │
                  └─────────────────────────────────┘
```

## Stack y justificación

| Capa | Elección | Justificación |
|---|---|---|
| LLM motor | **Sonnet 4.6** (Triage, Phishing, Identity Verifier, Regulatory, Denuncia, Notifier) + **Opus 4.7 + extended thinking** (Vishing Analyst post-call) + **Haiku 4.5** (Classifier rápido) | Sonnet 4.6 mejor relación reasoning/latencia para llamada en vivo (<2s p50). Opus 4.7 con extended thinking en análisis post-call donde latencia 10-30s es aceptable y el costo de un FN es máximo. Haiku para clasificación trivial. Multi-modelo declarado = bonus M3. |
| SDK | `@anthropic-ai/sdk` TypeScript | Mismo lenguaje frontend ↔ backend ↔ MCP servers. Skill `claude-api` aplicable. |
| Patrón agéntico | Cascada Triage→Verifier→Analyst con `tool_choice` forzado por agente. MCPs custom como tools de primera clase. | M3 mide arquitectura agéntica; cascada Triage rápido + Analyst lento es defendible y auditable. |
| Telefonía | **Twilio Programmable Voice + Media Streams** | Único viable en sprint corta. Media Streams API entrega audio µ-law 8kHz / 20ms via WebSocket bidireccional — exactamente lo que necesitamos para latencia real-time. SIM chileno físico no es viable sin SIM gateway hardware (USD 200-500 + Asterisk). SIP trunk chileno como roadmap producción. |
| STT | **Deepgram Nova-3 streaming** (default) + **whisper.cpp local** (fallback declarado) | Deepgram: vendor neutro, latencia <300ms interim transcripts, español multi-acento incluyendo Chile, free tier USD 200. Si "solo Claude" se interpreta literal estricto, switch a whisper.cpp local en Fly.io con modelo MIT — argumento "no llamamos a OpenAI" definitivo. |
| TTS | **Twilio Polly Lupe-Neural** | Incluido en Twilio, integración trivial con TwiML, español neutro, `<prosody rate="slow">` para audiencia 65+. Cartesia Sonic como upgrade si latencia molesta. |
| RAG | pgvector sobre Postgres (Supabase) | Estándar. Free tier suficiente. RLS por `caregiver_id`. |
| Embeddings | **Voyage AI `voyage-3`** | Calidad alta para español, costo bajo, no acopla a otro LLM (mantiene Claude motor único — gate descalificación). |
| MCPs custom | `mcp-wiki-legal` + `mcp-cmf` (servidores standalone) | Sostiene narrativa "MCP custom" sin sobre-ingeniar. Phone-lookup, PhishTank, URLhaus son tools del SDK. |
| PWA cuidador | **Next.js 15 + React 19 + Tailwind + shadcn/ui + Supabase Auth + Web Push API** | Distribución cero fricción, Add-to-Home-Screen indistinguible de app nativa para demo. Detalle en `CAREGIVER-PWA.md`. |
| Hosting | **Vercel** (PWA + edge functions) + **Supabase** (DB+Auth+Storage) + **Fly.io** (worker STT si whisper.cpp) | Free tier para todos. Deploy en minutos. |

**Decisiones que NO tomamos (y por qué):**
- App nativa Android/iOS → costo de distribución (App Store review) > beneficio en demo. PWA installable cumple.
- Voice cloning detection → estado del arte cambiante, datos de referencia complejos, fuera de scope MVP.
- LangChain/LangGraph → abstracción especulativa que estorba el Q&A.
- GPT-4 / Gemini como motor → **descalifica**.
- Whisper de OpenAI → conservador con la regla "solo Claude"; Deepgram es vendor neutro.
- SIM card chileno físico → no viable sin SIM gateway hardware en sprint 48h. Twilio es el único path realista.
- Streaming Whisper en vivo en demo → Deepgram cumple este rol con latencia mejor.
- Captura de audio con app nativa Android → out of scope; el audio viene por Twilio Media Streams en server.

## Innovación (qué nadie hizo)

1. **Identity Firewall multi-factor para llamadas al adulto mayor.** Combinación caller_id whitelist + shared word + KBA + cross-channel WhatsApp ack. No es chatbot ni filtro de spam — es autenticación real para un escenario donde la víctima no puede aplicarla por sí misma.
2. **Deny-by-default en LLM helpful-by-training.** System prompt del Call Triage explícitamente revierte el sesgo helpful: el trabajo del agente NO es ser servicial con el llamante. Esto es ingeniería de prompts adversariales, no decoración.
3. **Cascada Triage rápido (Sonnet) + Analyst lento (Opus + extended thinking).** Latencia y costo optimizados por etapa.
4. **MCPs custom standalone** demostrando interoperabilidad real con el ecosistema MCP.
5. **Citación estructurada obligatoria** vía `tool_choice: required` + schema `citations[]` minItems:1 + post-validator determinista — anti-alucinación regulatoria por diseño, gate A6.
6. **Consentimiento legal de grabación incorporado en el primer TTS** — Línea 03 explícita, no checkbox de footer. *"Esta llamada está siendo analizada para protección"* satisface one-party-consent + notificación al llamante.
7. **PWA installable que separa cuidador (configura) de protegido (no instala nada)** — diseño de producto que respeta la realidad del segmento adultos mayores.

## Privacidad y compliance

- **Cero persistencia de PII por defecto.** Audios y transcripts viven 24h con TTL + signed URLs + redacción regex (RUT, tarjetas, cuentas) antes de logs. Detalle en `THREAT-MODEL.md` §5.4.
- **Consentimiento legal de grabación** en primer TTS — `THREAT-MODEL.md` §7.6.
- **Shared words y respuestas KBA hasheadas** (bcrypt/argon2id) en reposo.
- **Ley 19.628 vigente + Ley 21.719 (vigencia 1-dic-2026)** — diseñado para ARCO+ desde día 1: PWA expone export y delete. Notificación de brechas <72h definida en runbook.
- **No re-identificación** de PhishTank, URLhaus, CMF.
- **No indexamos contenido del usuario** en pgvector — solo fuentes oficiales. Elimina V5 (inyección indirecta).
- **Sin profiling individual.** Métricas analíticas agregadas y anónimas.

## Métricas de éxito

- **Llamada filtrada antes de tocar a la víctima:** 100% de las llamadas con `policy ≠ always_pass` pasan por el firewall antes de cualquier transferencia.
- **Latencia p50 Triage en vivo:** < 2s desde fin de frase del llamante hasta respuesta TTS de Vigía.
- **Latencia p95 Triage en vivo:** < 3s.
- **Tasa de cita en respuestas regulatorias:** 100% (gate A6).
- **Aciertos en golden set adversarial (≥35 inputs phone-first):** ≥95% accuracy + 100% en bloques de seguridad (V21, V22, V17, V19).
- **Falsos negativos en bloque suplantación social V21:** **0** sobre el set golden.
- **Tiempo de detección:** real-time durante la llamada (vs. 72h actuales post-fraude consumado).

## Stakeholders y go-to-market

| Stakeholder | Rol | Beneficio |
|---|---|---|
| **CMF** | Regulador | Reduce estadísticas de fraude; consume Civic Intel anónimo agregado. |
| **PDI Cibercrimen** | Operacional | Recibe señales de campañas vishing en tiempo real. |
| **Sernac** | Operacional | Recibe denuncias mejor estructuradas vía Denuncia Builder con citas regulatorias. |
| **CSIRT Nacional** | Operacional | Coordinación nacional bajo Ley 21.663 (plazos 3h/72h/15d). |
| **SENAMA / Fundación Las Rosas / Hogar de Cristo** | Distribución | Aliados naturales para llegar al segmento 65+. |
| **Subtel** | Regulador telecom | Datos sobre números reportados → consume y aporta al `tool-phone-lookup`. |
| **Cuidadores familiares** | Comprador / configurador | Pagan freemium para protección extendida (más whitelisted, multi-cuidador, exportes médicos). |

Modelo de adopción: **B2C cuidador** directo + **B2NGO** distribución vía SENAMA + **B2G** Civic Intel Dashboard a CMF/PDI/Sernac + **B2B2C** integración con bancos cooperativos para sus clientes 65+.

## Mapeo a la rúbrica v3.3 (sub-checks binarios — `docs/EVENT/RUBRICA.md`)

Score final = **40% mentor (10 sub-checks) + 60% juez (12 sub-checks, solo si Top 4)**. Detalle de evidencia en `SUB-CHECKS.md`.

### Fase Mentor (40% del score)

| Dim | Peso | Sub-check | Cómo lo cumplimos |
|---|---|---|---|
| **M1 Problema y ciudadano** | 20% | A1 sin jerga | Ficha cívica + TTS de Vigía con prosody slow + system prompts exigen sexto básico. |
| | | A2 segmento específico | Adultos mayores 65+ Chile = 2.4M (INE 2026) + cifras Sernac/PDI vishing. |
| | | A3 canal concreto | Llamada telefónica con call forwarding desde celular real (zero-install). PWA cuidador para configuración. |
| | | A4 impacto cuantificado | Tiempo detección 72h → tiempo real durante la llamada. Cifra titular adicional con denuncias Sernac/PDI. |
| **M2 Datos responsables** | 20% | A5 ≥2 fuentes regulatorias | Wiki Legal Fintech + BCN Ley Fácil + CMF + Sernac + CSIRT + PDI Cibercrimen + leyes 21.459/21.663/21.521. ≥7 fuentes. |
| | | A6 sin alucinaciones | `tool_choice: required` en Regulatory Translator + schema `citations[]` minItems:1 + validador post-generación con substring + Levenshtein ≥0.95 sobre fuente fetcheada. Detalle `THREAT-MODEL.md` §7. |
| **M3 Uso de Claude + arquitectura agéntica** | 35% | B1 system prompt específico | 6+ system prompts dedicados (Call Triage con bias defensivo, Identity Verifier, Vishing Analyst con extended thinking, Regulatory Translator, Denuncia Builder, Caregiver Notifier). Detalle en `PROMPTS.md`. |
| | | B2 ≥2 tools válidas | 2 MCPs custom (`mcp-wiki-legal`, `mcp-cmf`) + tools SDK (phone-lookup, phishtank, urlhaus, twilio-call, whatsapp-cc, web-push, denuncia). ≥7 tools. |
| | | B3 consola con ≥3 mensajes en ventana | Pipeline phone-first genera decenas de calls Anthropic por llamada (Triage + Verifier + Analyst + Regulatory + Notifier). Primer call API en la ventana. |
| **M4 Funciona** | 25% | B4 demo video 3-5 min end-to-end | Demo en vivo de llamada real (call forwarding + Twilio + firewall) con backup pre-grabado. Captura PWA cuidador. |

### Fase Juez (60% del score, si finalistas)

| Dim | Peso | Sub-checks | Cómo lo cumplimos |
|---|---|---|---|
| **J1 Pitch** | 35% | J1.1 ≤3 min · J1.2 ciudadano · J1.3 cita fuente · J1.4 Q&A | Estructura: María (78, Ñuñoa) → demo en vivo de llamada con cuento del tío bloqueado → cita Ley 21.459 + alerta Sernac → cierre. Q&A red team con foco en "¿qué pasa si el estafador dice ser la nieta?" — respondido por `IDENTITY-FIREWALL.md`. |
| **J2 Impacto** | 35% | J2.1 métrica · J2.2 alcanzable · J2.3 nuevo · J2.4 canal | 2.4M adultos mayores + cero instalación + B2NGO con SENAMA. Único filtro multi-factor de identidad para llamada en LATAM. Canal real: la llamada que ya recibe la víctima. |
| **J3 Demo en vivo** | 30% | J3.1 no crashea · J3.2 I/O visible · J3.3 latencia <30s · J3.4 Claude evidente | Backup pre-grabado sin transición visible. PWA cuidador muestra transcript streaming + decisión por nivel + tool calls + modelo. p50 Triage <2s. |

**Selección y desempate:**
- Top 4 por vertical → 12 finalistas (cron 7-mayo 09:00 sobre score_mentor).
- Desempate finalistas: M3 > M2 > M1 > timestamp.
- 6 ganadores (2 por vertical).
