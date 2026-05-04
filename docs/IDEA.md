# Vigía — Idea, arquitectura y mapeo a la rúbrica

## Concepto en una frase
**Vigía** es un asistente multi-agente sobre WhatsApp donde la ciudadanía reenvía SMS, audios, capturas o links sospechosos y recibe — en lenguaje claro y con fuente oficial citada — análisis del riesgo, alerta accionable y guía para denunciar.

## Por qué esto, por qué ahora

- **+800.000 intentos de fraude/año** en Chile y la ciberseguridad bancaria no llega al ciudadano.
- **Las alertas CMF están en PDFs densos**, los procedimientos SERNAC en formularios web, las URLs de phishing en bases técnicas: ninguna llega a un adulto mayor en el momento que la necesita.
- **Hay datos abiertos** (CMF, CSIRT, PhishTank, URLhaus) y un marco legal robusto (Ley 21.459, 21.663, 21.521). Falta la **capa de IA generativa que los conecte y los traduzca**.
- **72 horas** es el tiempo promedio en que una víctima detecta el ataque. Vigía busca bajarlo a **menos de 30 segundos**.

## Diferenciador frente a lo existente

| Solución existente | Lo que le falta |
|---|---|
| **TrueCaller** | No conoce fraude chileno, no analiza contenido del mensaje, no educa, no guía denuncia. |
| **Token CMF** | Alertas estáticas, no conversacional, no en tiempo real, no multi-modal. |
| **Banca Fácil CMF** | Educativo pero pasivo; no responde al ataque que la persona vive ahora. |
| **Apps de cada banco** | Solo clientes del banco; no protege al adulto mayor que recibe smishing del banco competidor. |
| **HaloSafe** | Monitoreo familiar, no análisis del contenido de la amenaza. |

**Vigía es lo que ninguno hace**: IA generativa multi-agente y multi-modal, en el flujo y canal que la persona ya usa, con citación obligatoria de fuente oficial, devolviendo señal agregada anónima a CMF/CSIRT.

## Segmentos y user journeys

### J1 — María, 68 años, Valparaíso
Recibe SMS: *"Banco XX: detectamos transacción sospechosa, confirme aquí: bxx-cl.com"*. Lo reenvía a Vigía por WhatsApp.

Flujo:
1. Orquestador clasifica modalidad (texto + URL) y enruta al **Phishing Analyst**.
2. Phishing Analyst llama a `mcp-phishtank` y `mcp-urlhaus` con la URL → match positivo en PhishTank desde hace 3 días.
3. Llama a `mcp-cmf` con el remitente "Banco XX" → patrón de suplantación reportado.
4. Llama a `mcp-wiki-legal` con la pregunta "¿Banco XX puede pedir confirmación por SMS?" → fuente CMF Comunicado del 12-04 dice **NO**.
5. Orquestador compone la respuesta:
   > *"María, este SMS es un fraude. La URL `bxx-cl.com` aparece en PhishTank desde el 02-mayo (link). Banco XX nunca pide confirmar transacciones por SMS — fuente: CMF Comunicado 12-04 (link). ¿Querés que te ayude a hacer denuncia en SERNAC?"*

### J2 — Carlos, 32 años, Temuco, microempresario
Está en una llamada que dice ser del SII pidiendo "regularizar IVA por transferencia inmediata". Activa Vigía vía botón "escuchar llamada".

Flujo:
1. Whisper transcribe streaming.
2. **Vishing Analyst** (Opus 4.7 + extended thinking) detecta combinación de patrones: urgencia + transferencia inmediata + suplantación de autoridad fiscal.
3. Llama a `mcp-wiki-legal` → "¿el SII solicita pagos por transferencia a cuentas personales?" → Wiki Legal SII responde **NO** (link procedimiento sii.cl).
4. Vigía interrumpe en pantalla:
   > *"⚠ Patrón de vishing alta probabilidad. SII NUNCA pide transferencias inmediatas a cuentas personales. Cuelga y verifica en sii.cl. Procedimiento oficial: [link]."*

### J3 — Sofía, 22 años, Santiago, estudiante
Ve oferta de inversión cripto en Instagram que promete 20% mensual. Manda screenshot a Vigía.

Flujo:
1. Sonnet 4.6 hace OCR + extracción de entidad ("Crypto Andes Inversiones").
2. Llama a `mcp-cmf` para verificar Registro de Entidades Autorizadas → **NO autorizada**, además aparece en alerta CMF de marzo 2026.
3. Llama a `mcp-wiki-legal` → contexto Ley 21.521 sobre captación de fondos del público.
4. Respuesta:
   > *"Sofía, 'Crypto Andes' NO está autorizada por la CMF para captar fondos del público (link). Aparece en alerta CMF de marzo (link). Promesas de 20% mensual son señal típica de pirámide. La Ley 21.521 te protege para operar solo con entidades reguladas."*

## Arquitectura

```
┌────────────────────────────────────────────────────────────────┐
│                  Usuario (WhatsApp / Web Chat)                  │
└──────────────────────────┬─────────────────────────────────────┘
                           │ texto, audio, imagen, URL
                           ▼
┌────────────────────────────────────────────────────────────────┐
│   Orquestador  (Claude Sonnet 4.6, multi-turn, tool use)        │
│   • Clasifica modalidad e intent                                │
│   • Enruta a especialista                                       │
│   • Compone respuesta final con citas obligatorias              │
└──────────────────────────┬─────────────────────────────────────┘
                           │
       ┌───────────────────┼─────────────────────┬──────────────┐
       ▼                   ▼                     ▼              ▼
┌──────────────┐   ┌──────────────┐     ┌──────────────┐ ┌──────────────┐
│ Vishing      │   │ Phishing     │     │ Regulatory   │ │ Denuncia     │
│ Analyst      │   │ Analyst      │     │ Translator   │ │ Builder      │
│ (Opus 4.7 +  │   │ (Sonnet 4.6) │     │ (Sonnet 4.6 +│ │ (Sonnet 4.6) │
│  ext.thinking│   │              │     │  RAG + ext.  │ │              │
│              │   │              │     │  thinking)   │ │              │
└──────┬───────┘   └──────┬───────┘     └──────┬───────┘ └──────┬───────┘
       │                  │                    │                │
       └──────────────────┴────────────────────┴────────────────┘
                                │
                                ▼ (tool calls)
┌────────────────────────────────────────────────────────────────┐
│                       Tools (MCPs)                              │
├────────────────────────────────────────────────────────────────┤
│ • mcp-cmf         Alertas + Registro de Entidades Autorizadas   │
│ • mcp-wiki-legal  RAG pgvector sobre Wiki Legal Fintech + leyes │
│ • mcp-phishtank   Búsqueda URL                                  │
│ • mcp-urlhaus     Búsqueda URL/dominio                          │
│ • mcp-sernac      Procedure templates de denuncia               │
│ • whisper         STT (no es agente, transcribe)                │
└────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────┐
│  Postgres + pgvector (Supabase)                                 │
│  • wiki_legal_chunks   (embeddings voyage-3, ~5-10k chunks)     │
│  • cmf_alertas         (snapshot diario, ~500-2000 entradas)    │
│  • leyes_chunks        (21.459, 21.663, 21.521, 19.628, 19.223) │
│  • fraude_signals      (anónimo, agregado, opt-in)              │
└────────────────────────────────────────────────────────────────┘
                                │
                                ▼ (B2G stretch)
┌────────────────────────────────────────────────────────────────┐
│   Civic Intel Dashboard  (CMF / CSIRT)                          │
│   Tendencias agregadas anónimas: tipos de fraude por región,    │
│   URLs trending, patrones de audios reincidentes.               │
└────────────────────────────────────────────────────────────────┘
```

## Innovación (qué nadie hizo)

1. **Multi-agente con razonamiento visible al ciudadano.** En la UI se muestra: *"Vigía está consultando CMF... encontró alerta del 12-abril..."*. Transparencia construye confianza, especialmente en adultos mayores.
2. **MCPs custom como capa de interoperabilidad real** entre CMF + SERNAC + PhishTank + URLhaus + Wiki Legal. Cruza directamente Mesa 2.
3. **Citación estructurada obligatoria** vía `tool_choice: required` — anti-alucinación regulatoria por diseño.
4. **Multi-modal en WhatsApp**: texto, audio, imagen, URL — un solo punto de entrada, todo enrutado por el orquestador.
5. **Civic Intel feedback loop**: el ciudadano protegido genera valor B2G (CMF/CSIRT reciben señal anónima agregada de campañas activas). Producto B2C que se monetiza B2G.
6. **Multi-modelo por tarea** (Opus / Sonnet / Haiku) — costo y latencia optimizados por uso real, no uniforme.

## Mapeo a la rúbrica (cómo apuntamos al ~95-100)

| Criterio | Peso | Cómo lo cumplimos |
|---|---|---|
| **D1 Impacto ciudadano** | 25% | 4 segmentos vulnerables. Canal WhatsApp = sin instalación. Lenguaje claro auditable. KPI demo: tiempo a alerta < 30s vs 72h actuales. Distribución vía ONGs adulto mayor → escala. |
| **D2 Datos responsables** | 20% | PII efímera (no persistimos RUT/banco). Citación obligatoria vía tool_choice. Manejo declarado en README + Privacy Policy en `/privacy`. Solo fuentes oficiales. Cumple Ley 19.628 + 21.521 por diseño. |
| **D3 Uso de Claude + agéntico** | 25% | Orquestador + 4 sub-agentes (Vishing, Phishing, Regulatory, Denuncia); 5 MCPs custom; **Extended Thinking** en agente regulatorio y vishing; **multi-modelo** (Opus/Sonnet/Haiku según tarea); tools schema JSON exportable; logs de tool use visibles. |
| **D4 Funciona** | 15% | Demo end-to-end de J1 (smishing). J2 (vishing) y J3 (cripto) como stretch + video pre-grabado. Web chat fallback si WhatsApp falla en demo. Test manual con casos pre-validados antes del pitch. |
| **D5 Pitch ciudadana** | 15% | Historias de María (68) / Carlos (32) / Sofía (22). Datos: 800k intentos/año, USD 200M pérdidas, 72h promedio detección. Cierre: "Vigía baja 72h a 30s." Backup video si demo en vivo falla. |
| **+ Bonus agéntico** | +5 | Patrón orquestador-especialista visible en logs y UI; MCPs como tools de primera clase; Extended Thinking declarado; multi-modelo declarado; Civic Intel loop como evidencia de pensamiento sistémico. |

## Stakeholders y go-to-market

| Stakeholder | Rol | Beneficio |
|---|---|---|
| **CMF** | Regulador | Reduce estadísticas de fraude; consume Civic Intel anónimo. |
| **CSIRT Chile** | Operacional | Recibe señales de campañas activas en tiempo real. |
| **SENAMA / Las Rosas / ONGs adulto mayor** | Distribución | Aliados naturales para llegar a 65+. |
| **ABIF / Bancos cooperativos** | Compradores | Integran a su WhatsApp Business para proteger clientes. |
| **SERNAC** | Operacional | Recibe denuncias mejor estructuradas (templates pre-llenados). |

Modelo de adopción: **B2C** directo + **B2NGO** distribución + **B2G** dashboard intel + **B2B2C** integración bancos cooperativos.

## Privacidad y compliance (resumen)

- **Cero persistencia de PII por defecto.** Audios y mensajes se procesan en memoria, no se loguean.
- **Civic Intel opt-in con anonimización.** k-anonymity sobre región/segmento, hash sobre URLs/audios.
- **Cumplimiento Ley 19.628 (datos personales)** y **21.521 (Fintech)** declarado en README.
- **Sin profiling** del usuario individual.
- **Privacy by design**: el sistema no requiere identificar al usuario para funcionar.

## Métricas de éxito (para pitch)

- Tiempo a alerta: **< 30s** (vs 72h actuales).
- Cobertura de URLs maliciosas activas en LATAM: **>80%** (PhishTank + URLhaus).
- Citación obligatoria: **100%** de afirmaciones regulatorias con fuente.
- Falsos positivos en demo: **0** sobre el set de prueba.
