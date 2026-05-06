# `.claude/` — Estructura de trabajo Claude Code · Vigía

Esta carpeta contiene la **infraestructura compartida** para que Claude Code trabaje sobre Vigía de manera profesional y auditable. Todo lo que está acá se commitea al repo y se comparte con el equipo. Es además **evidencia visible al juez** del Claude Impact Lab para el sub-check **M3 (35% peso · primer desempate)**.

> Lo único que NO se sube es `settings.local.json` (permisos personales · ya está en `.gitignore`).

## Por qué existe esto

Trabajar en modo conversacional puro pierde:
- **Trazabilidad** de decisiones (las olvidás entre sesiones)
- **Paralelización** (subagents corren en contexto aislado sin contaminar el principal)
- **Disciplina** (hooks bloquean commits fuera de ventana, etc.)
- **Evidencia visible** (el juez explora el repo y ve `.claude/agents/` como prueba de uso sofisticado de Claude)

## Contenido

```
.claude/
├── agents/              ← subagents custom (corren en contexto aislado)
│   ├── citation-validator.md
│   ├── rubrica-auditor.md
│   ├── prompt-redteam.md
│   ├── pii-redaction-check.md
│   └── qa-drill.md
├── skills/              ← skills invocables con /<name> o automáticamente
│   ├── decision-record/SKILL.md
│   ├── commit-window-guard/SKILL.md
│   ├── golden-set-add/SKILL.md
│   ├── cite-or-silent/SKILL.md
│   └── mentor-checklist/SKILL.md
├── hooks/               ← scripts ejecutables por hooks declarados en settings.json
│   └── commit-window-guard.mjs
├── settings.json        ← hooks compartidos (commiteado)
├── settings.local.json  ← permisos personales (NO commiteado)
└── README.md            ← este archivo
```

## Subagents

Cada subagent corre en una conversación aislada con su propio system prompt y subset de tools. Se invoca con la tool `Agent` y `subagent_type: <name>`. Su output vuelve al contexto principal pero el contexto del subagent no.

| Agent | Cuándo | Modelo |
|---|---|---|
| **citation-validator** | después de cualquier respuesta con cita regulatoria · sustenta A6 binario | haiku |
| **rubrica-auditor** | antes de tags de hito · audita M1-M4 + J1-J3 contra el repo | sonnet |
| **prompt-redteam** | después de editar un archivo en `prompts/` · ataques cuento del tío + bank impostor + voice clone + oracle | sonnet |
| **pii-redaction-check** | antes de mergear cualquier código que loggee/embeddee transcripts · cubre RUT, IBAN, tarjeta, dirección | haiku |
| **qa-drill** | 24h antes del pitch + tras cambios mayores · simula juez hostil | sonnet |

## Skills

Las skills son procedimientos parametrizables que Claude (o Marco con `/<name>`) puede invocar. A diferencia de los subagents, corren en el contexto principal — son útiles cuando necesitás continuar conversación sobre el resultado.

| Skill | Cuándo |
|---|---|
| **decision-record** | "guardá esto como decisión", "queda cerrado" — agrega N{n+1} a SEGURIDAD.md §31 + memoria |
| **commit-window-guard** | antes de cada commit · ventana sagrada (≥ 2026-05-06 00:00 CLT para código) |
| **golden-set-add** | "agregalo al dataset" — append JSONL por agente con schema validado, sin PII real |
| **cite-or-silent** | refactoriza respuesta regulatoria → schema citations[] minItems:1 OR la frase literal de silencio |
| **mentor-checklist** | antes de cada tag de hito · scoring rápido sobre los 10 sub-checks mentor (40% peso) |

## Hooks (settings.json)

| Hook | Evento | Script | Qué hace |
|---|---|---|---|
| **branch-status** (A) | `UserPromptSubmit` | `branch-status.mjs` | Inyecta branch actual + dirty status al system prompt. Si estás en `main`/`develop` con código modificado, advierte para que Claude proactivamente sugiera `git switch -c feat/<scope>`. |
| **commit-window-guard** (B) | `PreToolUse` matcher `Bash` (filtra `git commit` internamente) | `commit-window-guard.mjs` | Bloquea commit de código de aplicación si: (1) fecha < ventana de build, o (2) branch protegida (`main`/`develop`/`master`). Docs (`docs/`, `.claude/`, `*.md`, `.gitignore`, `LICENSE`) siempre pasan. |

**Lógica de path "código vs doc":** todo path que matche `^(docs/|RESUMEN/|README\.md$|\.claude/|\.gitignore$|LICENSE$|.*\.md$)` es doc. El resto (incluido `apps/`, `packages/`, `prompts/`, `*.ts`, configs raíz) es código de aplicación. Los dos hooks comparten esta regex — si la cambiás, cambiala en ambos.

**Hooks que podríamos sumar** si valen el ROI (no activos por defecto):

- **PostToolUse** sobre `Edit|Write` con matcher path `prompts/**` → dispara automáticamente `prompt-redteam`.
- **Stop** → imprime "Pendientes hito v0.5: [...]" leyendo `docs/PLAN.md`.
- **PreToolUse** sobre `Edit|Write` con matcher path `apps/**` y branch protegida → bloqueo duro de edición (descartado por fricción; el bloqueo en commit es suficiente).

## Workflow recomendado

### Por cada sesión nueva

1. Una sesión por **dominio técnico**, no por feature: `arquitectura`, `telefonía`, `cascada-agentica`, `pwa-cuidador`, `mcp-custom`, `eval-golden-set`.
2. CLAUDE.md raíz + memoria portátil cargan automático.
3. Para escopio profundo, agregar `apps/<scope>/CLAUDE.md` cuando exista la subcarpeta.

### Por cada feature

1. **Plan mode** (subagent `Plan`) → propuesta arquitectónica antes de tocar código.
2. Marco aprueba o redirige.
3. `TaskCreate` con sub-tareas trackeable.
4. Implementación (Edit/Write).
5. Skill `simplify` → review de reuso/calidad.
6. Skill `security-review` → review de seguridad sobre el diff.
7. Subagent `rubrica-auditor` → audita aporte M3.
8. Skill `commit-window-guard` (también hook) → verifica ventana.
9. Conventional commit en español (`feat: call triage agent`).

### Por cada respuesta regulatoria del agente

1. El agente emite respuesta con `citations[]`.
2. Subagent `citation-validator` (automático en producción, manual en dev) → pass/fail binario.
3. Si fail → skill `cite-or-silent` → refactor o silencio literal.

### Antes de cada hito (v0.1, v0.5, v1.0)

1. Skill `mentor-checklist` → score mentor.
2. Subagent `rubrica-auditor` → mentor + juez.
3. Cerrar gaps top-3 por ROI.
4. Tag.

### 24h antes del pitch

1. Subagent `qa-drill` con scope "todo el pitch".
2. Marco rehearsal → cada respuesta evaluada por el agent.
3. Repetir hasta grade A en las 5-7 preguntas críticas.

## Extensión

Para agregar un subagent: nuevo `.md` en `.claude/agents/` con frontmatter (`name`, `description`, `tools` opcional, `model` opcional) + system prompt. Reload automático de Claude Code.

Para agregar una skill: nueva carpeta `.claude/skills/<name>/` con `SKILL.md` + frontmatter (`name`, `description`, `triggers`).

Para sumar un hook: editá `settings.json` (compartido) y, si necesita un script ejecutable, agregalo a `.claude/hooks/`.

## Buenas prácticas

- **Cero secrets en hooks/skills.** Usá env vars (`process.env.X`) o referenciá archivos fuera del repo.
- **Hooks idempotentes y rápidos.** Si tarda >2s, mové a skill.
- **Subagents con scope chico.** Un subagent que "hace todo" no se usa. Uno con un trabajo específico (validar cita, redteam un prompt) se usa siempre.
- **Skills con triggers explícitos.** El campo `description` en el frontmatter es lo que decide si Claude las invoca automáticamente — listá frases gatillo en español.
- **Documentar contratos.** Cada agent/skill declara entrada esperada, output schema, anti-patrones. Si no, otro miembro del equipo (o vos en 2 días) no la sabe usar.
