# docs/EVENT/ — texto literal del Claude Impact Lab 2026

> **Propósito:** archivo canónico del **texto oficial** del evento (bases, rúbrica, pilares, objetivos). No es paráfrasis ni resumen — es el material de origen, citable verbatim.

## Por qué existe esta carpeta

`CLAUDE.md` y la memoria contienen la versión **destilada** de las reglas del evento (anti-descalificación, ventana de build, etc.). Está bien para guiar el día a día, pero:

1. **La rúbrica define qué es ganar.** Tenerla literal evita drift por parafraseo.
2. **El gate "Claude motor principal" es descalificante.** El texto literal del evento es la única referencia auditable cuando hay duda.
3. **En Q&A, el jurado puede citar literalmente.** El equipo necesita poder hacerlo también.
4. **Los archivos en `docs/EVENT/` son cargables on-demand** por el agente Claude (yo) cuando una decisión los toca, sin hinchar el contexto base de cada sesión.

## Qué va aquí (y qué NO)

**Va:**
- `BASES.md` — texto literal de las bases/condiciones de participación.
- `RUBRICA.md` — texto literal de la rúbrica de evaluación.
- `PILARES.md` — pilares fundamentales, objetivos, mesas/tracks.
- `HERRAMIENTAS-ANTHROPIC.md` *(opcional)* — declaración oficial de qué cuenta como uso de Claude / herramientas Anthropic permitidas.

**No va:**
- Resúmenes propios o paráfrasis (para eso está `CLAUDE.md`).
- Notas de mentores (esas en `docs/notes-mentores/` si las hay).
- Documentos del propio proyecto (para eso `docs/IDEA.md`, `docs/MVP-JUEVES.md`, etc.).

## Cómo se llena

1. Marco pega el texto oficial del evento en cada archivo, reemplazando los `<!-- TODO -->`.
2. Cada archivo conserva el frontmatter con `source_url`, `retrieved_at` y `version` para auditar de dónde viene y cuándo se descargó.
3. **No editar el texto literal.** Si hay que aclarar algo, se hace en una sección `## Notas internas` al final, separada del texto oficial.
4. Si el evento publica una versión nueva, se actualiza `retrieved_at` y `version`, y opcionalmente se conserva la versión anterior en `archive/`.

## Cómo lo uso yo (el agente)

- Cuando una decisión técnica toca una regla del evento (ej. "¿se vale usar GPT como auxiliar?"), leo el archivo correspondiente y respondo citando textual.
- No lo cargo en cada conversación; lo leo on-demand vía Read.
- Si detecto contradicción entre `CLAUDE.md` y el texto oficial, gana el texto oficial; aviso a Marco para actualizar `CLAUDE.md`.

## Estado actual

| Archivo | Estado |
|---|---|
| `BASES.md` | Placeholder — pendiente de pegar texto oficial |
| `RUBRICA.md` | Placeholder — pendiente de pegar texto oficial |
| `PILARES.md` | Placeholder — pendiente de pegar texto oficial |
