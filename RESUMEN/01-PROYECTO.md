# 01 — Qué es Vigía

> 🔄 **Pivote N20 (2026-05-06) Lean MVP/PoC:** el MVP procesa audios pre-grabados subidos a la PWA, **sin Twilio, sin Deepgram, sin base de datos, sin auth**. Servidor stateless, audio en memoria, fuentes y config demo en JSON estático, verdict renderizado en pantalla. La versión phone-first vivo + persistencia + cross-channel push es **roadmap V2** explícito.

## Una frase

**Detector de vishing con firewall de identidad** que protege a adultos mayores chilenos contra estafas telefónicas. **MVP/PoC Lean:** el cuidador o la persona protegida sube un audio sospechoso a la PWA, Claude lo analiza con una cascada agéntica (Triage → Identity Verifier → Regulatory Translator → Vishing Analyst Opus 4.7), entrega verdict + citas regulatorias validadas + render en pantalla en ~30s. **V2:** el desvío activado en el celular de la persona protegida (`**21*<DID>#`) hacia un número Twilio chileno hace que Vigía conteste en vivo, autentique al llamante y decida transferir, tomar mensaje o colgar; persistencia + auth + cross-channel push también en V2.

## A quién protege

- **Segmento MVP único:** adultos mayores 65+ en Chile (~2.4M, INE 2026).
- **Cuidador familiar** (hijo/hija, 35–55) sube los audios y ve el verdict en pantalla. **En MVP no hay cuentas: la PWA es single-page demo público.** En V2 se agrega auth + multi-cuidador.
- La persona protegida no instala nada.
- Migrantes, microempresarios y jóvenes 15–25 quedan en roadmap V2 explícito.

## Por qué ahora

- Estafas telefónicas son la categoría top de denuncias Sernac/PDI Cibercrimen en Chile. El "cuento del tío" mutó a vishing 2.0 (suplantación de bancos, Carabineros, SII, "tu nieto está detenido").
- Cuando la víctima detecta el fraude, **ya transfirió**. Las alertas pasivas (CMF, banco) llegan tarde.
- La base regulatoria está (Leyes 21.459 / 21.663 / 21.521 / 19.628 → 21.719). Falta la capa de IA que la traduzca a una respuesta accionable **sobre el audio del incidente** (MVP) o **durante la llamada** (V2).
- **Vigía baja el tiempo de detección de 72h a ~30s** (MVP Lean: ElevenLabs Scribe + cascada + render en pantalla). En V2 con telefonía: tiempo real durante la llamada.

## Diferencial frente a lo existente

| Solución | Qué le falta |
|---|---|
| TrueCaller | Identifica caller_id, no analiza contenido ni autentica. |
| Apps de bancos | Solo a sus clientes; quien recibe vishing del banco competidor está solo. |
| Bloqueadores de operador | Lista negra por número; no atrapan caller_id spoofeado que matchea whitelist. |
| Voicemail | Captura sin analizar, sin citar, sin decidir. |
| Campañas SENAMA | Educan en frío; ante presión emocional la educación no alcanza. |

**Vigía = razonamiento Claude + firewall multi-factor + cita regulatoria obligatoria validada + canal nativo (PWA + audio upload, sin instalar nada en MVP).**

## Track del Lab

**Línea 02 — Ciberseguridad Ciudadana**. Cruza Línea 01 (traduce regulación a lenguaje ciudadano con citas obligatorias) y Línea 03 (consentimiento legal de grabación, **cero PII en reposo en MVP**, ARCO+ Ley 21.719 trivialmente cumplido por ausencia de almacenamiento — diseñado por defecto, no como feature).

## Métricas de éxito

- **100%** de audios pasan por el Identity Firewall (motor de detección + challenge plan recomendado contra config demo) antes de devolver verdict.
- **Latencia p50 Triage:** < 2s sobre transcript. **Latencia E2E (audio sube → render aparece):** < 30s para audio 60s.
- **100%** de cita en respuestas regulatorias (gate A6 binario), validadas por substring + Levenshtein 0.95 contra fuente fetcheada en caliente.
- **Cero falsos negativos** en el bloque V21 (suplantación social) del golden set.
- **Tiempo de detección:** ~30s (MVP) / real-time (V2 con telefonía), vs. 72h actuales post-fraude consumado.

## Stakeholders

- **CMF / PDI Cibercrimen / Sernac / CSIRT / Subtel:** consumen señales agregadas anónimas (Civic Intel, V2) y reciben denuncias estructuradas con citas.
- **SENAMA / Fundación Las Rosas / Hogar de Cristo / CCAF:** distribución natural al segmento 65+.
- **Cuidadores familiares:** comprador/configurador (V2 con freemium para multi-cuidador, exportes médicos).

Modelo de adopción: **B2C cuidador** + **B2NGO** (SENAMA) + **B2G** (dashboard Civic Intel a CMF/PDI/Sernac) + **B2B2C** (bancos cooperativos). Todo lo que requiere persistencia se activa en V2.
