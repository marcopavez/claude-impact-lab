# RESUMEN — Vigía (lectura rápida para el equipo)

Carpeta pensada para onboardear a un compañero en ~10 minutos. Cada archivo es independiente y va al hueso.

| Archivo | Qué responde | Cuándo leerlo |
|---|---|---|
| `01-PROYECTO.md` | Qué es Vigía, a quién protege, por qué importa | Primera lectura. Para pitch y contexto. |
| `02-ARQUITECTURA.md` | Stack, cascada de agentes, diagrama mínimo | Cuando vayas a tocar código o explicar el sistema. |
| `03-SEGURIDAD.md` | Identity Firewall + threat model (vectores y defensas) | Antes de tocar prompts, tools o lógica de transferencia. |
| `04-FLUJO-LLAMADA.md` | Qué pasa segundo a segundo cuando entra una llamada | Para entender la integración Twilio ↔ Deepgram ↔ Claude. |
| `05-PRIVACIDAD.md` | PII, Ley 21.719, consentimiento, retención | Antes de loguear, persistir o exportar datos. |
| `06-DECISIONES.md` | Qué elegimos y qué descartamos (con el porqué) | Cuando alguien pregunte "¿y por qué no usamos X?". |
| `07-RUBRICA.md` | Cómo cada parte del sistema defiende la rúbrica del Lab | Para preparar demo y Q&A con jurado. |

## Reglas no negociables (resumen ultra-corto)

1. **Claude es el motor único.** Otro LLM como motor → descalificación.
2. **Cita o calla.** Toda afirmación regulatoria con cita oficial validada o "no encontré fuente".
3. **Deny-by-default en el firewall.** Caller-ID solo NO basta nunca. Siempre factor adicional para transferir.
4. **PII al mínimo y efímera.** Redacción regex chilena → modelo → logs. Audios TTL 24h.
5. **Consentimiento legal en el primer TTS.** *"Esta llamada está siendo analizada para protección"*.
6. **Ventana sagrada.** Código de aplicación solo dentro de la ventana 6-mayo. Antes y después: solo `docs/`.

## Documentos largos (fuente de verdad)

Los archivos de `RESUMEN/` son derivados. Si hay disputa, manda el doc largo:

- `docs/PROYECTO.md` — concepto, ficha cívica, arquitectura, decisiones, privacidad.
- `docs/PLAN.md` — capas Core/Sólido/Wow, tracks técnicos, fallbacks, sub-checks operativos, KPIs, Q&A.
- `docs/SEGURIDAD.md` — threat model, Identity Firewall, PWA cuidador, prompts canónicos, golden set, decisiones cerradas N1–N18.
- `docs/EVENT/` — bases, rúbrica y datasets oficiales (autoridad final).
