# Vigía — proyecto

> 🔄 **Pivote N19 (2026-05-06) audio-first MVP.** Este documento describe la arquitectura completa **incluyendo el roadmap V2 phone-first vivo** (Twilio Programmable Voice + Media Streams µ-law + call forwarding GSM + Deepgram + Polly Lupe-Neural). El **MVP del Lab es audio-first**: el cuidador o la persona protegida sube audios sospechosos a la PWA y Vigía los analiza con la cascada agéntica. Para el plan operativo MVP vigente ver `docs/PLAN.md` Anexo B; para decisiones cerradas N1-N19 ver `docs/SEGURIDAD.md §31`. Las secciones 9 a 14 (arquitectura técnica, flujo de llamada, schema) describen la visión completa V2 — son contexto histórico + roadmap, no la implementación MVP.

> **Track de competencia:** Línea 02 — Ciberseguridad Ciudadana. Por diseño cruza Línea 01 (traduce regulación a lenguaje ciudadano con citas obligatorias) y Línea 03 (consentimiento legal explícito vía checkbox al subir audio + texto en onboarding PWA en MVP, primer TTS en V2; PII efímera con TTL 24h; derechos ARCO+ Ley 21.719 expuestos vía endpoints export/delete).
>
> **Doble función:** este documento es (a) la narrativa del proyecto y (b) la **ficha cívica oficial** que se submitirá según `docs/EVENT/BASES.md §4`. Las secciones 1 a 8 cumplen el formato exigido para los sub-checks A1–A5.

---

## Concepto en una frase

**Vigía es un detector de vishing con firewall de identidad** que protege a adultos mayores chilenos contra estafas telefónicas. **MVP audio-first (N19, 2026-05-06):** el cuidador o la persona protegida sube un audio sospechoso a la PWA, Claude lo analiza con una cascada agéntica (Triage → Identity Verifier → Regulatory Translator → Vishing Analyst Opus 4.7), y entrega verdict + citas regulatorias validadas + push al cuidador en ~30s. **Roadmap V2:** funciona vía desvío de llamadas (`**21*<DID>#`) desde el celular real de la persona protegida hacia un DID Twilio chileno, donde Claude analiza la llamada en tiempo real, autentica al llamante con un protocolo multi-factor (caller_id + palabra clave familiar + KBA + verificación cruzada por WhatsApp), y decide si transferir, tomar mensaje o colgar.

**Vigía baja el tiempo de detección de 72 horas a ~30s** (MVP audio-first) o **a tiempo real** (V2 con telefonía). El llamante nunca llega a la víctima si no pasa el firewall.

---

## 1. Línea temática

**Línea 02 — Ciberseguridad Ciudadana.**

Por diseño Vigía cruza la Línea 01 (traduce circulares CMF y leyes a lenguaje ciudadano con citas obligatorias) y la Línea 03 (consentimiento legal de grabación incorporado al diseño, PII efímera con TTL 24h, derechos ARCO+ que la Ley 21.719 entrega en diciembre 2026 expuestos vía endpoints export/delete de la PWA del cuidador). Compite formalmente solo en Línea 02.

---

## 2. Problema ciudadano

En Chile, las **estafas telefónicas son la categoría top de denuncia ciudadana** ante Sernac y PDI Cibercrimen. El "cuento del tío" se modernizó: hoy llega por celular, con suplantación de bancos, Carabineros, SII, AFP, o "tu nieto está detenido". Las víctimas mayoritarias son **adultos mayores 65+**, segmento de 2.4 millones de personas (proyección INE 2026).

El patrón es siempre el mismo: una llamada de 3 minutos con presión emocional, una cuenta extraña a la que transferir, y una víctima que descubre el fraude **horas o días después**, cuando el dinero ya fue retirado.

**Las herramientas existentes no llegan al adulto mayor que recibe esa llamada:**

| Solución existente | Lo que le falta |
|---|---|
| **TrueCaller** | Identifica caller_id pero no analiza contenido en vivo, no autentica al llamante, no traduce regulación. |
| **Apps de bancos** | Solo protegen a sus propios clientes; el adulto mayor que recibe vishing del banco competidor está solo. |
| **Campañas educativas SENAMA** | Educan en frío; cuando llega la llamada con presión emocional, la educación previa no alcanza. |
| **Bloqueadores de spam de operadores** | Bloquean por lista negra; no atrapan caller_id spoofeados ni autentican llamadas de números desconocidos legítimos. |
| **Voicemail tradicional** | Captura mensaje pero no analiza, no cita, no decide. |

**Existe la base regulatoria robusta:** Leyes 21.459 (delitos informáticos), 21.663 (ANCI/ciberseguridad), 21.521 (Fintech), 19.628 → 21.719 (datos personales). Falta la capa de IA que las traduzca a una respuesta accionable en el momento de la llamada.

---

## 3. Segmento (con datos demográficos)

**Segmento único MVP — Adultos mayores 65+ en Chile.**

- **Universo:** ~2.400.000 personas (proyección INE 2026, 12% de la población chilena).
- **Penetración smartphone:** >70% en el tramo 65–74 años, >40% en 75+ (Subtel 2024).
- **Por qué son la víctima principal:**
  - Mayor confianza en autoridad: una "llamada del banco" o "de Carabineros" no genera la suspicacia inmediata que generaría en un usuario digital nativo.
  - Menor familiaridad con UX digital y campañas de prevención que circulan por redes sociales (Instagram, TikTok), donde no están.
  - Aislamiento social: una llamada que dice ser de un familiar lejano genera apertura emocional inmediata.
- **Por qué llamada telefónica como canal:**
  - El celular ya es su canal natural de comunicación, **sin curva de aprendizaje**.
  - El desvío de llamadas es función estándar de operadores chilenos (Movistar, Entel, WOM, VTR), gratuita, configurable con un código GSM de 6-8 caracteres.
  - **Cero instalación, cero app a aprender, cero login**. Vigía se adapta al canal que ya usan.

**Cuidador familiar como configurador y receptor de alertas (rol funcional, no segmento competitivo):**
- Hijo/hija de la persona protegida, 35–55 años, alfabetizado digitalmente.
- Configura whitelist (familiares, médico, banco oficial), palabra clave familiar y preguntas KBA desde la PWA en 5 minutos.
- Recibe alertas por Web Push y WhatsApp cuando Vigía toma un mensaje.

**Roadmap explícito (V2, fuera de scope MVP):**
- **Migrantes (~1.5M, 8% de la población según INE).** Requiere multi-idioma (es-MX, es-AR, en, pt). Stack reusable.
- **Microempresarios (+1.8M según SII 2025).** Vishing suplantando SII y proveedores. Tools regulatorias compartibles.
- **Jóvenes 15–25 (~3M).** Más expuestos a smishing y redes que llamada. Cubiertos parcialmente por la capa secundaria texto/imagen del MVP.

---

## 4. Propuesta de valor

**Vigía es una secretaria inteligente con firewall de identidad para llamadas telefónicas, dedicada a proteger a adultos mayores chilenos de estafas.**

**Funcionamiento desde la mirada del usuario final:**

1. **Setup (5 min, una vez, lo hace el cuidador):** la hija/hijo crea cuenta en la PWA, agrega contactos a la whitelist (su número, la nieta, el médico de cabecera, el banco oficial verificado), define una palabra clave familiar y 3 preguntas personales, conecta su WhatsApp para recibir alertas. Activa el desvío de llamadas en el celular de la persona protegida con un código GSM.
2. **Día normal:** todas las llamadas entrantes a la persona protegida pasan primero por Vigía. La persona protegida deja de contestar — Vigía contesta por ella.
3. **Cuando llama un familiar real:** Vigía pide la palabra clave, verifica por WhatsApp que el familiar real esté llamando, y transfiere en menos de 10 segundos.
4. **Cuando llama un estafador haciéndose pasar por familiar:** Vigía pide la palabra, el estafador no la sabe, evade o presiona ("es urgente, pásame ya con la abuela"), Vigía cuelga y notifica al cuidador con el audio + transcripción + análisis legal (qué ley violó, cómo denunciar a Sernac/PDI).
5. **Cuando llama un banco/empresa/autoridad:** Vigía verifica contra registros oficiales (CMF Prestadores Fintec), aplica reglas duras (Carabineros/SII/PDI nunca piden dinero por teléfono), y siempre toma mensaje sin transferir.

**Lo que Vigía hace y nadie más hace:**

- **Firewall de identidad multi-factor** para autenticar al llamante (palabra clave familiar + pregunta personal + verificación cruzada por WhatsApp). Caller-ID solo no basta — es spoofeable trivialmente en Chile.
- **Razonamiento Claude en cada llamada en tiempo real**, no reglas duras. Detecta cuento del tío, presión emocional, suplantación de autoridad, lenguaje de urgencia.
- **Citación obligatoria de fuente oficial** en cada análisis legal. Si Vigía afirma "los bancos chilenos no piden claves por teléfono", lo respalda con cita literal de la CMF. Anti-alucinación por diseño.
- **Consentimiento legal de grabación incorporado al primer TTS** ("esta llamada está siendo analizada para protección"). One-party-consent satisfecho + notificación al llamante.
- **Cero instalación para la persona protegida.** La PWA del cuidador hace el setup; el celular de la persona protegida sigue siendo un celular normal.

**Diferenciador técnico defendible para Q&A:** la decisión de **no transferir** es deny-by-default. Aunque el llamante hable lindo y diga ser la nieta, Vigía no transfiere a menos que se cumplan las tres condiciones del firewall (caller_id whitelisted + palabra clave correcta + WhatsApp ack del familiar real). Es ingeniería de seguridad real, no chatbot helpful.

---

## 5. User journey — María, 78, Ñuñoa

### Setup (una vez, por la hija de María)

Camila (45, Ñuñoa, hija de María) crea cuenta en la PWA, agrega contactos a la whitelist:
- Su propio número (`policy: pass_after_verification`).
- Sofía, la nieta (`policy: pass_after_verification`).
- Dr. Pizarro, médico de cabecera (`policy: always_pass`).
- BancoEstado oficial (`policy: take_message_only`, lookup CMF activado).

Configura la palabra clave familiar `"quiltro feliz"` (chiste interno de la familia). Define 3 preguntas KBA: *"¿Cómo le decía María a la abuela cuando estaba molesta?"*, *"¿Qué postre prepara siempre María?"*, *"¿Cuál fue la primera mascota de la familia?"*. Conecta su WhatsApp Business para recibir alertas. La PWA le entrega el número Twilio Vigía y le indica activar desvío incondicional en el celular de María (`**21*<numeroVigía>#`).

### Día normal — María recibe llamada de un estafador

- La llamada va al desvío Twilio.
- Vigía contesta: *"Hola, soy Vigía, asistente anti-fraude de María. Esta llamada está siendo analizada para protección. ¿Cuál es el motivo de su llamada?"*
- Llamante: *"Hola abuela, soy Sofía, tu nieta. Tuve un accidente y necesito que me transfieras..."*
- **Call Triage (Sonnet 4.6)** clasifica intent → `claim_family`. Caller_id NO está en whitelist (la verdadera Sofía sí está, con otro número).
- Vigía: *"Antes de pasar contigo, ¿cuál es la palabra clave familiar?"*
- Llamante evade: *"Ay no me acuerdo, pero es urgente, pásame con la abuela ya."*
- Vigía aplica el firewall: caller_id no whitelisted + shared word fail + presión = `evasion_detected`.
- Vigía: *"María no puede atender ahora. Si quiere dejar un mensaje, soy Vigía y se lo entrego."* + cuelga al primer intento de presión.
- **En paralelo:** Vishing Analyst (Opus 4.7 + extended thinking) corre análisis post-call, detecta patrón de cuento del tío + suplantación social, busca citas en `mcp-wiki-legal` (Ley 21.459 art. 7° fraude informático, alerta Sernac sobre cuento del tío 2.0).
- Push al cuidador (Web Push + WhatsApp): *"📞 Llamada para María. Reclamó ser Sofía. Veredicto: 🚨 FRAUDE. Patrón de cuento del tío detectado. Audio 0:23."*

### Día normal — María recibe llamada de la nieta real

- Caller_id matchea a "Sofía nieta" en whitelist con `policy: pass_after_verification`.
- Vigía: *"Antes de pasar con María, ¿cuál es la palabra clave familiar?"*
- Sofía: *"Quiltro feliz."*
- Hash match. En paralelo, Vigía manda WhatsApp al teléfono real de Sofía: *"¿Estás llamando a tu abuela?"*. Sofía responde *"sí"* desde su WhatsApp.
- Vigía transfiere: *"Listo, te paso con María."*

---

## 6. Canal de adopción

**Mixto: B2C cuidador familiar + B2NGO distribución + B2G sustentabilidad + B2B2C expansión.**

- **B2C directo al cuidador familiar** vía PWA installable. El cuidador entra a una URL, login con magic link al email, configura en 5 minutos. La PWA queda instalada en su celular como ícono normal (Add to Home Screen funciona en Android Chrome y iOS Safari). La persona protegida (la abuela) no instala nada — solo activa el desvío de llamadas con un código GSM que su operador chileno acepta de forma estándar.
- **B2NGO** vía SENAMA, Fundación Las Rosas, Hogar de Cristo, gremios de adulto mayor. Estas organizaciones llevan Vigía a sus beneficiarios — la familia recibe la PWA, configura, y la abuela queda protegida.
- **B2G** Civic Intel Dashboard para CMF, Sernac y PDI Cibercrimen: tendencias agregadas y anónimas de campañas de vishing activas (qué guiones están circulando, qué números reincidentes, qué horas pico). Sin PII. La autoridad gana señal temprana, Vigía gana sustentabilidad.
- **B2B2C** integración con bancos cooperativos y CCAF (Cajas de Compensación) para proteger a sus afiliados 65+ como beneficio adicional.

**Para el demo en vivo del Lab:** una llamada real desde un celular a un DID Twilio chileno, con desvío configurado, y Vigía contestando en altavoz delante del jurado, con la PWA del cuidador proyectada mostrando transcript streaming + decisión por nivel del firewall. Backup video pre-grabado sin transición visible cubre el riesgo de fallo de Twilio en vivo (sub-check J3.1).

---

## 7. Stakeholders y go-to-market

| Stakeholder | Rol | Beneficio |
|---|---|---|
| **CMF — Comisión para el Mercado Financiero** | Regulador principal | Reduce estadísticas de fraude; consume Civic Intel anónimo agregado. Vigía consume sus alertas y el Registro de Prestadores Fintec (Ley 21.521). |
| **PDI Cibercrimen** | Operacional | Recibe en tiempo casi-real los patrones de "cuento del tío 2.0", suplantación de Carabineros y autoridad, y grabaciones consentidas con redacción de PII. |
| **Sernac** | Operacional | Recibe denuncias mejor estructuradas vía Denuncia Builder con la ley invocada, citas regulatorias y datos del caso ya organizados. |
| **CSIRT Nacional** | Operacional | Coordinación nacional bajo Ley 21.663 (plazos 3h alerta / 72h descripción / 15d informe). |
| **SENAMA / Fundación Las Rosas / Hogar de Cristo** | Distribución | Aliados naturales para llegar al segmento 65+. Una herramienta concreta y descargable que pueden ofrecer a sus beneficiarios y sus familias. |
| **Subtel** | Regulador telecom | Datos sobre números reportados como spam/fraude, con consumo y aporte vía `tool-phone-lookup`. |
| **Cuidadores familiares** | Comprador / configurador | Pagan freemium para protección extendida (más whitelisted, multi-cuidador, exportes médicos). |

---

## 8. Datos oficiales que consume

Todas las fuentes son **públicas y citables**, ninguna requiere convenio. La citación obligatoria es el mecanismo anti-alucinación del agente regulatorio (sub-check A6).

| Fuente | Uso en Vigía | Cumple |
|---|---|---|
| **Wiki Legal Fintech** — https://fintech.benditaia.cl/es/wiki-legal | Base RAG del agente regulatorio (chunks con embeddings vectoriales). | A5 fuente regulatoria #1 |
| **BCN API Ley Fácil** — https://www.bcn.cl/leyfacil | JSON con explicaciones ciudadanas de leyes 21.459, 21.663, 21.521, 19.628 — clave para responder en lenguaje claro durante el TTS de Vigía. | A5 fuente regulatoria #2 + A1 sin jerga |
| **CMF Alertas al público** — https://www.cmfchile.cl/portal/principal/613 | Snapshot diario de entidades no autorizadas y alertas de fraude. | A5 fuente regulatoria #3 |
| **CMF Registro de Prestadores Fintec** — https://www.cmfchile.cl | Verificación si una entidad que dice ser banco/financiera está autorizada bajo Ley 21.521. Llamado en `claim_bank` del firewall. | A5 |
| **PDI Cibercrimen** — https://www.pdichile.cl | Boletines sobre vishing chileno y "cuento del tío 2.0" — patrones canónicos para el Vishing Analyst. | A5 |
| **Sernac Alertas** — https://www.sernac.cl | Procedimientos de denuncia y alertas sobre estafas telefónicas vigentes. | A5 + acción del usuario |
| **CSIRT Nacional** — https://www.csirt.gob.cl | Boletines de incidentes y campañas activas en Chile. | A5 |
| **Subtel** — https://www.subtel.gob.cl | Asignación de numeración por operador + listas reportadas — usado en `tool-phone-lookup` para detección de caller_id spoof. | A5 |
| **PhishTank** — https://phishtank.org | Búsqueda de URLs reportadas como phishing (canal secundario texto). | Detección |
| **URLhaus** (abuse.ch) — https://urlhaus.abuse.ch | Búsqueda de URLs maliciosas activas (canal secundario texto). | Detección |
| **BCN — Biblioteca del Congreso Nacional** — https://www.bcn.cl/leychile | Textos oficiales completos de leyes 21.459 (delitos informáticos), 21.663 (ANCI/ciberseguridad), 21.521 (Fintech), 19.628 (datos personales vigente), 21.719 (nueva protección datos vigencia diciembre 2026). | A5 + Q&A jurado |

---

## 9. Compromiso con manejo responsable de datos personales

Vigía está diseñado desde el día uno bajo el principio **PII al mínimo y efímera**:

- **Audios y transcripts:** TTL 24h con signed URLs que expiran al cerrar el dashboard del cuidador. La grabación se hace con **consentimiento legal explícito incorporado al primer TTS de Vigía** ("esta llamada está siendo analizada para protección"), satisfaciendo Chile one-party-consent y notificando al llamante.
- **Redacción determinista de PII** (RUT chileno, móvil chileno, tarjeta con Luhn, cuenta bancaria heurístico) **antes** de logs, antes de embeddings, antes de cualquier persistencia. El modelo Claude analiza siempre `<RUT_REDACTED>`, no el valor real.
- **Shared words y respuestas KBA hasheadas** (bcrypt o argon2id) en reposo. Plain solo en memoria de la sesión activa.
- **No re-identificación** de PhishTank, URLhaus, alertas CMF, ni datos del Civic Intel Dashboard. El dashboard agrega y anonimiza con k-anonymity sobre región/segmento y hash sobre URLs/audios antes de mostrar.
- **No indexamos contenido del usuario en pgvector.** Solo indexamos fuentes oficiales (Wiki Legal, BCN Ley Fácil, CMF, leyes BCN, alertas Sernac, boletines CSIRT/PDI). Esto elimina por construcción la inyección indirecta vía RAG.

**Diseñado para Ley 21.719 (Nueva Ley de Protección de Datos), vigencia 1-dic-2026 — siete meses después del Lab:**

- **Derechos ARCO+** (Acceso, Rectificación, Cancelación, Oposición + Portabilidad + Bloqueo) por diseño: la PWA del cuidador expone endpoints `/api/export` (genera ZIP con todos los datos del cuidador y la persona protegida) y `/api/account DELETE` (cascade delete con right-to-be-forgotten).
- **Notificación de brechas <72h** definida en runbook operativo.
- **Registro de actividades de tratamiento** documentado en `SEGURIDAD.md` con flujos, fronteras de confianza y retención.
- **Sin profiling individual.** Métricas analíticas solo agregadas y anónimas (canal, veredicto, latencia, tools_used, model_used) sin PII.

Cruza Línea 03 explícitamente como diferenciador, no como checkbox.

---

## 10. Arquitectura

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

---

## 11. Stack y decisiones

| Capa | Elección | Justificación |
|---|---|---|
| **LLM motor** | **Sonnet 4.6** (Triage, Identity Verifier, Phishing, Regulatory, Denuncia, Notifier) + **Opus 4.7 + extended thinking** (Vishing Analyst post-call) + **Haiku 4.5** (Classifier rápido) | Sonnet 4.6 mejor relación reasoning/latencia para llamada en vivo (<2s p50). Opus 4.7 con extended thinking en post-call donde latencia 10-30s es aceptable y un FN es máximo costo. Haiku para clasificación trivial. Multi-modelo declarado = bonus M3. |
| **SDK** | `@anthropic-ai/sdk` TypeScript | Mismo lenguaje frontend ↔ backend ↔ MCPs. Skill `claude-api` aplicable. |
| **Patrón agéntico** | Cascada **Triage → Identity Verifier → Vishing Analyst** con `tool_choice` forzado. MCPs custom como tools de primera clase. | M3 mide arquitectura agéntica; cascada Triage rápido + Analyst lento es defendible y auditable. |
| **Telefonía** | **Twilio Programmable Voice + Media Streams** | Único viable en sprint corta. Media Streams entrega audio µ-law 8kHz/20ms via WebSocket bidireccional. Call forwarding desde celular real = adopción cero-instalación. SIM físico no viable sin SIM gateway hardware (USD 200-500 + Asterisk). SIP trunk chileno como roadmap producción. |
| **STT** | **Deepgram Nova-3 streaming** (default) + **whisper.cpp local** (fallback declarado en Fly.io con modelo `large-v3` MIT) | Deepgram: vendor neutro, latencia <300ms interim transcripts, español multi-acento incluyendo Chile, free tier USD 200. Si "solo Claude" se interpreta literal estricto, switch a whisper.cpp local — argumento "no llamamos a OpenAI, corremos pesos open en nuestra infra" definitivo. |
| **TTS** | **Twilio Polly Lupe-Neural** con `<prosody rate="slow">` | Incluido en Twilio, integración trivial con TwiML, español neutro, dicción para audiencia 65+. Cartesia Sonic como upgrade si latencia molesta. |
| **RAG** | pgvector sobre Postgres (Supabase) | Estándar. Free tier suficiente. RLS por `caregiver_id`. |
| **Embeddings** | **Voyage AI `voyage-3`** | Calidad alta para español, costo bajo, no acopla a otro LLM. |
| **Canal de adopción** | **Call forwarding GSM `**21*<DID>#`** desde celular real → DID Twilio chileno | Cero instalación, cero app, cero login para la persona protegida. Operadores chilenos lo soportan nativamente. |
| **PWA cuidador** | **Next.js 15 + React 19 + Tailwind + shadcn/ui + Supabase Auth (magic link) + Web Push API + manifest installable** | Distribución cero fricción. Add-to-Home-Screen indistinguible de app nativa. Specs detalladas en `SEGURIDAD.md`. |
| **Push al cuidador** | **Web Push API** (primario) + **WhatsApp Cloud API** (redundante para HIGH risk) + **SMS Twilio** (fallback si WhatsApp KYC tarda) | Web Push gratis y suficiente para LOW/MEDIUM. WhatsApp para HIGH risk porque siempre llega. SMS por si Meta KYC se atrasa. |
| **MCPs custom** | `mcp-wiki-legal` + `mcp-cmf` (servidores standalone) | Sostiene narrativa "MCP custom" sin sobre-ingeniar. Resto de tools son SDK. |
| **Hosting** | **Vercel** (PWA + edge functions) + **Supabase** (DB+Auth+Storage) + **Fly.io** (worker whisper.cpp si activamos fallback) | Free tier para todos. Deploy en minutos. |

**Decisiones que NO tomamos (y por qué):**
- **App nativa Android/iOS** → costo de App Store review > beneficio MVP. PWA installable cumple. Roadmap V2.
- **Voice cloning detection** → estado del arte cambiante, datos de referencia complejos. Defensa real para clonación = factor de conocimiento (KBA + shared word, no clonables) + cross-channel out-of-band.
- **SIM card chileno físico** → no viable sin SIM gateway hardware en sprint 48h.
- **Whisper de OpenAI** → conservador con la regla "Claude motor principal"; Deepgram es vendor neutro, whisper.cpp local como fallback open source MIT.
- **Streaming bidireccional con interrupciones naturales** → MVP usa turn-by-turn simple. VAD bidireccional es non-trivial.
- **LangChain/LangGraph** → abstracción especulativa que estorba el Q&A.
- **GPT-4 / Gemini como motor** → **descalifica**.
- **Embeddings de OpenAI** → acoplamiento innecesario; Voyage `voyage-3` cumple.
- **Multi-idioma** → solo es-CL en MVP. Migrantes/multi-idioma en V2 explícito.
- **Multi-cuidador por persona protegida** → V2.

---

## 12. Innovación (qué nadie hizo)

1. **Identity Firewall multi-factor para llamadas al adulto mayor.** Combinación caller_id whitelist + shared word + KBA + cross-channel WhatsApp ack. No es chatbot ni filtro de spam — es autenticación real para un escenario donde la víctima no puede aplicarla por sí misma.
2. **Deny-by-default en LLM helpful-by-training.** System prompt del Call Triage explícitamente revierte el sesgo helpful: el trabajo del agente NO es ser servicial con el llamante. Esto es ingeniería de prompts adversariales, no decoración.
3. **Cascada Triage rápido (Sonnet) + Analyst lento (Opus + extended thinking).** Latencia y costo optimizados por etapa.
4. **MCPs custom standalone** demostrando interoperabilidad real con el ecosistema MCP.
5. **Citación estructurada obligatoria** vía `tool_choice: required` + schema `citations[]` minItems:1 + post-validator determinista — anti-alucinación regulatoria por diseño, gate A6.
6. **Consentimiento legal de grabación incorporado en el primer TTS** — Línea 03 explícita, no checkbox de footer. *"Esta llamada está siendo analizada para protección"* satisface one-party-consent + notificación al llamante.
7. **PWA installable que separa cuidador (configura) de protegido (no instala nada)** — diseño de producto que respeta la realidad del segmento adultos mayores.

---

## 13. Métricas de éxito

- **Llamada filtrada antes de tocar a la víctima:** 100% de las llamadas con `policy ≠ always_pass` pasan por el firewall antes de cualquier transferencia.
- **Latencia p50 Triage en vivo:** < 2s desde fin de frase del llamante hasta respuesta TTS de Vigía.
- **Latencia p95 Triage en vivo:** < 3s.
- **Tasa de cita en respuestas regulatorias:** 100% (gate A6).
- **Aciertos en golden set adversarial (≥35 inputs phone-first):** ≥95% accuracy + 100% en bloques de seguridad (V21 suplantación social, V22 caller-ID spoof, V17 inyección audio, V19 anti-STT).
- **Falsos negativos en bloque suplantación social V21:** **0** sobre el set golden.
- **Tiempo de detección:** real-time durante la llamada (vs. 72h actuales post-fraude consumado).

---

## 14. Mapeo a la rúbrica v3.3

Score final = **40% mentor (10 sub-checks) + 60% juez (12 sub-checks, solo si Top 4)**. Texto literal de la rúbrica en `docs/EVENT/RUBRICA.md`. **Matriz operativa con evidencia exigida, owner y artefacto entregable en `PLAN.md` §"Sub-checks operativos"**.

**Resumen:**
- **M1 problema/ciudadano (20%)** cubierto por ficha cívica (este doc, secciones 1-9) + canal call forwarding + cifra 2.4M adultos mayores INE 2026.
- **M2 datos responsables (20%)** cubierto por ≥7 fuentes regulatorias (Wiki Legal Fintech, BCN, CMF, Sernac, CSIRT, PDI, Subtel) + citation validator determinista.
- **M3 Claude + arquitectura agéntica (35%, primer desempate)** cubierto por 6+ system prompts dedicados, 2 MCPs custom + ≥8 tools SDK, pipeline phone-first generando decenas de calls por llamada.
- **M4 funciona (25%)** cubierto por demo en vivo de llamada real con call forwarding + 3 llamadas pre-validadas + backup video pre-grabado sin transición visible.

**Selección y desempate:** Top 4 por vertical → 12 finalistas (cron 7-mayo 09:00 sobre score_mentor). Desempate finalistas: M3 > M2 > M1 > timestamp. 6 ganadores totales (2 por vertical).
