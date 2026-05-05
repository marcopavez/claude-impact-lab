← Volver al inicio
Bases del evento
Reglas del Claude Impact Lab Chile 2026
Última actualización: abril 2026

48 horas para construir herramientas de IA sobre datos públicos de la CMF, el SII, SERNAC, BCN y CSIRT, que acerquen la regulación a los 5 millones de chilenos que hoy no pueden leerla. Estas son las reglas del juego.

1. Evento
Fechas: 6 y 7 de mayo de 2026, Espacio Riesco, Santiago.
Marco: Primera edición mundial del programa global de Anthropic, dentro del Chile Fintech Forum 2026.
Organiza: Bendita IA, en alianza con FinteChile y Anthropic.
Cupos: 200 builders distribuidos en las tres líneas temáticas del Impact Lab.
2. Quién puede participar
Mayores de 18 años, residentes en Chile o Latinoamérica, con identificación vigente.
Equipos de 2 a 4 personas, o SOLOpreneur (individual) si dominas los tres perfiles.
Tres categorías cross-track (eliges una al inscribirte):
AI Builder — developers que construyen con código (Python, JS, APIs, Agent SDK).
Vibecoder — creadores que construyen con Claude Code, Cursor, v0 o no-code.
Comercial / Producto — estrategas que articulan el problema, validan con usuarios y conectan tecnología con personas.
Un equipo ideal mezcla las tres categorías. La postulación no garantiza cupo: hay una etapa de preaprobación a cargo del comité organizador.
3. El desafío
Un desafío único: Inclusión Financiera para Chile. Tres líneas temáticas a elegir. Cada equipo compite en una sola línea.

Línea 01 — Inclusión Financiera. ¿Cómo hacemos que cualquier chileno entienda sus derechos financieros sin necesidad de ser abogado? Datos: circulares CMF, normativas SII, registros de instituciones reguladas.
Línea 02 — Ciberseguridad Ciudadana. ¿Cómo protegemos a los ciudadanos del fraude financiero digital con IA accesible? Datos: reportes CSIRT, alertas CMF, bases de URLs maliciosas.
Línea 03 — Protección de Datos. ¿Cómo empoderamos a las personas para controlar cómo se usan sus datos financieros? Datos: Ley 21.719 de Protección de Datos, registros de la Agencia de Protección de Datos.
4. Entregables
Tres entregables por equipo. Nada más, nada menos.

Ficha cívica (antes del 7 mayo 10:00 Chile). Formulario en /app > Entregables: línea temática, problema ciudadano concreto, segmento específico con datos demográficos, propuesta de valor, canal de adopción (B2C / B2B2C / B2G / B2NGO), stakeholder identificado opcional, datos oficiales que consumen.
Entregable técnico (antes del 7 mayo 17:00 Chile). Obligatorio: demo video de 3 a 5 minutos mostrando el producto funcionando end-to-end (max 100 MB), screenshot de la consola Claude probando uso del modelo en la ventana del Lab, y system prompt principal del agente. Opcional (suma en D3): repositorio público o ZIP ≤5 MB, tools schema JSON, y declaración de herramientas Anthropic usadas (MCP, Files API, Extended Thinking, Computer Use).
Pitch en vivo (7 mayo, durante el Demo Day). 3 minutos de presentación + 2 minutos de Q&A con jueces. Demo funcional requerida. Los jueces pueden hacer red team al producto en vivo.
5. Calendario y ventana de trabajo
29 abril (miércoles): se abre el login del portal y arranca la formación de equipos en el wizard. Email masivo a inscritos con link directo.
30 abril 23:59 Chile (jueves): cierre de inscripciones individuales — último día para postular.
5 mayo: cierre de equipos — no se admiten cambios de integrantes.
6 mayo 00:00: arranca la ventana de construcción válida.
7 mayo 10:00: deadline ficha cívica.
6 mayo 20:00: deadline entregable técnico (system prompt + tools + screenshot consola + demo video).
6 mayo 23:59: cierre evaluaciones de mentores. Bendi pre-evaluó al cierre de cada entrega.
7 mayo 09:00: cron automático calcula Top 4 por vertical (12 finalistas).
7 mayo 11:00: anuncio público de los 12 finalistas.
7 mayo 11:30 → ~16:00: pitches finales (3 min + 2 Q&A) en doble ciego con 3 jueces por equipo.
7 mayo 17:00: anuncio de los 6 ganadores + cierre.
7 mayo 23:59: cierra la ventana de construcción válida.
Todo commit que cuente para evaluación debe estar entre las 00:00 del 6 de mayo y las 23:59 del 7 de mayo (hora de Chile, UTC-4).

6. Rúbrica v3.3 — sub-checks binarios con evidencia
Bendi (Haiku 4.5) pre-evalúa con evidencia → mentor confirma con un click → el juez puntúa el pitch en vivo.Cero ambigüedad: cada sub-check es binario (cumple / no cumple). 22 sub-checks en total: 10 evalúa el mentor el 6 mayo, 12 los jueces durante los pitches del 7 mayo. Score final = 40% mentor + 60% juez.

FASE 1 — Mentor (6 mayo)
Dim	Qué mide	Peso	Sub-checks
M1	Problema y ciudadano	20%	A1 sin jerga · A2 segmento específico · A3 canal concreto · A4 impacto cuantificado
M2	Datos responsables	20%	A5 ≥2 fuentes regulatorias · A6 sin alucinaciones
M3	Uso de Claude + arquitectura agéntica	35%	B1 system prompt específico · B2 ≥2 tools válidas · B3 consola con ≥3 mensajes en ventana
M4	Funciona	25%	B4 demo video 3-5 min end-to-end
FASE 3 — Juez (7 mayo, durante pitches)
Dim	Qué mide	Peso	Sub-checks
J1	Pitch (3 min + 2 Q&A)	35%	J1.1 ≤3 min · J1.2 ciudadano específico · J1.3 cita fuente regulatoria · J1.4 Q&A respondido
J2	Impacto ciudadano real	35%	J2.1 métrica concreta · J2.2 alcanzable · J2.3 resuelve algo nuevo · J2.4 canal realista
J3	Producto / demo en vivo	30%	J3.1 demo no crashea · J3.2 I/O visible · J3.3 latencia <30s · J3.4 Claude evidente
3 jueces por equipo en doble ciego — score juez del equipo = mediana de los 3 (descarta extremos). Cada sub-check tiene evidencia obligatoria visible para el equipo en su tarjeta de leaderboard post-evento.

7. Reglas críticas (descalificadores y penalizaciones)
v3.3 elimina los gates discrecionales (commits en ventana, "trabajo previo") en favor de sub-checks deterministas con evidencia. Estas son las reglas críticas que sí siguen aplicando:

Claude como motor principal. Sin uso real de la API de Claude (verificado en la consola Anthropic durante la ventana del evento) → descalificación. Soluciones que usen otros LLMs como base → descalificadas.
Entregables completos. Sin ficha cívica O sin entregable técnico → no entras a la fase mentor (no hay score). Sin pitch → no entras a fase juez.
Fuentes regulatorias verificables. El sub-check A6 verifica que ninguna afirmación regulatoria es alucinación. Si Bendi marca afirmaciones sospechosas y el mentor confirma → A6 = no_cumple, lo que baja el score de M2.
Construí en la ventana. Código y contenido que existan antes del 6 mayo 00:00 o después del 7 mayo 23:59 no cuentan para B3 (consola con mensajes en ventana). Si la consola no muestra ≥3 mensajes en ventana, B3 = no_cumple.
8. Preselección y ganadores
Top 4 por vertical → 12 finalistas al pitch. Calculado automáticamente el 7 mayo 09:00 con el score_mentor (M1+M2+M3+M4).
Desempate finalistas: mayor M3 (uso de Claude) > M2 > M1 > timestamp más temprano del último entregable > voto del comité.
6 ganadores en total: 2 por vertical (1° y 2° lugar).
Score final ganadores = score_mentor × 40% + score_juez × 60%. Desempate ganadores: J3 > J2 > J1 > voto del jurado completo.
Resultados se anuncian en el closing del 7 mayo y se comunican por correo. Disputa formal abierta hasta 1h post-anuncio.
9. Reglas críticas para los equipos
Claude es el motor principal. Otros LLMs como base de la solución descalifican.
No inventes normativa. Si tu agente afirma algo sobre la Ley 21.521, 21.719 u otra norma, debe citar fuente oficial o decir "no sé".
Maneja PII con respeto. Si tu producto recibe RUT, datos bancarios o historial crediticio, declara cómo los proteges y minimiza su uso.
Construí en la ventana. Código y contenido que existan antes del 6 mayo 00:00 o después del 7 mayo 23:59 no cuentan.
El equipo domina lo que construyó. En el Q&A del pitch, los jueces preguntan por arquitectura, decisiones de modelo y cómo manejarían edge cases.
10. Propiedad intelectual
Cada equipo mantiene la propiedad intelectual de su trabajo. Al participar, autorizan a la organización a usar nombre de proyecto, equipo, imágenes y un resumen del trabajo con fines de comunicación del evento.

11. Descalificación
Violar el Código de Conducta, plagiar trabajo, intentar re-identificar datasets o manipular el proceso de evaluación son causales de descalificación inmediata. Los gates definidos en la sección 7 también aplican.

12. Contacto
Dudas durante el evento: Bendi (agente IA 24/7 en la plataforma del Lab).
Temas formales y apelaciones (dentro de las 24h post-pitch): hackathon@benditaia.cl

