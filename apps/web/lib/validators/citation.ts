// Citation validator (gate A6 — sub-check binario).
// Algoritmo canónico: docs/SEGURIDAD.md §7.
// Determinista, sin LLM. Corre post-generación: si falla, retry 1× con feedback;
// segundo fallo → fail-safe verdict.

// ============================================================
// Tipos públicos
// ============================================================

export type SourceId =
  | "wiki_legal_fintech"
  | "bcn_leyfacil"
  | "bcn_leychile"
  | "cmf_alertas"
  | "cmf_registro_fintec"
  | "csirt"
  | "sii"
  | "sernac"
  | "pdi_cibercrimen"
  | "subtel";

export type Citation = {
  source_id: SourceId;
  source_url: string;
  quote: string;
  retrieved_at?: string;
};

export type VerdictKind =
  | "regulatory"
  | "mixed"
  | "fraud"
  | "non_regulatory";

export type ValidationFailure =
  | "missing"
  | "source_not_allowed"
  | "quote_too_short"
  | "quote_not_in_source"
  | "fetch_failed";

export type ValidationResult =
  | { ok: true }
  | {
      ok: false;
      reason: ValidationFailure;
      offending?: Citation;
      detail?: string;
      best_match_ratio?: number;
    };

export type SourceFetcher = (url: string) => Promise<string>;

export type ValidateOptions = {
  fetchSource: SourceFetcher;
  minQuoteLength?: number;       // default 20 (per §7)
  levenshteinThreshold?: number; // default 0.95 (per §7)
};

// ============================================================
// Allow-list (docs/SEGURIDAD.md §7)
// ============================================================

const ALLOW_PREFIXES: Record<SourceId, string[]> = {
  wiki_legal_fintech: ["https://fintech.benditaia.cl/es/wiki-legal/"],
  bcn_leyfacil: ["https://www.bcn.cl/leyfacil/"],
  bcn_leychile: ["https://www.bcn.cl/leychile/"],
  cmf_alertas: ["https://www.cmfchile.cl/portal/principal/613/"],
  cmf_registro_fintec: [
    "https://www.cmfchile.cl/portal/principal/613/w3-propertyvalue-",
    "https://www.cmfchile.cl/portal/prensa/",
    "https://www.cmfchile.cl/portal/principal/613/articles-",
  ],
  csirt: ["https://www.csirt.gob.cl/"],
  sii: ["https://www.sii.cl/"],
  sernac: ["https://www.sernac.cl/"],
  pdi_cibercrimen: ["https://www.pdichile.cl/"],
  subtel: ["https://www.subtel.gob.cl/"],
};

export function isUrlAllowed(sourceId: SourceId, url: string): boolean {
  const prefixes = ALLOW_PREFIXES[sourceId];
  if (!prefixes) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  return prefixes.some((p) => url.startsWith(p));
}

// ============================================================
// Normalización (defensa V14 + tolerancia a OCR)
// ============================================================

const INVISIBLE_RE =
  /[​-‏‪-‮⁠-⁯﻿]|[\u{E0000}-\u{E007F}]/gu;
const WHITESPACE_RE = /\s+/g;
// Cualquier cosa que no sea letra/dígito/espacio ASCII pasa a espacio. Es agresivo
// pero apropiado para comparación de citas: queremos tolerar puntuación, símbolos
// (°, —, §, ¶, comillas curvas) y diferencias de OCR.
const NON_WORD_RE = /[^a-z0-9\s]/g;

export function normalizeForCompare(s: string): string {
  return s
    .normalize("NFKC")
    .replace(INVISIBLE_RE, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(NON_WORD_RE, " ")
    .replace(WHITESPACE_RE, " ")
    .trim();
}

// ============================================================
// Levenshtein con corte temprano (Wagner-Fischer + early exit)
// ============================================================

export function levenshtein(a: string, b: string, maxDist?: number): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  if (maxDist !== undefined && Math.abs(m - n) > maxDist) {
    return maxDist + 1;
  }

  // Dos filas alternantes — memoria O(min(m,n)).
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    let rowMin = curr[0];
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost,
      );
      if (curr[j] < rowMin) rowMin = curr[j];
    }
    if (maxDist !== undefined && rowMin > maxDist) {
      return maxDist + 1;
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

export function levenshteinRatio(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const d = levenshtein(a, b);
  const denom = Math.max(a.length, b.length);
  return 1 - d / denom;
}

// ============================================================
// Closest-window search
// ============================================================

// Localiza el sub-string del source más parecido al quote, con tolerancia a
// whitespace/OCR. Estrategia:
//   1. Pick ANCHOR = primeros 12 chars alfanuméricos del quote normalizado.
//   2. Encuentra todas las ocurrencias del anchor en el source.
//   3. Para cada ocurrencia, considera ventanas de longitud len(quote) ± 20%.
//   4. Devuelve la ventana con mejor levenshteinRatio.
// Si el anchor no aparece, hace un slide con paso = len(quote)/4.
const ANCHOR_LEN = 12;
const WINDOW_TOLERANCE = 0.2;
const MAX_CANDIDATES = 200;

export function closestWindow(
  source: string,
  quote: string,
): { window: string; ratio: number } {
  if (quote.length === 0) {
    return { window: "", ratio: source.length === 0 ? 1 : 0 };
  }
  if (source.length === 0) return { window: "", ratio: 0 };

  const qLen = quote.length;
  const minWin = Math.max(1, Math.floor(qLen * (1 - WINDOW_TOLERANCE)));
  const maxWin = Math.ceil(qLen * (1 + WINDOW_TOLERANCE));

  // Anchor = primer chunk alfanumérico del quote, hasta ANCHOR_LEN.
  const anchorMatch = quote.match(/[a-z0-9]+/);
  const anchor =
    anchorMatch && anchorMatch[0].length >= 4
      ? anchorMatch[0].slice(0, ANCHOR_LEN)
      : "";

  const candidates: number[] = [];
  if (anchor.length >= 4) {
    let from = 0;
    while (candidates.length < MAX_CANDIDATES) {
      const idx = source.indexOf(anchor, from);
      if (idx === -1) break;
      candidates.push(idx);
      from = idx + 1;
    }
  }

  // Si no hubo anchor o candidatos: barrido grueso con paso qLen/4.
  if (candidates.length === 0) {
    const step = Math.max(1, Math.floor(qLen / 4));
    for (let i = 0; i + minWin <= source.length; i += step) {
      candidates.push(i);
      if (candidates.length >= MAX_CANDIDATES) break;
    }
  }

  let best = { window: "", ratio: 0 };
  for (const start of candidates) {
    for (
      let len = minWin;
      len <= maxWin && start + len <= source.length;
      len += Math.max(1, Math.floor((maxWin - minWin) / 4) || 1)
    ) {
      const win = source.slice(start, start + len);
      const ratio = levenshteinRatio(win, quote);
      if (ratio > best.ratio) {
        best = { window: win, ratio };
        if (best.ratio === 1) return best;
      }
    }
  }
  return best;
}

// ============================================================
// Validador principal
// ============================================================

export async function validateCitations(
  citations: Citation[],
  verdictKind: VerdictKind,
  options: ValidateOptions,
): Promise<ValidationResult> {
  const minQuoteLength = options.minQuoteLength ?? 20;
  const threshold = options.levenshteinThreshold ?? 0.95;

  if (
    citations.length === 0 &&
    (verdictKind === "regulatory" || verdictKind === "mixed")
  ) {
    return { ok: false, reason: "missing" };
  }

  for (const c of citations) {
    if (!isUrlAllowed(c.source_id, c.source_url)) {
      return {
        ok: false,
        reason: "source_not_allowed",
        offending: c,
        detail: `URL fuera de allow-list para ${c.source_id}`,
      };
    }

    if (c.quote.length < minQuoteLength) {
      return {
        ok: false,
        reason: "quote_too_short",
        offending: c,
        detail: `Cita debe tener ≥${minQuoteLength} chars; tiene ${c.quote.length}`,
      };
    }

    let raw: string;
    try {
      raw = await options.fetchSource(c.source_url);
    } catch (err) {
      return {
        ok: false,
        reason: "fetch_failed",
        offending: c,
        detail: err instanceof Error ? err.message : "fetch error",
      };
    }

    const srcNorm = normalizeForCompare(raw);
    const quoteNorm = normalizeForCompare(c.quote);

    if (srcNorm.includes(quoteNorm)) continue;

    const { ratio } = closestWindow(srcNorm, quoteNorm);
    if (ratio >= threshold) continue;

    return {
      ok: false,
      reason: "quote_not_in_source",
      offending: c,
      detail: "Cita no aparece en el source ni con tolerancia Levenshtein 0.95",
      best_match_ratio: ratio,
    };
  }

  return { ok: true };
}

// ============================================================
// Fail-safe message (docs/SEGURIDAD.md §5.6)
// ============================================================

export const FAIL_SAFE_VERDICT =
  "No pude verificar este mensaje con fuentes oficiales. Por seguridad, trátalo como sospechoso y no compartas datos personales ni hagas clic en enlaces. Verifica directo con tu banco llamando al número del reverso de tu tarjeta.";
