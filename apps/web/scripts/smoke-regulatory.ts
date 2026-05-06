/**
 * Smoke test: Regulatory Translator agent (gate A6 — cite-or-silent).
 *
 * Uso (desde apps/web/):
 *   node --env-file=.env.local --import tsx scripts/smoke-regulatory.ts
 *
 * Requiere: ANTHROPIC_API_KEY en apps/web/.env.local
 */

import assert from "node:assert/strict";

import {
  CITE_OR_SILENT_LITERAL,
  runRegulatoryTranslator,
} from "../lib/agents/regulatory-translator";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("✗ ERROR: ANTHROPIC_API_KEY no está definida en el entorno.");
  console.error("  Configurá apps/web/.env.local con tu API key y volvé a correr.");
  process.exit(1);
}

const BCN_LEYFACIL_BANCO_FIXTURE = `Tu banco nunca te pedirá tu clave por teléfono ni por correo electrónico. Si recibes una llamada o un mensaje sospechoso, no entregues tu clave, tu coordenada de seguridad ni tus datos personales. Cuelga y llama directamente al número que aparece al reverso de tu tarjeta o en el sitio oficial del banco.

La Ley N° 20.009 limita la responsabilidad de los usuarios en operaciones con tarjetas y transferencias electrónicas en caso de extravío, hurto, robo o fraude. El usuario debe dar aviso al emisor a la brevedad.

Cualquier persona que sea víctima de estafa o intento de estafa por teléfono debe denunciar a la PDI Cibercrimen o presentar reclamo en Sernac.`;

const SERNAC_VISHING_FIXTURE = `Si alguien que dice ser de tu banco te llama y te pide la clave, los códigos de seguridad o que transfieras dinero a otra cuenta, es una estafa. Las instituciones financieras nunca solicitan estos datos por teléfono. Reporta el hecho a Sernac y a la PDI Cibercrimen.`;

const FAKE_SOURCES: Record<string, string> = {
  "https://www.bcn.cl/leyfacil/recurso/uso-fraudulento-de-tarjetas-y-transferencias-(ley-no-20009)":
    BCN_LEYFACIL_BANCO_FIXTURE,
  "https://www.bcn.cl/leyfacil/recurso/seguridad-bancaria":
    BCN_LEYFACIL_BANCO_FIXTURE,
  "https://www.sernac.cl/portal/604/w3-article-72056.html": SERNAC_VISHING_FIXTURE,
};

const fetchSource = async (url: string): Promise<string> => {
  if (url in FAKE_SOURCES) return FAKE_SOURCES[url];
  if (url.startsWith("https://www.bcn.cl/leyfacil/")) return BCN_LEYFACIL_BANCO_FIXTURE;
  if (url.startsWith("https://www.sernac.cl/")) return SERNAC_VISHING_FIXTURE;
  if (url.startsWith("https://www.bcn.cl/leychile/")) return BCN_LEYFACIL_BANCO_FIXTURE;
  throw new Error(`smoke fixture miss: ${url}`);
};

console.log("→ smoke-regulatory: ejecutando Regulatory Translator…");

const startedAt = Date.now();
const result = await runRegulatoryTranslator(
  {
    question_es:
      "¿Qué dice la ley chilena sobre que un banco te pida la clave por teléfono?",
  },
  { fetchSource },
);
const wallMs = Date.now() - startedAt;

console.log("\n=== RESULT ===");
console.log(JSON.stringify(result, null, 2));
console.log("\n=== WALL TIME ===");
console.log(`  ${wallMs} ms`);

if (!result.ok) {
  console.error("\n✗ FAIL: result.ok=false");
  console.error("  reason:", result.reason);
  console.error("  retries:", result.retries);
  console.error("  fallback_decision:", result.fallback_decision);
  process.exit(1);
}

assert.equal(result.ok, true, "result.ok debe ser true");
assert.ok(
  typeof result.decision.translation_es === "string" &&
    result.decision.translation_es.length > 0,
  "translation_es no vacío",
);
assert.equal(
  typeof result.decision.cite_or_silent,
  "boolean",
  "cite_or_silent es boolean",
);

if (result.decision.cite_or_silent) {
  assert.equal(
    result.decision.translation_es,
    CITE_OR_SILENT_LITERAL,
    "silencio: translation_es debe ser el literal exacto",
  );
  assert.equal(
    result.decision.citations.length,
    0,
    "silencio: citations debe estar vacío",
  );
  console.log(
    "\n✓ Smoke OK (camino silencio): el modelo silenció con literal exacto.",
  );
} else {
  assert.ok(
    result.decision.citations.length > 0,
    "no-silencio: citations.length debe ser ≥ 1",
  );
  for (const c of result.decision.citations) {
    assert.ok(c.source_url.startsWith("https://"), "citation.source_url https://");
    assert.ok(c.quote.length >= 20, "citation.quote ≥ 20 chars");
  }
  console.log(
    `\n✓ Smoke OK (camino citas): ${result.decision.citations.length} cita(s) validadas.`,
  );
}

console.log(`  retries:        ${result.retries}`);
console.log(`  latency_ms:     ${result.latency_ms}`);
console.log(
  `  tokens:         in=${result.tokens.input} out=${result.tokens.output}`,
);
