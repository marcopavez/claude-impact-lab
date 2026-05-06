# Rúbrica v3.3 — sub-checks binarios con evidencia

Bendi (Haiku 4.5) pre-evalúa con evidencia → mentor confirma con un click → el juez puntúa el pitch en vivo. Cero ambigüedad: cada sub-check es binario (cumple / no cumple). 22 sub-checks en total: 10 evalúa el mentor el 6 mayo, 12 los jueces durante los pitches del 7 mayo. Score final = 40% mentor + 60% juez.

## FASE 1 — Mentor (6 mayo)

| Dim | Qué mide | Peso | Sub-checks |
|---|---|---|---|
| M1 | Problema y ciudadano | 20% | A1 sin jerga · A2 segmento específico · A3 canal concreto · A4 impacto cuantificado |
| M2 | Datos responsables | 20% | A5 ≥2 fuentes regulatorias · A6 sin alucinaciones |
| M3 | Uso de Claude + arquitectura agéntica | 35% | B1 system prompt específico · B2 ≥2 tools válidas · B3 consola con ≥3 mensajes en ventana |
| M4 | Funciona | 25% | B4 demo video 3-5 min end-to-end |

## FASE 3 — Juez (7 mayo, durante pitches)

| Dim | Qué mide | Peso | Sub-checks |
|---|---|---|---|
| J1 | Pitch (3 min + 2 Q&A) | 35% | J1.1 ≤3 min · J1.2 ciudadano específico · J1.3 cita fuente regulatoria · J1.4 Q&A respondido |
| J2 | Impacto ciudadano real | 35% | J2.1 métrica concreta · J2.2 alcanzable · J2.3 resuelve algo nuevo · J2.4 canal realista |
| J3 | Producto / demo en vivo | 30% | J3.1 demo no crashea · J3.2 I/O visible · J3.3 latencia <30s · J3.4 Claude evidente |

3 jueces por equipo en doble ciego — score juez del equipo = mediana de los 3 (descarta extremos). Cada sub-check tiene evidencia obligatoria visible para el equipo en su tarjeta de leaderboard post-evento.

## Reglas críticas (descalificadores y penalizaciones)

v3.3 elimina los gates discrecionales (commits en ventana, "trabajo previo") en favor de sub-checks deterministas con evidencia. Estas son las reglas críticas que sí siguen aplicando:

- **Claude como motor principal.** Sin uso real de la API de Claude (verificado en la consola Anthropic durante la ventana del evento) → descalificación. Soluciones que usen otros LLMs como base → descalificadas.
- **Entregables completos.** Sin ficha cívica O sin entregable técnico → no entras a la fase mentor (no hay score). Sin pitch → no entras a fase juez.
- **Fuentes regulatorias verificables.** El sub-check A6 verifica que ninguna afirmación regulatoria es alucinación. Si Bendi marca afirmaciones sospechosas y el mentor confirma → A6 = no_cumple, lo que baja el score de M2.
- **Construí en la ventana.** Código y contenido que existan antes del 6 mayo 00:00 o después del 7 mayo 23:59 no cuentan para B3 (consola con mensajes en ventana). Si la consola no muestra ≥3 mensajes en ventana, B3 = no_cumple.
