# Ficha cívica — Vigía

> **Estructura:** este archivo replica el formulario oficial de `docs/EVENT/BASES.md §4`. Cada sección está escrita para cumplir los sub-checks **A1 (sin jerga), A2 (segmento específico), A3 (canal concreto), A4 (impacto cuantificado), A5 (≥2 fuentes regulatorias)** que evalúa el mentor.

---

## 1. Línea temática

**Línea 02 — Ciberseguridad Ciudadana.**

Por diseño Vigía cruza la Línea 01 (traduce circulares CMF y leyes a lenguaje ciudadano con citas obligatorias) y la Línea 03 (consentimiento legal de grabación incorporado al diseño, PII efímera con TTL 24h, derechos ARCO+ que la Ley 21.719 entrega en diciembre 2026 expuestos vía endpoints export/delete de la PWA del cuidador). Compite formalmente solo en Línea 02.

---

## 2. Problema ciudadano concreto

En Chile, las **estafas telefónicas son la categoría top de denuncia ciudadana** ante Sernac y PDI Cibercrimen. El "cuento del tío" se modernizó: hoy llega por celular, con suplantación de bancos, Carabineros, SII, AFP, o "tu nieto está detenido". Las víctimas mayoritarias son **adultos mayores 65+**, segmento de 2.4 millones de personas (proyección INE 2026).

El patrón es siempre el mismo: una llamada de 3 minutos con presión emocional, una cuenta extraña a la que transferir, y una víctima que descubre el fraude **horas o días después**, cuando el dinero ya fue retirado.

**Las herramientas existentes no llegan al adulto mayor que recibe esa llamada:**
- **TrueCaller** identifica el número pero no analiza el contenido en vivo ni autentica al llamante.
- **Las apps de banco** solo protegen a sus propios clientes; el adulto mayor que recibe vishing del banco competidor está solo.
- **Las campañas educativas de SENAMA** llegan en frío; cuando suena el teléfono con presión emocional, la educación previa no alcanza.
- **Los bloqueadores de spam de los operadores** (Movistar Aviso, Entel anti-spam) bloquean por lista negra de números, no atrapan caller_id spoofeados ni autentican llamadas de números desconocidos legítimos.

El resultado: una abuela de 78 años en Ñuñoa contesta una llamada que dice ser su nieta con un accidente, transfiere dos millones, y se entera que la nieta nunca llamó cuando la familia se reúne el fin de semana.

**Vigía elimina ese momento de decisión bajo presión.** Funciona como **secretaria inteligente con firewall de identidad**: la llamada se desvía desde el celular real de la persona protegida hacia un número Vigía, donde Claude analiza la llamada en tiempo real, **autentica al llamante con un protocolo multi-factor** (palabra clave familiar + pregunta personal + verificación cruzada por WhatsApp), y solo transfiere si el llamante pasa el firewall. Si no pasa, Vigía toma el mensaje, lo cita con la ley aplicable, y alerta al cuidador familiar por la app.

La persona protegida **no instala nada y no cambia su rutina**. Activa una vez el desvío de llamadas en su celular (un código GSM que el cuidador le configura desde la PWA o llamando al operador) y desde ese momento Vigía es su filtro 24/7.

---

## 3. Segmento específico (con datos demográficos)

**Segmento único MVP — Adultos mayores 65+ en Chile.**

- **Universo:** ~2.400.000 personas (proyección INE 2026, 12% de la población chilena).
- **Penetración smartphone:** >70% en el tramo 65–74 años, >40% en 75+ (Subtel 2024).
- **Por qué son la víctima principal:**
  - Mayor confianza en autoridad: una "llamada del banco" o "de Carabineros" no genera la suspicacia inmediata que generaría en un usuario digital nativo.
  - Menor familiaridad con UX digital y campañas de prevención que circulan por redes sociales (instagram, tiktok), donde no están.
  - Aislamiento social: una llamada que dice ser de un familiar lejano genera apertura emocional inmediata.
- **Por qué llamada telefónica como canal:**
  - El celular ya es su canal natural de comunicación, **sin curva de aprendizaje**.
  - El desvío de llamadas es una función estándar de operadores chilenos (Movistar, Entel, WOM, VTR), gratuita, configurable con un código GSM de 6-8 caracteres.
  - **Cero instalación, cero app a aprender, cero login**. Vigía se adapta al canal que ya usan, en vez de exigirles aprender uno nuevo.

**Cuidador familiar como configurador y receptor de alertas (rol funcional, no segmento competitivo):**

- Hijo/hija de la persona protegida, 35–55 años, alfabetizado digitalmente.
- Configura la whitelist (familiares, médico, banco oficial), la palabra clave familiar y las preguntas KBA desde la PWA del cuidador en 5 minutos.
- Recibe alertas por Web Push y WhatsApp cuando Vigía toma un mensaje.

**Roadmap explícito (V2, fuera de scope MVP):**

- **Migrantes (~1.5M, 8% de la población según INE).** Requiere multi-idioma (es-MX, es-AR, en, pt). Stack reusable, segmento V2 con prioridad alta.
- **Microempresarios (+1.8M según SII 2025).** Vishing suplantando SII y proveedores. Modelo y tools regulatorias compartibles, segmento V2.
- **Jóvenes 15–25 (~3M).** Más expuestos a smishing y redes que llamada. Cubiertos parcialmente por la capa secundaria texto/imagen del MVP.

---

## 4. Propuesta de valor

**Vigía es una secretaria inteligente con firewall de identidad para llamadas telefónicas, dedicada a proteger a adultos mayores chilenos de estafas.**

Funcionamiento desde la mirada del usuario final:

1. **Setup (5 minutos, una vez, lo hace el cuidador):** la hija/hijo crea cuenta en la PWA, agrega contactos a la whitelist (su número, la nieta, el médico de cabecera, el banco oficial verificado), define una palabra clave familiar y 3 preguntas personales, conecta su WhatsApp para recibir alertas. Activa el desvío de llamadas en el celular de la persona protegida con un código GSM.
2. **Día normal:** todas las llamadas entrantes a la persona protegida pasan primero por Vigía. La persona protegida deja de contestar — Vigía contesta por ella.
3. **Cuando llama un familiar real:** Vigía pide la palabra clave familiar, verifica por WhatsApp que el familiar real esté llamando, y transfiere en menos de 10 segundos.
4. **Cuando llama un estafador haciéndose pasar por familiar:** Vigía pide la palabra clave, el estafador no la sabe, evade la pregunta o presiona ("es urgente, pásame ya con la abuela"), Vigía cuelga y notifica al cuidador con el audio + transcripción + análisis legal (qué ley violó, cómo denunciar a Sernac/PDI).
5. **Cuando llama un banco/empresa/autoridad:** Vigía verifica contra registros oficiales (CMF Prestadores Fintec para bancos), aplica reglas duras (Carabineros/SII/PDI nunca piden dinero por teléfono), y siempre toma mensaje sin transferir — la persona protegida nunca queda frente a un canal donde le pidan transferir o entregar credenciales.

**Lo que Vigía hace y nadie más hace:**

- **Firewall de identidad multi-factor para autenticar al llamante** (palabra clave familiar + pregunta personal de conocimiento + verificación cruzada por WhatsApp). Caller-ID solo no basta — es spoofeable trivialmente en Chile.
- **Razonamiento Claude en cada llamada en tiempo real**, no reglas duras. Detecta cuento del tío, presión emocional, suplantación de autoridad, lenguaje de urgencia.
- **Citación obligatoria de fuente oficial** en cada análisis legal. Si Vigía afirma "los bancos chilenos no piden claves por teléfono", lo respalda con cita literal de la CMF. Anti-alucinación por diseño.
- **Consentimiento legal de grabación incorporado al primer TTS** ("esta llamada está siendo analizada para protección"). One-party-consent satisfecho + notificación al llamante.
- **Cero instalación para la persona protegida**. La PWA del cuidador hace el setup; el celular de la persona protegida sigue siendo un celular normal.

**Diferenciador técnico defendible para Q&A:** la decisión de **no transferir** es deny-by-default. Aunque el llamante hable lindo y diga ser la nieta, Vigía no transfiere a menos que se cumplan las tres condiciones del firewall (caller_id whitelisted + palabra clave correcta + WhatsApp ack del familiar real). Es ingeniería de seguridad real, no chatbot helpful.

---

## 5. Canal de adopción

**Mixto: B2C cuidador familiar + B2NGO distribución + B2G sustentabilidad + B2B2C expansión.**

- **B2C directo al cuidador familiar** vía PWA installable. El cuidador entra a una URL, login con magic link al email, configura en 5 minutos. La PWA queda instalada en su celular como ícono normal (Add to Home Screen funciona en Android Chrome y iOS Safari). La persona protegida (la abuela) no instala nada — solo activa el desvío de llamadas con un código GSM que su operador chileno acepta de forma estándar.
- **B2NGO** vía SENAMA, Fundación Las Rosas, Hogar de Cristo, gremios de adulto mayor. Estas organizaciones llevan Vigía a sus beneficiarios — la familia recibe la PWA, configura, y la abuela queda protegida.
- **B2G** Civic Intel Dashboard para CMF, Sernac y PDI Cibercrimen: tendencias agregadas y anónimas de campañas de vishing activas (qué guiones están circulando, qué números reincidentes, qué horas pico). Sin PII. La autoridad gana señal temprana, Vigía gana sustentabilidad.
- **B2B2C** integración con bancos cooperativos y CCAF (Cajas de Compensación) para proteger a sus afiliados 65+ como beneficio adicional.

**Para el demo en vivo del Lab:** una llamada real desde un celular a un DID Twilio chileno, con desvío configurado, y Vigía contestando en altavoz delante del jurado, con la PWA del cuidador proyectada mostrando transcript streaming + decisión por nivel del firewall. Backup video pre-grabado sin transición visible cubre el riesgo de fallo de Twilio en vivo (sub-check J3.1).

---

## 6. Stakeholder identificado

- **CMF — Comisión para el Mercado Financiero** (regulador principal). Beneficio directo: recibe del Civic Intel Dashboard señales tempranas de campañas activas de vishing financiero, anónimas y agregadas. Vigía consume sus alertas y su Registro de Prestadores Fintec (Ley 21.521).
- **PDI Cibercrimen** (operacional). Beneficio: recibe en tiempo casi-real los patrones de "cuento del tío 2.0", suplantación de Carabineros y autoridad, y las grabaciones consentidas de las llamadas filtradas (con redacción de PII).
- **Sernac** (operacional). Beneficio: recibe denuncias mejor estructuradas vía el Denuncia Builder de Vigía, con la ley invocada, las citas regulatorias y los datos del caso ya organizados.
- **CSIRT Nacional** (operacional). Bajo Ley 21.663 ya tiene plazos legales (3h alerta / 72h descripción / 15d informe) para reportes; Vigía le da ventaja al detectar campañas en su origen.
- **SENAMA / Fundación Las Rosas / Hogar de Cristo** (distribución y validación con usuario final). Beneficio: una herramienta concreta y descargable que pueden ofrecer a sus beneficiarios y sus familias.
- **Subtel** (regulador telecom). Beneficio: datos sobre números reportados como spam/fraude, con consumo y aporte vía `tool-phone-lookup`.

---

## 7. Datos oficiales que consume

Todas las fuentes son **públicas y citables**, ninguna requiere convenio. La citación obligatoria es el mecanismo anti-alucinación del agente regulatorio (sub-check A6).

| Fuente | Uso en Vigía | Cumple |
|---|---|---|
| **Wiki Legal Fintech** — https://fintech.benditaia.cl/es/wiki-legal | Base RAG del agente regulatorio (chunks con embeddings vectoriales). | A5 fuente regulatoria #1 |
| **BCN API Ley Fácil** — https://www.bcn.cl/leyfacil | JSON con explicaciones ciudadanas de leyes 21.459, 21.663, 21.521, 19.628 — clave para responder en lenguaje claro durante el TTS de Vigía. | A5 fuente regulatoria #2 + A1 sin jerga |
| **CMF Alertas al público** — https://www.cmfchile.cl/portal/principal/613/w3-propertyvalue-43545.html | Snapshot diario de entidades no autorizadas y alertas de fraude. | A5 fuente regulatoria #3 |
| **CMF Registro de Prestadores Fintec** — https://www.cmfchile.cl | Verificación si una entidad que dice ser banco/financiera está autorizada bajo Ley 21.521. Llamado en `claim_bank` del firewall. | A5 |
| **PDI Cibercrimen** — https://www.pdichile.cl | Boletines sobre vishing chileno y "cuento del tío 2.0" — patrones canónicos para el Vishing Analyst. | A5 |
| **Sernac Alertas** — https://www.sernac.cl | Procedimientos de denuncia y alertas sobre estafas telefónicas vigentes. | A5 + acción del usuario |
| **CSIRT Nacional** — https://www.csirt.gob.cl | Boletines de incidentes y campañas activas en Chile. | A5 |
| **Subtel** — https://www.subtel.gob.cl | Asignación de numeración por operador + listas reportadas — usado en `tool-phone-lookup` para detección de caller_id spoof. | A5 |
| **PhishTank** — https://phishtank.org | Búsqueda de URLs reportadas como phishing (canal secundario texto). | Detección |
| **URLhaus** (abuse.ch) — https://urlhaus.abuse.ch | Búsqueda de URLs maliciosas activas (canal secundario texto). | Detección |
| **BCN — Biblioteca del Congreso Nacional** — https://www.bcn.cl/leychile | Textos oficiales completos de leyes 21.459 (delitos informáticos), 21.663 (ANCI/ciberseguridad), 21.521 (Fintech), 19.628 (datos personales vigente), 21.719 (nueva protección datos vigencia diciembre 2026). | A5 + Q&A jurado |

---

## 8. Compromiso con manejo responsable de datos personales

Vigía está diseñado desde el día uno bajo el principio **PII al mínimo y efímera**:

- **Audios y transcripts:** TTL 24h con signed URLs que expiran al cerrar el dashboard del cuidador. La grabación se hace con **consentimiento legal explícito incorporado al primer TTS de Vigía** ("esta llamada está siendo analizada para protección"), satisfaciendo Chile one-party-consent y notificando al llamante.
- **Redacción determinista de PII** (RUT chileno, móvil chileno, tarjeta con Luhn, cuenta bancaria heurístico) **antes** de logs, antes de embeddings, antes de cualquier persistencia. El modelo Claude analiza siempre `<RUT_REDACTED>`, no el valor real, salvo cuando la persona protegida o el cuidador entregan explícitamente el RUT en la PWA para una verificación CMF.
- **Shared words y respuestas KBA hasheadas** (bcrypt o argon2id) en reposo. Plain solo en memoria de la sesión activa.
- **No re-identificación** de PhishTank, URLhaus, alertas CMF, ni datos del Civic Intel Dashboard. El dashboard agrega y anonimiza con k-anonymity sobre región/segmento y hash sobre URLs/audios antes de mostrar.
- **No indexamos contenido del usuario en pgvector.** Solo indexamos fuentes oficiales (Wiki Legal, BCN Ley Fácil, CMF, leyes BCN, alertas Sernac, boletines CSIRT/PDI). Esto elimina por construcción la inyección indirecta vía RAG.

**Diseñado para Ley 21.719 (Nueva Ley de Protección de Datos), vigencia 1-dic-2026 — siete meses después del Lab:**

- **Derechos ARCO+** (Acceso, Rectificación, Cancelación, Oposición + Portabilidad + Bloqueo) por diseño: la PWA del cuidador expone endpoints `/api/export` (genera ZIP con todos los datos del cuidador y la persona protegida) y `/api/account DELETE` (cascade delete con right-to-be-forgotten).
- **Notificación de brechas <72h** definida en runbook operativo.
- **Registro de actividades de tratamiento** documentado en `docs/THREAT-MODEL.md` con flujos, fronteras de confianza y retención.
- **Sin profiling individual.** Métricas analíticas solo agregadas y anónimas (canal, veredicto, latencia, tools_used, model_used) sin PII.

La sección de privacidad del README declara con precisión qué datos cruzan a terceros (Twilio para telefonía, Deepgram para STT, Twilio Polly para TTS, WhatsApp Cloud API para alertas), por cuánto tiempo y bajo qué política. Cruza Línea 03 explícitamente como diferenciador, no como checkbox.
