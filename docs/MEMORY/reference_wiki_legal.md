---
name: Fuentes regulatorias oficiales del Lab para citación
description: Wiki Legal Fintech + BCN API Ley Fácil + CMF + CSIRT + leyes BCN — datasources canónicos del agente regulatorio Vigía
type: reference
originSessionId: 493db4f7-1f96-46cd-a840-5c35375738b5
---
**Datasources oficiales del Claude Impact Lab 2026 (`docs/EVENT/DATOS.md`):**

1. **Wiki Legal Fintech (canónica del evento):** https://fintech.benditaia.cl/es/wiki-legal — el mentor regulatorio contrasta la demo y el README contra esta wiki. Alucinación grave (afirmar derechos inexistentes) → sub-check A6 = no_cumple → cae M2 (20% del score mentor).
2. **BCN API Ley Fácil:** https://www.bcn.cl/leyfacil — JSON con explicaciones ciudadanas de leyes vigentes. **Crítico para A1 (sin jerga) + A5 (≥2 fuentes regulatorias).** Nuevo datasource añadido tras leer DATOS.md.
3. **CMF Alertas al público:** https://www.cmfchile.cl/portal/principal/613/w3-propertyvalue-43545.html — entidades no autorizadas, alertas de fraude.
4. **CMF Registro de Prestadores Fintec:** verificación si entidad está autorizada bajo Ley 21.521.
5. **CSIRT Nacional:** https://www.csirt.gob.cl — boletines de incidentes y campañas activas en Chile.
6. **PhishTank:** https://phishtank.org — API REST con registro free.
7. **URLhaus (abuse.ch):** https://urlhaus.abuse.ch — API pública sin auth.
8. **BCN textos completos:** https://www.bcn.cl/leychile — leyes oficiales.

**Leyes relevantes Línea 02 (Ciberseguridad Ciudadana):**
- **Ley 21.459** — delitos informáticos (deroga 19.223). Tipifica phishing, fraude, acceso ilícito.
- **Ley 21.663** — marco de ciberseguridad (ANCI). Plazos CSIRT 3h alerta / 72h descripción / 15d informe.
- **Ley 21.521** — Ley Fintech. Registro de Prestadores Fintec (CMF).
- **Ley 19.628** — protección de datos vigente (hasta dic 2026).
- **Ley 21.719** — nueva protección de datos. Vigencia 1-dic-2026 (7 meses post-Lab). ARCO+ y notificación de brechas. Diseñar para ella desde el día 1.

**How to apply:**
- El agente Regulatory Translator de Vigía hace RAG sobre Wiki Legal Fintech + BCN Ley Fácil + textos BCN. Embeddings con `voyage-3` en pgvector (Supabase).
- System prompt del Regulatory Translator (en `docs/PROMPTS.md`): forzar `mcp_wiki_legal.search` antes de cualquier afirmación regulatoria. Si no hay fuente → literal *"No encontré fuente oficial — verifica en https://fintech.benditaia.cl/es/wiki-legal"*.
- `tool_choice: required` sobre `mcp_wiki_legal` para preguntas regulatorias = anti-alucinación por diseño (sub-check A6).
- BCN Ley Fácil es el atajo para responder en lenguaje ciudadano sin perder rigor; combinar con texto literal de BCN para citas exactas.
- Antes del pitch, verificar que las preguntas demo retornan citas correctas; preparar set golden de 25 inputs como fallback.
