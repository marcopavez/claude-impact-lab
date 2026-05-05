# Sub-checks v3.3 — checklist operativo

> **Fuente:** `docs/EVENT/RUBRICA.md` (texto literal). Score final = **40% mentor + 60% juez**.
> **Función:** convertir los 22 sub-checks abstractos en evidencia accionable, con owner y artefacto entregable. "Definition of done" maestro y contrato interno de calidad.
> **Convención:** cada sub-check es **binario** (cumple/no cumple). No hay grises.

---

## FASE 1 — Mentor (10 sub-checks, 40% del score)

Bendi (Haiku 4.5) pre-evalúa con evidencia → mentor confirma.

### M1 — Problema y ciudadano (peso 20%)

| ID | Sub-check | Evidencia exigida | Dónde queda | Owner |
|---|---|---|---|---|
| **A1** | sin jerga | Ficha cívica + TTS de Vigía + responses en PWA legibles a nivel sexto básico. TTS con `<prosody rate="slow">` para audiencia 65+. Sin "MCP", "embeddings", "agéntico" ni jurídico denso. | `docs/FICHA-CIVICA.md` + transcripts demo + system prompts en `docs/PROMPTS.md` exigen sexto básico | producto |
| **A2** | segmento específico | Adultos mayores 65+ Chile = 2.4M (INE 2026) + cifras Sernac/PDI vishing + penetración smartphone >70% en 65-74 (Subtel). | `docs/FICHA-CIVICA.md` §3 | producto |
| **A3** | canal concreto | **Llamada telefónica con call forwarding** desde celular real de la persona protegida a DID Twilio chileno. PWA cuidador (Next.js + manifest installable) deployada en Vercel pública. | `docs/FICHA-CIVICA.md` §5 + URL Twilio DID + URL Vercel | telephony + frontend |
| **A4** | impacto cuantificado | **Tiempo detección 72h → tiempo real durante la llamada.** El estafador nunca llega a la víctima. Cifras adicionales: denuncias Sernac/PDI vishing por año. | `docs/FICHA-CIVICA.md` §2 + slide del deck | producto |

### M2 — Datos responsables (peso 20%)

| ID | Sub-check | Evidencia exigida | Dónde queda | Owner |
|---|---|---|---|---|
| **A5** | ≥2 fuentes regulatorias | ≥7 fuentes oficiales conectadas: Wiki Legal Fintech, BCN Ley Fácil, CMF Alertas, CMF Registro Prestadores Fintec, CSIRT, PDI Cibercrimen, Sernac, BCN textos completos, Subtel. | `mcp-wiki-legal` chunks + `mcp-cmf` snapshot + `docs/FICHA-CIVICA.md` §7 | data |
| **A6** | sin alucinaciones | `tool_choice: required` en Regulatory Translator + schema con `citations[]` minItems:1 + **citation validator determinista** (substring + Levenshtein 0.95 sobre fuente fetcheada). Si no hay fuente, literal "no encontré fuente". Set golden valida 0 alucinaciones. | `packages/agents/regulatory-translator.ts` + `packages/eval/citation-validator.ts` + `packages/eval/golden/regulatory.json` + `THREAT-MODEL.md` §7 | agentes |

### M3 — Uso de Claude + arquitectura agéntica (peso 35%)

| ID | Sub-check | Evidencia exigida | Dónde queda | Owner |
|---|---|---|---|---|
| **B1** | system prompt específico | **6+ system prompts dedicados** por agente (no genéricos): Call Triage (con bias defensivo), Identity Verifier, Vishing Analyst (Opus + extended thinking), Regulatory Translator (`tool_choice: required`), Caregiver Notifier, Phishing Analyst, Denuncia Builder, Classifier. Cada uno con rol, tools, política de citación, output schema, canary, spotlighting. | `packages/agents/prompts/*.md` (borradores en `docs/PROMPTS.md`) | agentes |
| **B2** | ≥2 tools válidas | **2 MCPs custom** (`mcp-wiki-legal`, `mcp-cmf`) + tools SDK: `tool-phone-lookup`, `tool-twilio-call-control`, `tool-whatsapp-cross-channel`, `tool-web-push`, `tool-sms-twilio`, `tool-phishtank`, `tool-urlhaus`, `tool-denuncia-build`. **≥10 tools, 2 MCPs custom.** Tools schema JSON exportable. | `packages/mcps/*` + `packages/agents/tools.ts` + `packages/agents/tools-schema.json` | MCPs |
| **B3** | consola con ≥3 mensajes en ventana | Pipeline phone-first genera **decenas de calls Anthropic por llamada** (Triage + Verifier + Vishing Analyst + Regulatory + Notifier + Denuncia). **Primer call API el 6-mayo 00:00 EXACTO**, ni un minuto antes. Screenshot consola Anthropic. | screenshot adjunto al entregable técnico | tech lead |

### M4 — Funciona (peso 25%)

| ID | Sub-check | Evidencia exigida | Dónde queda | Owner |
|---|---|---|---|---|
| **B4** | demo video 3-5 min end-to-end | Video MP4 ≤100 MB, 3-5 min. **Demo principal: llamada en vivo real** (Marco activa desvío en su celular, compañero llama, Vigía contesta, jurado ve transcript SSE en pantalla + decisión por nivel del firewall + push a la PWA cuidador). Las 3 llamadas de prueba pre-validadas: cuento del tío, banco oficial, familiar real. **Backup pre-grabado sin transición visible.** Subtítulos. Audio limpio. | adjunto al entregable técnico | producto |

---

## FASE 3 — Juez (12 sub-checks, 60% del score, solo si Top 4 en Línea 02)

3 jueces en doble ciego, score = mediana de los 3.

### J1 — Pitch (3 min + 2 Q&A) (peso 35%)

| ID | Sub-check | Evidencia exigida | Cómo lo aseguramos |
|---|---|---|---|
| **J1.1** | ≤3 min | Cronómetro en pitch ≤3:00. | 3 ensayos cronómetro mínimo. Recorte si >3:10 en último ensayo. |
| **J1.2** | ciudadano específico | María (78, Ñuñoa) en los primeros 30s. No abstracción. | Estructura fija: 0:00-0:30 = María; 0:30-2:00 = demo en vivo de llamada cuento del tío bloqueada; 2:00-2:45 = visión + tracción; 2:45-3:00 = cierre. |
| **J1.3** | cita fuente regulatoria | Mostrar en pantalla (PWA cuidador panel) la cita real durante el demo: Ley 21.459 art. fraude informático + alerta Sernac sobre cuento del tío 2.0 + boletín PDI Cibercrimen vishing. | Cita aparece en respuesta del Vishing Analyst + slide de cierre. Pre-validada con set golden. |
| **J1.4** | Q&A respondido | Las preguntas más probables tienen respuesta ensayada. **Top 1: "¿qué pasa si el estafador dice ser la nieta?" → respuesta vía Identity Firewall multi-factor.** | Red team interno previo: arquitectura, decisiones modelo, identity firewall, edge cases, costos, escalabilidad, privacidad, why Twilio, why Deepgram, why PWA. |

### J2 — Impacto ciudadano real (peso 35%)

| ID | Sub-check | Evidencia exigida | Cómo lo aseguramos |
|---|---|---|---|
| **J2.1** | métrica concreta | **Tiempo detección 72h → tiempo real durante la llamada.** El estafador nunca llega a la víctima. + 2.4M adultos mayores 65+ Chile + cifras denuncias Sernac/PDI. | Slide 1 + cierre del pitch. Cifras con fuente citable. |
| **J2.2** | alcanzable | Adultos mayores 65+ accesibles (>70% smartphone). Distribución vía SENAMA realista. **Cero instalación para la persona protegida** (solo cuidador instala PWA). | Stakeholder identificado en ficha + slide go-to-market. |
| **J2.3** | resuelve algo nuevo | **Único filtro de identidad multi-factor para llamada al adulto mayor en LATAM.** TrueCaller no autentica, apps de banco solo protegen propios, bloqueadores spam solo lista negra de números. | Tabla comparativa en deck + Q&A respaldado por `IDENTITY-FIREWALL.md`. |
| **J2.4** | canal realista | **Llamada telefónica con call forwarding** = penetración total Chile, accesible para 65+, nativo del operador chileno (Movistar/Entel/WOM/VTR), gratuito. **Cero instalación**. | Demo en vivo confirma operativo + ficha cívica §5. |

### J3 — Producto / demo en vivo (peso 30%)

| ID | Sub-check | Evidencia exigida | Cómo lo aseguramos |
|---|---|---|---|
| **J3.1** | demo no crashea | Demo en vivo completa al menos una llamada filtrada sin errores visibles. Si Twilio falla → backup video de las 3 llamadas pre-grabadas, sin transición visible. | 3 llamadas pre-validadas en CI. Backup video listo y proyectable sin anuncio. Opción A (post-call sobre audio subido) como respaldo defensivo si falla call forwarding en vivo. |
| **J3.2** | I/O visible | PWA cuidador en pantalla muestra: caller_id, intent detectado, transcript streaming SSE, decisión por nivel del firewall (caller_id → intent → factors → outcome), citaciones clickeables. | UI con reasoning panel siempre visible durante demo. Skill `frontend-design` aplicada para identidad visual. |
| **J3.3** | latencia <30s | Triage en vivo p50 <2s, p95 <3s. Análisis post-call (Opus + extended thinking) <12s p50. | Cost budget 30s wall-clock + Sonnet 4.6 con prompt corto + Deepgram interim transcripts <300ms. Si Opus va >25s, plan B con Sonnet + CoT. |
| **J3.4** | Claude evidente | PWA cuidador y reasoning panel declaran "Powered by Claude" + modelo usado + tokens en cada decisión. | UI muestra `Sonnet 4.6` / `Opus 4.7 + extended thinking` / `Haiku 4.5` en cada step del pipeline. |

---

## Resumen de status (a actualizar durante el sprint)

**Leyenda:** 🟢 cumplido · 🟡 en progreso · 🔴 pendiente · ⚫ bloqueado

### Mentor

| Sub-check | Status | Owner | Notas |
|---|---|---|---|
| A1 sin jerga | 🟡 | producto | revisar TTS de Vigía + respuestas demo |
| A2 segmento específico | 🟢 | producto | adultos mayores 65+ con cifras INE/Sernac/PDI |
| A3 canal concreto | 🟡 | telephony+frontend | Twilio DID activo + PWA Vercel |
| A4 impacto cuantificado | 🟢 | producto | tiempo real durante la llamada |
| A5 ≥2 fuentes regulatorias | 🟢 | data | 7 fuentes en RAG |
| A6 sin alucinaciones | 🟡 | agentes | citation validator determinista |
| B1 system prompt específico | 🟢 (borrador) | agentes | 6+ prompts en `PROMPTS.md` |
| B2 ≥2 tools válidas | 🟡 | MCPs | 2 MCPs custom + ≥8 tools SDK |
| B3 consola ≥3 mensajes en ventana | 🔴 | tech lead | NO ABRIR ANTES DE LA VENTANA |
| B4 demo video 3-5 min | 🔴 | producto | grabar al cierre del día 1 |

### Juez (solo si finalistas)

| Sub-check | Status |
|---|---|
| J1.1 ≤3 min | 🔴 (ensayar) |
| J1.2 ciudadano específico | 🟢 (María 78, Ñuñoa) |
| J1.3 cita fuente regulatoria | 🟡 (depende de A6) |
| J1.4 Q&A respondido | 🔴 (red team interno: identity firewall, why Twilio, why Deepgram, why PWA) |
| J2.1 métrica concreta | 🟢 |
| J2.2 alcanzable | 🟢 |
| J2.3 resuelve algo nuevo | 🟢 (identity firewall multi-factor para llamada) |
| J2.4 canal realista | 🟡 (Twilio DID + call forwarding) |
| J3.1 demo no crashea | 🟡 (3 llamadas pre-validadas + backup video) |
| J3.2 I/O visible | 🟡 (PWA cuidador con reasoning panel) |
| J3.3 latencia <30s | 🟡 (Triage <2s p50) |
| J3.4 Claude evidente | 🟡 (UI declara modelo) |

---

## Reglas críticas del evento (no son sub-checks, pero descalifican)

| Regla | Cómo lo cumplimos |
|---|---|
| **Claude motor principal** (otros LLMs base = descalificación) | Sonnet 4.6 + Opus 4.7 + Haiku 4.5 son las únicas decisiones de razonamiento. Deepgram solo STT, Twilio Polly solo TTS, Voyage solo embeddings — todos componentes I/O sensoriales no-LLM. |
| **Entregables completos** (sin ficha O sin entregable técnico → sin score) | Manejado por Marco (foco logístico fuera del scope técnico de este equipo). |
| **No re-identificar datasets** | PhishTank, URLhaus, CMF, Subtel se consultan tal cual; no se intenta des-anonimizar. |
| **Equipo domina lo que construyó** | Cada decisión arquitectónica documentada en `docs/`. Q&A ensayado pre-pitch con red team interno. |
| **Construido en la ventana** | `docs/THREAT-MODEL.md` §9 + `feedback_build_window.md` en memoria. Primer call API el 6-mayo 00:00 exacto. |

---

## Desempates (cron Top 4 del 7-mayo 09:00 — referencial)

**Para entrar a finalistas:**
1. Score mentor (M1+M2+M3+M4) más alto.
2. Si empate → mayor M3 (uso de Claude).
3. Si empate → mayor M2 (datos responsables).
4. Si empate → mayor M1 (problema y ciudadano).
5. Si empate → timestamp más temprano del último entregable.
6. Si empate → voto del comité.

**Implicación operativa:** **M3 es el desempate más fuerte (35% peso + primer desempate).** Cualquier inversión que mejore M3 (B1 prompts más específicos, B2 más tools válidas, B3 más calls visibles en consola) tiene el mejor ROI. La cascada Triage + Verifier + Analyst + Regulatory + Notifier sostiene M3 generando decenas de calls por llamada y mostrando arquitectura agéntica real.
