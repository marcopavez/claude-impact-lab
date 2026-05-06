---
name: mentor-checklist
description: Use before tagging any milestone (v0.1-mvp-call, v0.5-solid, v1.0-demo-final) and any time Marco asks "cómo estamos contra los sub-checks de mentor". Runs the 10 mentor sub-checks (A1-A6 in M1+M2, B1-B4 in M3+M4) over the current repo state and reports green/yellow/red per sub-check with concrete evidence paths and minimum gap-closer. Mirrors logic of the rubrica-auditor agent but scoped strictly to mentor (40% peso). Triggers - "mentor checklist", "estamos listos para v0.5", "cómo vamos en mentor".
---

# Skill — mentor-checklist (10 sub-checks · 40% peso final)

## Cuándo invocar

Antes de cualquier tag de hito o cuando Marco pregunta el estado contra mentor. **No** invocar para juez (J1-J3) — esa es otra skill / agente (`rubrica-auditor` cubre ambos).

## Por qué solo mentor

Mentor define quiénes son los **12 finalistas** (top 4 por vertical sobre `score_mentor`). El primer desempate es **M3 (35% peso)**. Si mentor no pasa, juez no aplica. Por eso mentor merece su propia skill afilada.

## Sub-checks (mapa breve, detalle en docs/PLAN.md §12)

| ID | Pertenece | Peso interno | Qué se mide |
|---|---|---|---|
| A1 | M1 (20%) | sin jerga | pitch / readme legible para no-tech |
| A2 | M1 | segmento explícito | "adultos mayores 65+ Chile, 2.4M INE" literal |
| A3 | M1 | canal adopción | call forwarding GSM + PWA cuidador |
| A4 | M1 | impacto cuantificable | métrica medible (tiempo detección 72h → real) |
| A5 | M2 (20%) | ≥2 fuentes oficiales | BCN + CMF + Sernac + CSIRT en prompts/RAG |
| A6 | M2 | sin alucinaciones | tool_choice required + citations[] minItems 1 + post-validator |
| B1 | M3 (35%) | system prompts dedicados | ≥6 archivos en prompts/ con front-matter |
| B2 | M3 | ≥2 tools/MCPs | apps/mcp-* + tools registrados |
| B3 | M3 | ≥3 mensajes consola Anthropic en ventana | screenshots en docs/EVIDENCIA/ |
| B4 | M4 (25%) | demo end-to-end | apps/server corriendo + 3 llamadas pre-validadas + video backup |

## Procedimiento

1. **Leé** `docs/EVENT/RUBRICA.md` (autoridad), `docs/PLAN.md §12`, `CLAUDE.md` "Defensas".
2. **Buscá evidencia** por sub-check:
   - A1: grep en `README.md` y pitch deck de términos crudos sin glosar (`vishing`, `TTL`, `DID`, `MCP`).
   - A2: grep literal "adultos mayores" en `docs/PROYECTO.md` + número INE.
   - A3: grep `**21*` en docs + screenshot PWA.
   - A4: número medible en pitch.
   - A5: contar fuentes únicas citadas en `prompts/*.md` y `apps/eval/golden-set/*.jsonl`.
   - A6: grep `tool_choice.*required` en codigo + schema con `minItems: 1` + existencia de `citation-validator` agent.
   - B1: count files en `prompts/` con frontmatter válido (`---\nname:...`).
   - B2: list `apps/mcp-*/` + grep tool definitions.
   - B3: existencia de `docs/EVIDENCIA/anthropic-console-*.png` con timestamp ≥2026-05-06.
   - B4: `git log --since=2026-05-06` muestra commits de app + existe video en `docs/EVIDENCIA/demo-*.mp4`.
3. **Clasificá:**
   - 🟢 green: evidencia presente, verificable.
   - 🟡 yellow: parcial; nombrá la pieza faltante.
   - 🔴 red: sin evidencia.
4. **Output: tabla + score estimado + top-3 gaps por ROI.**

## Output

```markdown
## Mentor Checklist · {fecha}

| Sub-check | Estado | Evidencia | Gap mínimo |
|---|---|---|---|
| A1 sin jerga | 🟢 | README L20 glosario completo | — |
| A2 segmento | 🟢 | docs/PROYECTO.md §"Ciudadano" | — |
| A3 canal | 🟡 | call forwarding documentado | falta screenshot PWA installable |
| A4 impacto | 🟢 | "72h → tiempo real durante llamada" + 2.4M INE | — |
| A5 ≥2 fuentes | 🟢 | 7 fuentes únicas en prompts/regulatory.md | — |
| A6 sin alucinaciones | 🟡 | tool_choice + citations[] OK | falta corrida automática del validator en CI |
| B1 ≥6 prompts | 🟢 | 7 archivos en prompts/ con frontmatter | — |
| B2 ≥2 tools/MCPs | 🟢 | mcp-wiki-legal + mcp-cmf + 8 tools SDK | — |
| B3 ≥3 mensajes consola en ventana | 🔴 | sin screenshots en docs/EVIDENCIA/ | tomar 3 screenshots con timestamps post 2026-05-06 |
| B4 demo end-to-end | 🟡 | server corre, faltan 3 llamadas validadas + video backup | grabar 3 calls + video 90s |

**Score estimado mentor:** 78 / 100
- M1: 95% (A3 corrige fácil)
- M2: 90% (A6 yellow se cierra con CI)
- M3: 80% (B3 está rojo — bloqueante)
- M4: 60% (B4 yellow — mayor inversión)

**Top-3 gaps por ROI:**
1. 🔴 B3 — abrir consola Anthropic, pegar 3 prompts reales, screenshot timestamped. **15 min.**
2. 🟡 B4 — grabar las 3 llamadas pre-validadas como backup. **45 min.**
3. 🟡 A3 — capturar PWA en home screen Android. **5 min.**

**Riesgo descalificación:** ninguno (Claude motor verificable, código en ventana).
```

## Anti-patrones

- No marques 🟢 por intención. Solo por archivo/grep que existe.
- No mezcles peso mentor con juez en el score.
- No mezcles este check con `rubrica-auditor` (mentor + juez). Esta skill es scoped.
- Si `docs/EVENT/RUBRICA.md` no existe, parás y avisás.
