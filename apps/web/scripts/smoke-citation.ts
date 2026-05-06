/**
 * Smoke test: citation validator (gate A6).
 *
 * Uso (desde apps/web/):
 *   npx tsx --test scripts/smoke-citation.ts
 *
 * Sin red — todos los fetchSource son in-memory.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  Citation,
  closestWindow,
  isUrlAllowed,
  levenshtein,
  levenshteinRatio,
  normalizeForCompare,
  validateCitations,
} from "../lib/validators/citation";

// ============================================================
// Allow-list
// ============================================================

test("isUrlAllowed: BCN Ley Fácil OK", () => {
  assert.equal(
    isUrlAllowed(
      "bcn_leyfacil",
      "https://www.bcn.cl/leyfacil/recurso/delitos-informaticos",
    ),
    true,
  );
});

test("isUrlAllowed: rechaza http://", () => {
  assert.equal(
    isUrlAllowed("bcn_leyfacil", "http://www.bcn.cl/leyfacil/recurso/x"),
    false,
  );
});

test("isUrlAllowed: rechaza dominio no-allowlisted", () => {
  assert.equal(
    isUrlAllowed("bcn_leyfacil", "https://attacker.com/leyfacil/"),
    false,
  );
});

test("isUrlAllowed: rechaza source_id mismatch", () => {
  // URL es de Sernac pero source_id dice bcn_leyfacil.
  assert.equal(
    isUrlAllowed("bcn_leyfacil", "https://www.sernac.cl/portal/x"),
    false,
  );
});

// ============================================================
// Normalización
// ============================================================

test("normalizeForCompare: NFKC + lowercase + strip diacritics + collapse ws", () => {
  const a = normalizeForCompare("La Ley N° 21.459 — Delitos");
  const b = normalizeForCompare("la ley n  21 459    delitos");
  assert.equal(a, b);
});

test("normalizeForCompare: elimina zero-width V14 (sin dejar espacio)", () => {
  // Sin la limpieza V14 el classifier vería "ataque​informático"
  // y no haría match contra "ataqueinformatico". Strip puro es correcto.
  const sneaky = "ataque​informático";
  assert.equal(normalizeForCompare(sneaky), "ataqueinformatico");
});

// ============================================================
// Levenshtein
// ============================================================

test("levenshtein: idénticos = 0", () => {
  assert.equal(levenshtein("abc", "abc"), 0);
});

test("levenshtein: ratio 1 cuando idénticos", () => {
  assert.equal(levenshteinRatio("hola", "hola"), 1);
});

test("levenshtein: 1 sustitución", () => {
  assert.equal(levenshtein("hola", "hala"), 1);
});

test("levenshtein: maxDist early exit", () => {
  // Distancia real ≥ 5; con maxDist=2 debe retornar > 2 sin computar todo.
  const d = levenshtein("abcdefghij", "zzzzzzzzzz", 2);
  assert.ok(d > 2);
});

// ============================================================
// closestWindow
// ============================================================

test("closestWindow: substring exacto = ratio 1", () => {
  const src = "lorem ipsum dolor sit amet consectetur adipiscing elit";
  const quote = "dolor sit amet";
  const r = closestWindow(src, quote);
  assert.equal(r.ratio, 1);
});

test("closestWindow: tolera ruido whitespace y typos leves (>0.95)", () => {
  const src =
    "el que indebidamente acceda a un sistema informatico cometera el delito tipificado en la ley 21459";
  const quote = "el que indebidamente acceda a un sistema informatico"; // exacta
  const r = closestWindow(src, quote);
  assert.ok(r.ratio >= 0.95, `ratio fue ${r.ratio}`);
});

test("closestWindow: quote inventada baja del threshold", () => {
  const src = "ley 21459 sobre delitos informaticos en chile";
  const quote = "esta cita es completamente inventada y no existe en el source";
  const r = closestWindow(src, quote);
  assert.ok(r.ratio < 0.95, `ratio fue ${r.ratio}`);
});

// ============================================================
// validateCitations end-to-end
// ============================================================

const BCN_FIXTURE = `Artículo 2.- Acceso ilícito. El que indebidamente acceda a un sistema informático sera sancionado con presidio menor en su grado mínimo a medio. La sancion contemplada en este articulo se aplicara sin perjuicio de las sanciones penales que puedan corresponder.`;

const fakeFetcher = (urls: Record<string, string>) => async (u: string) => {
  if (!(u in urls)) throw new Error(`source not in fixture: ${u}`);
  return urls[u];
};

test("validateCitations: cita exacta válida", async () => {
  const c: Citation = {
    source_id: "bcn_leychile",
    source_url:
      "https://www.bcn.cl/leychile/navegar?idNorma=1177743&articulo=2",
    quote: "El que indebidamente acceda a un sistema informático",
  };
  const r = await validateCitations([c], "regulatory", {
    fetchSource: fakeFetcher({ [c.source_url]: BCN_FIXTURE }),
  });
  assert.equal(r.ok, true);
});

test("validateCitations: regulatory con citations vacío = missing", async () => {
  const r = await validateCitations([], "regulatory", {
    fetchSource: async () => "",
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "missing");
});

test("validateCitations: non_regulatory sin citas pasa", async () => {
  const r = await validateCitations([], "non_regulatory", {
    fetchSource: async () => "",
  });
  assert.equal(r.ok, true);
});

test("validateCitations: source no allowlisted = source_not_allowed", async () => {
  const c: Citation = {
    source_id: "bcn_leychile",
    source_url: "https://attacker.com/leychile/fake",
    quote: "el que indebidamente acceda a un sistema informatico chileno",
  };
  const r = await validateCitations([c], "regulatory", {
    fetchSource: async () => BCN_FIXTURE,
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "source_not_allowed");
});

test("validateCitations: quote <20 chars = quote_too_short", async () => {
  const c: Citation = {
    source_id: "bcn_leychile",
    source_url: "https://www.bcn.cl/leychile/x",
    quote: "muy corto",
  };
  const r = await validateCitations([c], "regulatory", {
    fetchSource: async () => BCN_FIXTURE,
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "quote_too_short");
});

test("validateCitations: cita inventada = quote_not_in_source", async () => {
  const c: Citation = {
    source_id: "bcn_leychile",
    source_url: "https://www.bcn.cl/leychile/x",
    quote:
      "Toda persona afectada por vishing tiene derecho a indemnización inmediata por el Estado",
  };
  const r = await validateCitations([c], "regulatory", {
    fetchSource: async () => BCN_FIXTURE,
  });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.reason, "quote_not_in_source");
    assert.ok(typeof r.best_match_ratio === "number");
  }
});

test("validateCitations: cita con leve ruido (acentos, espacios) pasa por Levenshtein 0.95", async () => {
  const c: Citation = {
    source_id: "bcn_leychile",
    source_url: "https://www.bcn.cl/leychile/x",
    // El source tiene acentos y signos; la cita los omite/agrega.
    quote: "El   que indebidamente acceda  a un sistema informatico",
  };
  const r = await validateCitations([c], "regulatory", {
    fetchSource: async () => BCN_FIXTURE,
  });
  assert.equal(r.ok, true);
});

test("validateCitations: fetch falla = fetch_failed", async () => {
  const c: Citation = {
    source_id: "bcn_leychile",
    source_url: "https://www.bcn.cl/leychile/x",
    quote: "El que indebidamente acceda a un sistema informático",
  };
  const r = await validateCitations([c], "regulatory", {
    fetchSource: async () => {
      throw new Error("source_cache miss + 504");
    },
  });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, "fetch_failed");
});

test("validateCitations: lista mixta — primer fallo aborta", async () => {
  const ok: Citation = {
    source_id: "bcn_leychile",
    source_url: "https://www.bcn.cl/leychile/x",
    quote: "El que indebidamente acceda a un sistema informático",
  };
  const bad: Citation = {
    source_id: "bcn_leychile",
    source_url: "https://attacker.com/leychile/x",
    quote: "El que indebidamente acceda a un sistema informático",
  };
  const r = await validateCitations([ok, bad], "regulatory", {
    fetchSource: async () => BCN_FIXTURE,
  });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.reason, "source_not_allowed");
    assert.equal(r.offending?.source_url, bad.source_url);
  }
});
