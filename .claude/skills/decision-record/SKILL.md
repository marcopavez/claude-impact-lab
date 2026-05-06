---
name: decision-record
description: Use when Marco confirms a new architectural, security, or scope decision that should join the locked decisions list (N1-N18+) in docs/SEGURIDAD.md §31. Adds the next sequential number with a structured record (decisión / por qué / alternativas descartadas / blast radius / referencias) and updates memory + relevant CLAUDE.md sections. Triggers - "anota esta decisión", "esto queda cerrado", "guarda esto como decisión N+1", "lock this".
---

# Skill — decision-record

## Cuándo invocar

Marco acaba de confirmar una decisión que merece ser irreversible-sin-reabrir. Frases gatillo:

- "ok, queda cerrado así"
- "guarda esto como decisión"
- "esto es N{n+1}"
- "anota esto"
- "lock this in"

## Procedimiento

1. **Leé** `docs/SEGURIDAD.md` y localizá `§31 Decisiones cerradas`. Identificá el número más alto existente (`Nk`).
2. **El nuevo número es** `N{k+1}`.
3. **Construí el record** con esta plantilla literal:

```markdown
### N{k+1} — {Título corto, ej: "Embeddings Voyage-3 sobre OpenAI"}

**Decisión:** {1-2 oraciones, el qué}.

**Por qué:** {3-5 bullets con razones técnicas, regulatorias, o de evento. Cada bullet ≤25 palabras.}
- ...
- ...

**Alternativas descartadas:**
- {Alternativa A} — {por qué no}.
- {Alternativa B} — {por qué no}.

**Blast radius:** {qué partes del sistema dependen de esto y qué se rompe si cambia. Ej: "Cambia paquete `@/embed`, requires regen RAG corpus, ~30 min impact."}

**Referencias:**
- `docs/PROYECTO.md` — {sección}
- `prompts/{archivo}.md` — {línea aprox}
- {URL externa si aplica}

**Fecha:** {YYYY-MM-DD}
**Reabrir requiere:** acuerdo explícito + actualización de SEGURIDAD.md + memoria + revisión de pares.
```

4. **Insertá** el record al final de §31 (preserving order).
5. **Actualizá** `CLAUDE.md` si el cambio afecta la sección "Stack", "Reglas críticas" o "Anti-patrones". Edit quirúrgico, no rewrite.
6. **Actualizá memoria**: agregá al final de `~/.claude/projects/.../memory/project_decisions_locked.md` un bullet `- N{k+1}: {título corto}` y subí el contador en el title si está versionado.
7. **Devolvé** a Marco un resumen ≤4 líneas: número asignado, título, archivos tocados, próximo paso si lo hay.

## Validaciones antes de escribir

- ✋ Si el "por qué" tiene <2 razones técnicas → pedí a Marco que confirme (puede ser una decisión que aún no está madura).
- ✋ Si la decisión contradice un Nk previo → flag explícito: "esto contradice Nk: {texto}, ¿reemplaza o coexiste?".
- ✋ Si la decisión no se puede testear ni observar (ej: "vamos a ser cuidadosos con X") → no es decisión, es valor; sugerí hooks/skills/tests que la operacionalicen primero.

## Anti-patrones

- No inventes un Nk libre. Numerá secuencial estricto.
- No mezcles 2 decisiones en un record — divide y registrá ambas.
- No omitas blast radius. Es lo que distingue una decisión real de un comentario.
- No actualices CLAUDE.md raíz para cambios de scope que solo tocan un subagent o skill — ahí va a CLAUDE.md de la subcarpeta.
