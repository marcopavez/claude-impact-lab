# 01 — Qué es Vigía

## Una frase

**Secretaria inteligente con firewall de identidad** que protege a adultos mayores chilenos contra estafas telefónicas. La persona protegida activa desvío de llamadas (`**21*<DID>#`) hacia un número Twilio chileno, Vigía contesta, analiza la llamada en tiempo real con Claude, autentica al llamante con un protocolo multi-factor, y decide: **transferir, tomar mensaje o colgar** — alertando al cuidador familiar por una PWA.

## A quién protege

- **Segmento MVP único:** adultos mayores 65+ en Chile (~2.4M, INE 2026).
- **Cuidador familiar** (hijo/hija, 35–55) configura y recibe alertas. La persona protegida no instala nada.
- Migrantes, microempresarios y jóvenes 15–25 quedan en roadmap V2 explícito.

## Por qué ahora

- Estafas telefónicas son la categoría top de denuncias Sernac/PDI Cibercrimen en Chile. El "cuento del tío" mutó a vishing 2.0 (suplantación de bancos, Carabineros, SII, "tu nieto está detenido").
- Cuando la víctima detecta el fraude, **ya transfirió**. Las alertas pasivas (CMF, banco) llegan tarde.
- La base regulatoria está (Leyes 21.459 / 21.663 / 21.521 / 19.628 → 21.719). Falta la capa de IA que la traduzca a una respuesta accionable **durante** la llamada.
- **Vigía baja el tiempo de detección de 72h a tiempo real.**

## Diferencial frente a lo existente

| Solución | Qué le falta |
|---|---|
| TrueCaller | Identifica caller_id, no analiza contenido ni autentica. |
| Apps de bancos | Solo a sus clientes; quien recibe vishing del banco competidor está solo. |
| Bloqueadores de operador | Lista negra por número; no atrapan caller_id spoofeado que matchea whitelist. |
| Voicemail | Captura sin analizar, sin citar, sin decidir. |
| Campañas SENAMA | Educan en frío; ante presión emocional la educación no alcanza. |

**Vigía = razonamiento Claude + firewall multi-factor + cita regulatoria obligatoria + canal nativo (la llamada que ya recibe la víctima, sin instalar nada).**

## Track del Lab

**Línea 02 — Ciberseguridad Ciudadana**. Cruza Línea 01 (traduce regulación a lenguaje ciudadano con citas obligatorias) y Línea 03 (consentimiento legal de grabación, PII efímera, ARCO+ Ley 21.719 expuestos en PWA).

## Métricas de éxito

- **100%** de llamadas con `policy ≠ always_pass` pasan por el firewall antes de transferir.
- **Latencia p50 Triage en vivo:** < 2s desde fin de frase del llamante hasta TTS de Vigía.
- **100%** de cita en respuestas regulatorias (gate A6 binario).
- **Cero falsos negativos** en el bloque V21 (suplantación social) del golden set.
- **Tiempo de detección:** real-time (vs. 72h actuales post-fraude consumado).

## Stakeholders

- **CMF / PDI Cibercrimen / Sernac / CSIRT / Subtel:** consumen señales agregadas anónimas (Civic Intel) y reciben denuncias estructuradas con citas.
- **SENAMA / Fundación Las Rosas / Hogar de Cristo / CCAF:** distribución natural al segmento 65+.
- **Cuidadores familiares:** comprador/configurador (freemium para multi-cuidador, exportes médicos).

Modelo de adopción: **B2C cuidador** + **B2NGO** (SENAMA) + **B2G** (dashboard a CMF/PDI/Sernac) + **B2B2C** (bancos cooperativos).
