# Ficha cívica — borrador

> **Submit definitivo:** `2026-05-07 10:00` hora Chile, vía `/app > Entregables`.
> Este archivo es el draft que se transcribe al formulario en la ventana de submission.

## 1. Línea temática
**Mesa 3 — Protección y Confianza Digital** (track principal). El proyecto cruza Mesa 1 (Lenguaje y Accesibilidad — traducción de regulación a lenguaje claro) y Mesa 2 (Interoperabilidad — MCPs como capa de conexión entre CMF, SERNAC, PhishTank, URLhaus y Wiki Legal).

## 2. Problema ciudadano concreto
+800.000 intentos de fraude financiero digital al año en Chile, con pérdidas superiores a USD 200M anuales. La ciberseguridad existe en los bancos pero no llega al ciudadano: las alertas CMF están en PDFs de lenguaje jurídico, los procedimientos SERNAC son formularios técnicos, las URLs de phishing viven en bases de datos que ningún ciudadano consulta. Los adultos mayores reciben llamadas de vishing a diario haciéndose pasar por sus bancos, confían y pierden sus ahorros. La víctima promedio detecta el ataque **72 horas** después — para entonces el dinero ya se transfirió. **Vigía busca reducir ese tiempo a menos de 30 segundos** entregando análisis multi-agente, alerta accionable y guía de denuncia, en el canal y lenguaje que la persona usa.

## 3. Segmento específico

**Primario — Adultos mayores 65+**
- Universo Chile: ~2.4M personas (INE, proyección 2026).
- Penetración smartphone/WhatsApp: >70% en 65-74, >40% en 75+.
- Vulnerabilidad: principal víctima de vishing y smishing bancario.
- Por qué WhatsApp: ya es su canal natural; cero fricción de adopción.

**Secundarios:**
- **Migrantes** (~1.5M, ~8% de la población) — expuestos a estafas en apps de remesas/bancos no tradicionales; barrera idiomática agrava la vulnerabilidad.
- **Microempresarios** (~1M) — phishing dirigido a sus cuentas de negocio (suplantación SII, AFP, proveedores).
- **Adolescentes y jóvenes** (15-25, ~3M) — engaños en redes sociales (estafas cripto, premios falsos, suplantación bancaria en Instagram/TikTok).

## 4. Propuesta de valor
**Vigía es un asistente multi-agente sobre WhatsApp** que recibe SMS, audios, capturas o URLs sospechosas y devuelve — en lenguaje claro, con cita de fuente oficial — análisis del riesgo, alerta accionable y guía para denunciar. Multi-modal, multi-canal, sin instalación.

- **Para quién:** ciudadanía vulnerable al fraude financiero digital.
- **Qué hace:** detecta + traduce regulación + guía + ayuda a denunciar.
- **Diferenciador:** IA generativa multi-agente en el flujo y canal de la persona, con citación obligatoria a fuente oficial (anti-alucinación regulatoria por diseño), y un loop de Civic Intel que devuelve señal agregada anónima a CMF/CSIRT.
- **Por qué nadie más lo hace:** TrueCaller no conoce fraude chileno; Token CMF no es conversacional; las apps bancarias solo protegen a sus clientes. Vigía es la primera capa pública, transversal, multi-agente.

## 5. Canal de adopción
**Mixto B2C + B2NGO + B2G + B2B2C:**
- **B2C directo** vía WhatsApp Business (sin instalación, sin app store, sin formularios).
- **B2NGO**: distribución a través de ONGs adulto mayor (SENAMA, Fundación Las Rosas, Caritas), gremios de migrantes y asociaciones de microempresarios.
- **B2G**: Civic Intel Dashboard para CMF y CSIRT — tendencias anónimas de campañas activas en tiempo real.
- **B2B2C**: integración con WhatsApp Business de bancos cooperativos y CCAF para proteger a sus afiliados.

## 6. Stakeholder identificado
- **CMF (Comisión para el Mercado Financiero)** — regulador principal, beneficiario directo del Civic Intel; valida normativa y consume señales agregadas para emitir alertas más oportunas.
- **CSIRT Chile** — recibe señales de campañas activas (URLs, hashes de audios reincidentes) para coordinar respuesta nacional.
- **SENAMA / Fundación Las Rosas** — partners de distribución y validación con usuario final adulto mayor.
- **SERNAC** — recibe denuncias mejor estructuradas vía templates pre-llenados por el agente Denuncia Builder.

## 7. Datos oficiales que consume
- **API CMF — Alertas al público** (entidades no autorizadas, fraudes detectados): https://www.cmfchile.cl/portal/principal/613/w3-propertyvalue-43545.html
- **CMF — Registro de Entidades Autorizadas** (verificación legitimidad).
- **Wiki Legal Fintech**: https://fintech.benditaia.cl/es/wiki-legal
- **CSIRT Chile** (reportes incidentes nacionales): https://www.csirt.gob.cl
- **PhishTank** (URLs phishing globales reportadas): https://phishtank.org
- **URLhaus** (URLs maliciosas activas, Abuse.ch): https://urlhaus.abuse.ch
- **SERNAC** (procedimientos denuncia): https://www.sernac.cl
- **BCN — Biblioteca Congreso Nacional** (textos oficiales): leyes 21.459, 21.663, 21.521, 19.628, 19.223 — https://www.bcn.cl/leychile

Todas las fuentes son **públicas y citables**; ninguna requiere convenio. La citación es obligatoria en cada respuesta del agente regulatorio (gate anti-alucinación).
