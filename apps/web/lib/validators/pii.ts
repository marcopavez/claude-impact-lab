// PII redactor — determinista, sin LLM, NFKC + strip invisibles.
// Fuente canónica: docs/SEGURIDAD.md §5.1 (normalización + V14) + §5.4 (reglas RUT/móvil/tarjeta/cuenta).
// Se invoca en 3 puntos del pipeline: antes del modelo, antes de logs, antes de embeddings.

export type PiiKind =
  | "RUT"
  | "PHONE"
  | "CARD"
  | "IBAN"
  | "ACCOUNT";

export type PiiHit = {
  kind: PiiKind;
  start: number;
  end: number;
  raw: string;
};

export type RedactResult = {
  redacted: string;
  hits: PiiHit[];
  normalized: string;
};

const PLACEHOLDER: Record<PiiKind, string> = {
  RUT: "<RUT_REDACTED>",
  PHONE: "<PHONE_REDACTED>",
  CARD: "<CARD_REDACTED>",
  IBAN: "<IBAN_REDACTED>",
  ACCOUNT: "<ACCOUNT_REDACTED>",
};

// V14 (encoding attacks): zero-width, RTL/LTR override, BOM, Unicode tag chars.
// Range strip cubre U+200B..U+200F, U+202A..U+202E, U+2060..U+206F, U+FEFF, U+E0000..U+E007F.
const INVISIBLE_RE =
  /[​-‏‪-‮⁠-⁯﻿]|[\u{E0000}-\u{E007F}]/gu;

export function normalize(input: string): string {
  return input.normalize("NFKC").replace(INVISIBLE_RE, "");
}

// ============================================================
// Detectores individuales — devuelven hits con offset sobre la cadena normalizada.
// ============================================================

// RUT chileno con DV (módulo 11): 1-3 dígitos, opc. miles con punto, guión, DV (0-9 o k/K).
// Ej: 12.345.678-9, 12345678-K, 1.234.567-8. Validamos DV para reducir FP.
const RUT_RE = /\b(\d{1,3}(?:\.?\d{3}){1,2})-([\dkK])\b/g;

function rutDigit(body: string): string {
  const digits = body.replace(/\./g, "").split("").reverse();
  const factors = [2, 3, 4, 5, 6, 7];
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += parseInt(digits[i], 10) * factors[i % factors.length];
  }
  const r = 11 - (sum % 11);
  if (r === 11) return "0";
  if (r === 10) return "k";
  return String(r);
}

function detectRut(s: string): PiiHit[] {
  const hits: PiiHit[] = [];
  for (const m of s.matchAll(RUT_RE)) {
    const expected = rutDigit(m[1]);
    const actual = m[2].toLowerCase();
    if (expected !== actual) continue;
    const start = m.index ?? 0;
    hits.push({ kind: "RUT", start, end: start + m[0].length, raw: m[0] });
  }
  return hits;
}

// Móvil chileno: +56 9 XXXX XXXX, 56 9 XXXXXXXX, 9 XXXX XXXX. Tolerante a espacios.
// SEGURIDAD §5.4 dice (?:\+?56\s?9\s?)?\d{4}\s?\d{4} — replicamos exacto pero con
// flag global y \b inicial para no comerse dígitos pegados a cuentas largas.
const PHONE_RE = /(?<![\d-])(?:\+?56\s?9\s?)\d{4}\s?\d{4}(?!\d)/g;

function detectPhone(s: string): PiiHit[] {
  const hits: PiiHit[] = [];
  for (const m of s.matchAll(PHONE_RE)) {
    const start = m.index ?? 0;
    hits.push({ kind: "PHONE", start, end: start + m[0].length, raw: m[0] });
  }
  return hits;
}

// Tarjeta: 13-19 dígitos (Visa/Mastercard/Amex/Diners), separadores opcionales " "
// o "-". Validamos Luhn — sin Luhn cualquier número largo es tarjeta y rompe cuentas.
// Anclamos en dígito inicial+final para no comer separadores externos.
const CARD_RE = /(?<![\d-])\d(?:[ -]?\d){12,18}(?!\d)/g;

function luhn(digitsOnly: string): boolean {
  if (digitsOnly.length < 13 || digitsOnly.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digitsOnly.length - 1; i >= 0; i--) {
    let n = parseInt(digitsOnly[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function detectCard(s: string): PiiHit[] {
  const hits: PiiHit[] = [];
  for (const m of s.matchAll(CARD_RE)) {
    const raw = m[0];
    const digits = raw.replace(/[^0-9]/g, "");
    if (!luhn(digits)) continue;
    const start = m.index ?? 0;
    hits.push({ kind: "CARD", start, end: start + raw.length, raw });
  }
  return hits;
}

// IBAN: 2 letras país + 2 dígitos check + 11..30 alfanuméricos. Validación mod-97.
// PLAN.md Anexo B item 11 lo agrega al redactor. Chile no usa IBAN pero migrantes sí.
const IBAN_RE = /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g;

function ibanMod97(iban: string): boolean {
  const rearranged = iban.slice(4) + iban.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const v = /[0-9]/.test(ch) ? parseInt(ch, 10) : ch.charCodeAt(0) - 55;
    remainder = (remainder * (v < 10 ? 10 : 100) + v) % 97;
  }
  return remainder === 1;
}

function detectIban(s: string): PiiHit[] {
  const hits: PiiHit[] = [];
  for (const m of s.matchAll(IBAN_RE)) {
    if (!ibanMod97(m[0])) continue;
    const start = m.index ?? 0;
    hits.push({ kind: "IBAN", start, end: start + m[0].length, raw: m[0] });
  }
  return hits;
}

// Cuenta bancaria chilena: heurística ≥10 dígitos en contexto (palabras "cuenta",
// "vista", "corriente", "rut" pegado, "transferir", "depositar" cerca). Sin contexto
// la cifra puede ser cualquier cosa, así que exigimos disparador léxico cercano.
// SEGURIDAD §5.4 lo describe como "heurístico ≥10 dígitos en contexto".
const ACCOUNT_RE = /(?<![\d-])\d{10,16}(?!\d)/g;
const ACCOUNT_TRIGGER_RE =
  /\b(cuenta|vista|corriente|rut|transferir|transferencia|deposit\w+|n[uú]mero de cuenta|cta)\b/i;
const ACCOUNT_CONTEXT_WINDOW = 60;

function detectAccount(s: string, taken: Array<[number, number]>): PiiHit[] {
  const hits: PiiHit[] = [];
  for (const m of s.matchAll(ACCOUNT_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (taken.some(([a, b]) => start < b && end > a)) continue;
    const winStart = Math.max(0, start - ACCOUNT_CONTEXT_WINDOW);
    const winEnd = Math.min(s.length, end + ACCOUNT_CONTEXT_WINDOW);
    const context = s.slice(winStart, winEnd);
    if (!ACCOUNT_TRIGGER_RE.test(context)) continue;
    hits.push({ kind: "ACCOUNT", start, end, raw: m[0] });
  }
  return hits;
}

// ============================================================
// Pipeline de redacción
// ============================================================

export function redact(input: string): RedactResult {
  const normalized = normalize(input);

  // Orden importa: RUT, IBAN, CARD, PHONE primero (DV/Luhn/mod97 confiables);
  // ACCOUNT al final con exclusión de spans ya tomados.
  const ordered: PiiHit[] = [];
  ordered.push(...detectRut(normalized));
  ordered.push(...detectIban(normalized));
  ordered.push(...detectCard(normalized));
  ordered.push(...detectPhone(normalized));
  ordered.push(
    ...detectAccount(
      normalized,
      ordered.map((h) => [h.start, h.end] as [number, number]),
    ),
  );

  // Resolver solapamientos: el hit que empieza antes gana; si empate, el más largo.
  ordered.sort((a, b) => a.start - b.start || b.end - b.start - (a.end - a.start));
  const dedup: PiiHit[] = [];
  for (const h of ordered) {
    if (dedup.length === 0 || h.start >= dedup[dedup.length - 1].end) {
      dedup.push(h);
    }
  }

  // Reescritura right-to-left para no invalidar offsets.
  let out = normalized;
  for (let i = dedup.length - 1; i >= 0; i--) {
    const h = dedup[i];
    out = out.slice(0, h.start) + PLACEHOLDER[h.kind] + out.slice(h.end);
  }

  return { redacted: out, hits: dedup, normalized };
}

// Atajo cuando el caller solo necesita el string sin metadatos.
export function redactString(input: string): string {
  return redact(input).redacted;
}
