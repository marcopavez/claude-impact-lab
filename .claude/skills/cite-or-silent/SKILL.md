---
name: cite-or-silent
description: Use to refactor any Vigía agent response that makes a regulatory claim into the cite-or-silent contract. Either the response carries citations[] minItems 1 with verifiable quoted_text from a canonical source, OR it returns the literal "no encontré fuente para esta consulta". Validates against the post-validator (substring + Levenshtein 0.95). Triggers - "reescribe esta respuesta con citas", "esto necesita cita", "verifica A6", "cite or silent".
---

# Skill — cite-or-silent (sustento operativo de A6)

## Cuándo invocar

Cualquier respuesta que afirma algo regulatorio chileno (leyes, plazos CSIRT, normativas CMF, derechos Sernac, procedimientos PDI) debe pasar por este filtro antes de ir al usuario o de servir como base de un prompt. Si el agente no puede citar, **debe responder literalmente**:

> "no encontré fuente para esta consulta"

Sin parafraseo. Sin "no estoy seguro pero". Literal.

## Schema canonical de respuesta

```json
{
  "answer": "...",
  "citations": [
    {
      "claim": "El plazo de notificación CSIRT para incidentes de alto impacto es de 3 horas.",
      "source_url": "https://www.bcn.cl/leychile/navegar?idNorma=1199311",
      "quoted_text": "El servicio o el órgano público obligado deberá reportar al CSIRT Nacional, dentro del plazo de 3 horas...",
      "regulation": "Ley 21.663 art. 8"
    }
  ],
  "confidence": "high" | "medium" | "low"
}
```

`citations` array tiene `minItems: 1` cuando `answer` afirma algo regulatorio. Si vacía → la respuesta debe ser exactamente la frase de silencio.

## Procedimiento

1. **Detectar afirmaciones regulatorias** en el draft:
   - Plazos numéricos (`3h`, `72h`, `15 días`)
   - Nombres de leyes (`Ley 21.459`, `21.521`, `21.663`, `21.719`, `19.628`)
   - Derechos / procedimientos (ARCO+, denuncia Sernac, registro CMF)
   - Sanciones, multas, autoridades
2. **Para cada afirmación:**
   a. Identificá fuente canónica candidata (whitelist: bcn.cl, cmfchile.cl, sernac.cl, csirt.gob.cl, pdichile.cl, subtel.gob.cl, sii.cl, bcentral.cl, fintech.benditaia.cl/es/wiki-legal).
   b. WebFetch sobre la URL.
   c. Buscás texto literal que respalde la afirmación (substring exacto preferido; Levenshtein ≥0.95 fallback).
   d. Si encontrás → construí el objeto citation. Si no → marcala como `unsupported`.
3. **Reconstrucción:**
   - Si TODAS las afirmaciones tienen cita → emitís el JSON con `citations[]` populated.
   - Si AL MENOS UNA es `unsupported` → reescribís el `answer` para excluir esa afirmación (o reformularla como "consultar [organismo]" sin afirmar el detalle), Y si no queda ninguna afirmación regulatoria, dejás answer = `"no encontré fuente para esta consulta"`.
   - Mezcla parcial: `answer` cubre solo lo citable + cierra con "para [tema sin fuente] consulte directamente a [organismo]".
4. **Validación final:** invocás el subagent `citation-validator` con el output. Solo emitís a Marco si verdict = pass.

## Plantilla de "cite or silent" purista

Cuando estás 100% seguro que no hay fuente:

```json
{
  "answer": "no encontré fuente para esta consulta",
  "citations": [],
  "confidence": "low",
  "reason": "tema fuera del corpus regulatorio canónico (ej: práctica bancaria interna, opinión legal)"
}
```

Esta es la respuesta CORRECTA cuando corresponde. No es una falla — es lo que la rúbrica A6 premia.

## Anti-patrones

- **No inventes citation_url.** Si no fetcheaste, no cites. La validación posterior te va a hundir.
- **No uses "según fuentes oficiales..." sin URL.** Es palabra hueca.
- **No combines fuentes no canónicas** (Wikipedia, Medium, blog jurídico) ni siquiera como apoyo. La whitelist es estricta.
- **No parafrasees el silencio.** "No tengo claridad sobre eso" no cuenta. La frase es literal.
- **No respondas regulación con "depende del caso".** Si depende, citás la norma que dice de qué depende.

## Output de la skill

Diff sobre el draft original mostrando:
- Afirmaciones detectadas (lista)
- Por cada una: fuente verificada / unsupported
- Draft refactorizado con schema completo
- Verdict del citation-validator: pass/fail
- Próximo paso si fail (qué fuente buscar / qué afirmación cortar)
