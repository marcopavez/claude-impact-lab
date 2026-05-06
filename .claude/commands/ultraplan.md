---
description: Plan multi-agente exhaustivo de implementación para Vigía. Inventaria estado real del repo (apps/, .claude/) y lo cruza contra docs/PLAN.md (capas Core/Sólido/Wow + tracks A-F + sub-checks A1-A6/B1-B4 + fallbacks + KPIs), docs/PROYECTO.md (flujo end-to-end + arquitectura + schema Supabase) y docs/SEGURIDAD.md (threat model + identity firewall + prompts canónicos + golden set + decisiones cerradas N1-N18+). Produce punch-list ordenado por path crítico, mapeado a sub-checks, con dependencias, fallbacks declarados, DoD por hito y esfuerzo en horas. Pasale un scope opcional para enfocar.
argument-hint: [core | solido | wow | telefonia | pwa | cascada | rag | mcp | eval | "<feature concreta>"]
allowed-tools: Read, Glob, Grep, Bash(git*:*), Bash(node*:*), Bash(ls*:*), Bash(wc*:*), Agent, TaskCreate
model: claude-opus-4-7
---

# /ultraplan — plan multi-agente de implementación para Vigía

Generás un plan ejecutable de implementación leyendo el repo en vivo y cruzando contra los docs canónicos. Output estructurado, accionable, mapeado a la rúbrica v3.3 (40% mentor + 60% juez). No tocás archivos — solo producís el plan en la conversación.

## Scope

`$ARGUMENTS` — interpretación:
- vacío o `core` → plan completo Capa Core (hito `v0.1-mvp-call`).
- `solido` → plan Capa Sólido (hito `v0.5-solid`), asumiendo Core listo.
- `wow` → plan Capa Wow (hito `v1.0-demo-final`), asumiendo Sólido listo.
- `telefonia` | `pwa` | `cascada` | `rag` | `mcp` | `eval` → enfocar en ese track (A/C/B/D/D/E según `docs/PLAN.md` §6).
- otro string → tratar como nombre de feature concreta y plan tactical (contrato I/O + tools + prompt esqueleto + golden cases mínimos + DoD).

## Procedimiento

### 1. Reconocimiento paralelo (un solo mensaje, múltiples Agent calls)

Lanzá en paralelo:

- **Agent Explore "very thorough"** sobre `apps/web/` + `apps/eval/` + `.claude/`. Pedí: árbol relevante (sin `node_modules`, `.next`, `tsconfig.tsbuildinfo`, `package-lock.json`), `package.json` completo, `app/` (páginas + route handlers), `lib/` (qué módulos, qué SDKs ya envueltos, validators existentes), `scripts/`, `data/`, `public/` (manifest, iconos PWA), `apps/eval/golden-set/` (archivos JSONL + cuentas de casos + sample schema), TODOs/FIXMEs visibles, gaps obvios vs. el stack declarado en `/CLAUDE.md`.
- **Agent Explore "medium"** sobre `docs/PLAN.md` (~679 líneas). Pedí: ventana de build exacta + cierre operativo, capas Core/Sólido/Wow línea por línea, tracks A-F con bloqueos, sub-checks operativos §12, KPIs §10, fallbacks por componente §1 tabla líneas ~80-92, riesgos top §8, Definition of Done por hito (`v0.1-mvp-call` / `v0.5-solid` / `v1.0-demo-final`), Q&A red team §11.
- **Agent Explore "medium"** sobre `docs/PROYECTO.md` (flujo + arquitectura + schema Supabase) y `docs/SEGURIDAD.md` (threat model V1-V22, identity firewall Niveles 1-3, prompts canónicos por agente con `tool_choice` forzado y output schema, golden set adversarial por agente, decisiones N1-N18+, post-validator de citas substring + Levenshtein 0.95, allowlist de fuentes).
- **(Opcional)** Si el scope no es trivial, **Agent Plan** para diseñar el orden tactical de los 5-7 ítems más críticos del path crítico considerando que Track A (telefonía) suele ser raíz.

### 2. Verificá ventana de build (Bash)

```sh
git log --since="2026-05-06 00:00" --until="2026-05-07 23:59" --oneline
date
```

Reportá cuánto tiempo queda hasta cierre operativo (asumí ~20h post-medianoche del 6-may si `docs/EVENT/RUBRICA.md` no declara cutoff explícito).

### 3. Sintetizá output con esta estructura exacta (en español, conciso)

#### Estado actual
Snapshot 5-7 líneas: branch, commits últimos en ventana, SDKs presentes/faltantes, agentes ya implementados (de la cascada Triage→Verifier→Vishing→Regulatory→Notifier→Phishing→Denuncia→Classifier), schema DB presente, PWA assets presentes.

#### Path crítico
Grafo en ASCII (5-10 nodos) mostrando dependencias bloqueantes entre tracks A/B/C/D. Track A (telefonía) suele ser raíz.

#### Capa Core (`v0.1-mvp-call`)
Tabla columnas: `# | Ítem | Sub-check | Bloquea / Bloqueado por | Fallback (literal de PLAN.md) | DoD binaria | Esfuerzo (h)`. ≤18 filas. Ordenadas por bloqueo descendente.

#### Capa Sólido (`v0.5-solid`)
Igual estructura. ≤10 filas. Sólo si scope no es `core`.

#### Capa Wow (`v1.0-demo-final`)
Igual estructura. ≤6 filas. Sólo si scope es `wow` o vacío.

#### Riesgos top + mitigación inmediata
≤5 ítems formato: `Riesgo → Mitigación accionable ahora`. Reusá los riesgos declarados en `docs/PLAN.md` §8 — no inventes.

#### Próximas 3 acciones concretas
Numeradas. Cada una: comando exacto o archivo exacto a tocar (path absoluto). Si requiere decisión humana (KYC Twilio, KYC Meta WhatsApp, dominio Vercel custom, VAPID keypair), marcá con `[Marco]` y declará el desbloqueo que produce.

### 4. Cero archivos nuevos
Output solo en la conversación. Si Marco quiere persistir, lo decide después con un commit explícito.

### 5. (Opcional, si Marco lo pide al final) `TaskCreate` por cada ítem Capa Core
Solo si Marco lo solicita. No proactivamente.

## Reglas de calidad

- **Sub-checks específicos por ítem** (ej. para un agente: `B1 system prompt + B2 tool válida + B3 mensaje en consola`). Sin mapeo a sub-check, el ítem no defiende M3 (35% peso + primer desempate).
- **Fallback literal**, no inventado. Está en `docs/PLAN.md` §1 tabla líneas ~80-92. Citá la frase tal cual.
- **DoD binaria y verificable** (ej. "smoke test devuelve `pong`", "golden set 100% en bloques V21/V22/V17/V19", "p50 Triage <2s en 10 corridas"). No "funciona bien".
- **Esfuerzo realista en horas**, no optimismo. Sumá tu propio overhead de tooling (configurar VAPID, DNS, KYC).
- **Ítems ya implementados → no repetir**. Si el reporte de Explore muestra que `apps/web/lib/agents/call-triage.ts` ya existe, NO lo planifiques de nuevo. Listá solo gaps.
- **Si scope es feature concreta**, omití capas y mostrá: contrato (input/output schema), tools requeridas con su `tool_choice` policy, prompt esqueleto (system + user + canary token + spotlighting), golden cases mínimos por categoría de riesgo (HIGH/MEDIUM/LOW), DoD.
- **Citá decisiones cerradas N1-N18+** cuando un ítem las activa (ej. "Identity Verifier — activa N11 + N13 + N15 + N16").

## Anti-patrones

- ❌ Proponer features fuera del stack cerrado en `/CLAUDE.md` (ej. agregar Whisper de OpenAI viola §"Decisiones que NO tomamos"; LangChain idem).
- ❌ Inflar el plan con abstracciones especulativas o refactors no pedidos.
- ❌ Omitir el sub-check al que mapea cada ítem.
- ❌ Usar fechas relativas ("mañana", "pronto", "después"). Siempre absolutas con timezone (`2026-05-06 14:00 CLT`).
- ❌ Mockear datos regulatorios. Citation validator carga fuentes oficiales reales.
- ❌ Sugerir commits de código antes de la ventana (sub-check B3 + skill `commit-window-guard`).
- ❌ Reabrir decisiones N1-N18 sin marcar explícitamente "[REQUIERE REABRIR]" en el ítem.

## Notas

- El comando vive bajo `model: claude-opus-4-7` para ganar profundidad. Si Marco está en sesión Sonnet/Haiku, /ultraplan upgrade-ea temporalmente.
- Si el scope es ambiguo (ej. "/ultraplan auth" sin claridad si es Supabase Auth o identity firewall), preguntá una vez antes de gastar paralelos.
- El reconocimiento paralelo cuesta tokens; si Marco invoca dos veces seguidas y nada cambió, reusá el reporte cached del último turno (mencioná "reuso del reporte previo, sin re-explorar").
