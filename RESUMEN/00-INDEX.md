# RESUMEN — Vigía (lectura rápida para el equipo)

Carpeta pensada para onboardear a un compañero en ~10 minutos. Cada archivo es independiente y va al hueso.

> 🔄 **Pivote N20 (2026-05-06) Lean MVP/PoC.** El MVP **no usa Twilio, Deepgram, base de datos ni auth**. "Algo funcional > algo arquitectónicamente correcto". Servidor stateless, audio en memoria, fuentes y config demo en JSON estático, render del verdict en pantalla. Toda la capa de persistencia + auth + cross-channel push se mueve a V2. Detalle en `06-DECISIONES.md` y `docs/SEGURIDAD.md §31` Bloque 7.

| Archivo | Qué responde | Cuándo leerlo |
|---|---|---|
| `01-PROYECTO.md` | Qué es Vigía, a quién protege, por qué importa | Primera lectura. Para pitch y contexto. |
| `02-ARQUITECTURA.md` | Stack Lean MVP, cascada de agentes, diagrama mínimo | Cuando vayas a tocar código o explicar el sistema. |
| `03-SEGURIDAD.md` | Identity Firewall + threat model (vectores y defensas) | Antes de tocar prompts, tools o lógica de transferencia. |
| `04-FLUJO-LLAMADA.md` | Qué pasa cuando entra un audio sospechoso (MVP Lean) + roadmap V2 phone-first | Para entender el procesamiento end-to-end. |
| `05-PRIVACIDAD.md` | Cero PII en reposo, Ley 21.719, consentimiento | Antes de loguear, persistir o exportar datos. |
| `06-DECISIONES.md` | Qué elegimos y qué descartamos (con el porqué) | Cuando alguien pregunte "¿y por qué no usamos X?". |
| `07-RUBRICA.md` | Cómo cada parte del sistema defiende la rúbrica del Lab | Para preparar demo y Q&A con jurado. |

## Reglas no negociables (resumen ultra-corto)

1. **Claude es el motor único.** Otro LLM como motor → descalificación.
2. **Cita o calla.** Toda afirmación regulatoria con cita oficial validada o "no encontré fuente".
3. **Deny-by-default en el firewall.** Caller-ID solo NO basta nunca. Siempre factor adicional para transferir. En MVP el firewall opera contra `data/demo-config.json` hardcoded para María (motor de detección + challenge plan recomendado).
4. **Cero PII en reposo en MVP (N20).** El audio entra, se procesa, se descarta. Sin DB, sin signed URLs, sin TTL.
5. **Consentimiento legal explícito.** Checkbox al subir audio + texto en onboarding PWA. La marca no se persiste. En V2 con telefonía: notificación en primer TTS.
6. **Ventana sagrada.** Código de aplicación solo dentro de la ventana 6-mayo. Antes y después: solo `docs/`.
7. **Lean over correcto (N20).** Cada componente justifica su existencia frente al pitch + Q&A. Si no aporta al demo, queda en V2.

## Documentos largos (fuente de verdad)

Los archivos de `RESUMEN/` son derivados. Si hay disputa, manda el doc largo:

- `docs/PROYECTO.md` — concepto, ficha cívica, arquitectura, decisiones, privacidad.
- `docs/PLAN.md` — capas Core/Sólido/Wow, tracks técnicos, fallbacks, sub-checks operativos, KPIs, Q&A. **Anexo C = vigente Lean MVP**, Anexo B = histórico audio-first con DB, cuerpo principal = V2 phone-first.
- `docs/SEGURIDAD.md` — threat model, Identity Firewall, PWA, prompts canónicos, golden set, **decisiones cerradas N1–N20** (incluye N20 Lean MVP).
- `docs/EVENT/` — bases, rúbrica y datasets oficiales (autoridad final).
