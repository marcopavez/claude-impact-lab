/**
 * Smoke test: cascada completa Vigía (Triage → Identity → Vishing → Regulatory → Notifier).
 *
 * Uso (desde apps/web/):
 *   node --env-file=.env.local --import tsx scripts/smoke-cascade.ts
 *
 * Requiere: ANTHROPIC_API_KEY en apps/web/.env.local
 *
 * NO llama a ElevenLabs (no STT) — usamos transcripts redactados ya hechos como fixtures
 * para que el smoke sea barato y reproducible. La cascada tras Triage es exactamente la
 * misma que ejecuta /api/audio/process.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { runCallTriage } from "../lib/agents/call-triage";
import { runCaregiverNotifier } from "../lib/agents/caregiver-notifier";
import { runIdentityVerifier } from "../lib/agents/identity-verifier";
import {
  CITE_OR_SILENT_LITERAL,
  runRegulatoryTranslator,
} from "../lib/agents/regulatory-translator";
import { runVishingAnalyst } from "../lib/agents/vishing-analyst";

import type { CallTriageDecision } from "../lib/agents/call-triage";
import type { IdentityVerifierDecision } from "../lib/agents/identity-verifier";
import type { VishingAnalystDecision } from "../lib/agents/vishing-analyst";
import type { RegulatoryTranslatorDecision } from "../lib/agents/regulatory-translator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "..");

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("✗ ERROR: ANTHROPIC_API_KEY no está definida en el entorno.");
  console.error("  Configurá apps/web/.env.local con tu API key y volvé a correr.");
  process.exit(1);
}

const demoConfig = JSON.parse(
  readFileSync(resolve(repoRoot, "data/demo-config.json"), "utf-8"),
) as {
  protected_person: { first_name: string };
  whitelist: Array<{
    caller_id_e164: string;
    display_name: string;
    relationship: string;
    policy: "always_pass" | "pass_after_verification" | "take_message_only";
    cross_channel_phone_e164: string | null;
  }>;
  shared_word: { value_normalized: string; hint_for_cuidador: string };
  kba_questions: Array<{
    id: string;
    question: string;
    expected_answer_normalized: string;
  }>;
};

// ============================================================
// Fixtures — transcripts ya redactados (lo que el endpoint pasaría a Triage)
// ============================================================

const FIXTURE_CUENTO_DEL_TIO = `Hola abuelita, soy yo, su nieto. Tuve un accidente con la camioneta del taller, choqué con un camión y la grúa la tiene retenida. Necesito que me transfiera ochocientos cincuenta mil pesos urgentes a la cuenta vista que le voy a dictar. Por favor no le diga a mi mamá, ella se preocupa mucho. La cuenta es <ACCOUNT_REDACTED>, está a nombre de Andrés del taller Ruta cinco.`;

// ============================================================
// Source fetcher para Regulatory — fixture in-memory para smoke
// ============================================================

const BCN_LEYFACIL_FIXTURE = `Tu banco nunca te pedirá tu clave por teléfono ni por correo electrónico. Si recibes una llamada o un mensaje sospechoso, no entregues tu clave, tu coordenada de seguridad ni tus datos personales. Cuelga y llama directamente al número que aparece al reverso de tu tarjeta o en el sitio oficial del banco. La Ley N° 20.009 limita la responsabilidad de los usuarios en operaciones con tarjetas y transferencias electrónicas en caso de extravío, hurto, robo o fraude. El usuario debe dar aviso al emisor a la brevedad. Cualquier persona que sea víctima de estafa o intento de estafa por teléfono debe denunciar a la PDI Cibercrimen o presentar reclamo en Sernac.`;

const SERNAC_VISHING_FIXTURE = `Si alguien que dice ser de tu banco te llama y te pide la clave, los códigos de seguridad o que transfieras dinero a otra cuenta, es una estafa. Las instituciones financieras nunca solicitan estos datos por teléfono. Reporta el hecho a Sernac y a la PDI Cibercrimen.`;

const PDI_CIBERCRIMEN_FIXTURE = `La PDI Cibercrimen alerta a la ciudadanía sobre el aumento de llamadas fraudulentas conocidas como "cuento del tío 2.0". Estafadores se hacen pasar por familiares, abogados o personal de hospitales para obtener transferencias urgentes. Recomendaciones: cortar la llamada, llamar usted mismo al número conocido del familiar, denunciar en cualquier unidad policial o en www.pdichile.cl/cibercrimen.`;

const fetchSource = async (url: string): Promise<string> => {
  if (url.startsWith("https://www.bcn.cl/leyfacil/")) return BCN_LEYFACIL_FIXTURE;
  if (url.startsWith("https://www.bcn.cl/leychile/")) return BCN_LEYFACIL_FIXTURE;
  if (url.startsWith("https://www.sernac.cl/")) return SERNAC_VISHING_FIXTURE;
  if (url.startsWith("https://www.pdichile.cl/")) return PDI_CIBERCRIMEN_FIXTURE;
  if (url.startsWith("https://fintech.benditaia.cl/"))
    return BCN_LEYFACIL_FIXTURE;
  throw new Error(`smoke fixture miss: ${url}`);
};

// ============================================================
// Run cascada
// ============================================================

const protectedName = demoConfig.protected_person.first_name;
const callerId = "+56999111222"; // No está en whitelist — caso "desconocido"
const startedAt = Date.now();

console.log("→ smoke-cascade: ejecutando cascada completa…");
console.log(`  protected_name: ${protectedName}`);
console.log(`  caller_id:      ${callerId} (no whitelisted)`);
console.log(`  fixture:        cuento_del_tio (${FIXTURE_CUENTO_DEL_TIO.length} chars)`);
console.log("");

// --------- 1. Triage ---------
console.log("→ [1/5] Call Triage (Sonnet 4.6)…");
const triageStart = Date.now();
const triageResult = await runCallTriage({
  caller_id: callerId,
  caller_in_whitelist: false,
  whitelist_entry: null,
  protected_name: protectedName,
  caller_transcript: FIXTURE_CUENTO_DEL_TIO,
});
const triageElapsed = Date.now() - triageStart;
const triageDecision: CallTriageDecision = triageResult.ok
  ? triageResult.decision
  : triageResult.fallback_decision;
console.log(
  `  ${triageResult.ok ? "✓" : "⚠"} ok=${triageResult.ok} ` +
    `intent=${triageDecision.intent} action=${triageDecision.action} ` +
    `[${triageElapsed}ms]`,
);
if (!triageResult.ok) {
  console.error(`  reason=${triageResult.reason}`);
}
assert.equal(
  triageDecision.action,
  "hangup_with_warning",
  "Triage debe reclasificar cuento del tío a hangup_with_warning",
);
assert.equal(triageDecision.canary_present, false, "no canary leak en Triage");

// --------- 2. Identity Verifier — saltado en este fixture ---------
// Para cuento_del_tio el Triage reclasifica a obvious_scam_pattern + hangup, NO delega
// al Identity. El Identity Verifier se cubre por separado con un fixture "claim_family
// sin patrones de scam" (TODO segunda iteración del smoke).
const identityDecision: IdentityVerifierDecision | undefined = undefined;
console.log("→ [2/5] Identity Verifier — saltado (cuento del tío gatilla hangup directo).");
// Mantenemos los símbolos importados/declarados para que la cascada compile incluso
// cuando el fixture cambia y agregamos un caso family.
void runIdentityVerifier;

// --------- 3. Vishing Analyst (Opus 4.7 + thinking) ---------
console.log("→ [3/5] Vishing Analyst (Opus 4.7 + extended thinking)…");
const vStart = Date.now();
const vResult = await runVishingAnalyst({
  protected_name: protectedName,
  caller_transcript_redacted: FIXTURE_CUENTO_DEL_TIO,
  triage_decision: triageDecision,
  identity_decision: identityDecision,
});
const vElapsed = Date.now() - vStart;
const vishingDecision: VishingAnalystDecision = vResult.ok
  ? vResult.decision
  : vResult.fallback_decision;
console.log(
  `  ${vResult.ok ? "✓" : "⚠"} ok=${vResult.ok} ` +
    `verdict=${vishingDecision.verdict} kind=${vishingDecision.verdict_kind} ` +
    `confidence=${vishingDecision.confidence.toFixed(2)} ` +
    `patterns=${vishingDecision.patterns_detected.join(",")} [${vElapsed}ms]`,
);
if (!vResult.ok) {
  console.error(`  reason=${vResult.reason}`);
}
assert.ok(
  vishingDecision.verdict === "fraud" || vishingDecision.verdict === "suspicious",
  "Vishing debe marcar verdict fraud o suspicious para cuento del tío",
);
assert.equal(
  vishingDecision.canary_present,
  false,
  "no canary leak en Vishing",
);
assert.ok(
  vishingDecision.patterns_detected.length > 0,
  "Vishing debe detectar al menos 1 pattern",
);

// --------- 4. Regulatory (si Vishing pidió citas) ---------
let regulatoryDecision: RegulatoryTranslatorDecision | undefined;
const firstQ = vishingDecision.regulatory_questions_es[0]?.trim() ?? "";
if (firstQ.length > 0) {
  console.log(`→ [4/5] Regulatory Translator — pregunta: "${firstQ}"`);
  const rStart = Date.now();
  const rResult = await runRegulatoryTranslator(
    { question_es: firstQ, context_transcript: FIXTURE_CUENTO_DEL_TIO },
    { fetchSource },
  );
  const rElapsed = Date.now() - rStart;
  regulatoryDecision = rResult.ok ? rResult.decision : rResult.fallback_decision;
  console.log(
    `  ${rResult.ok ? "✓" : "⚠"} ok=${rResult.ok} ` +
      `cite_or_silent=${regulatoryDecision.cite_or_silent} ` +
      `citations=${regulatoryDecision.citations.length} [${rElapsed}ms]`,
  );
  if (regulatoryDecision.cite_or_silent) {
    assert.equal(
      regulatoryDecision.translation_es,
      CITE_OR_SILENT_LITERAL,
      "silencio: literal exacto",
    );
  }
} else {
  console.log("→ [4/5] Regulatory — saltado (Vishing no pidió citas).");
}

// --------- 5. Caregiver Notifier ---------
console.log("→ [5/5] Caregiver Notifier (Sonnet 4.6)…");
const nStart = Date.now();
const nResult = await runCaregiverNotifier({
  protected_name: protectedName,
  triage_decision: triageDecision,
  identity_decision: identityDecision,
  vishing_decision: vishingDecision,
  regulatory_decision: regulatoryDecision,
});
const nElapsed = Date.now() - nStart;
const notifierDecision = nResult.ok ? nResult.decision : nResult.fallback_decision;
console.log(
  `  ${nResult.ok ? "✓" : "⚠"} ok=${nResult.ok} ` +
    `severity=${notifierDecision.severity} [${nElapsed}ms]`,
);
if (!nResult.ok) {
  console.error(`  reason=${nResult.reason}`);
}
assert.equal(
  notifierDecision.severity,
  "HIGH",
  "Cuento del tío debe consolidar severity=HIGH",
);
assert.equal(
  notifierDecision.canary_present,
  false,
  "no canary leak en Notifier",
);
assert.ok(
  notifierDecision.first_action.length > 10,
  "first_action debe ser concreta",
);
assert.ok(
  notifierDecision.headline.length > 0 &&
    notifierDecision.headline.length <= 80,
  "headline ≤80 chars",
);
assert.ok(
  notifierDecision.push_title.length <= 50,
  "push_title ≤50 chars",
);
assert.ok(notifierDecision.push_body.length <= 180, "push_body ≤180 chars");

// ============================================================
// Resumen
// ============================================================

const totalElapsed = Date.now() - startedAt;
console.log("\n=== FINAL CAREGIVER MESSAGE ===");
console.log(`severity:    ${notifierDecision.severity}`);
console.log(`headline:    ${notifierDecision.headline}`);
console.log(`summary:     ${notifierDecision.summary}`);
console.log(`first_action ${notifierDecision.first_action}`);
console.log(`push_title:  ${notifierDecision.push_title}`);
console.log(`push_body:   ${notifierDecision.push_body}`);
if (notifierDecision.regulatory_note.length > 0) {
  console.log(`regulatory:  ${notifierDecision.regulatory_note}`);
}

console.log("\n=== WALL TIME ===");
console.log(`  total: ${totalElapsed}ms`);
console.log(`  triage: ${triageElapsed}ms · vishing: ${vElapsed}ms · notifier: ${nElapsed}ms`);

console.log("\n✓ Smoke OK: cascada completa entregó verdict HIGH con first_action concreta.");
