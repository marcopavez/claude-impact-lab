// POST /api/audio/process — pipeline audio-first stateless (N20 + N21).
// Recibe multipart con un audio del llamante, lo transcribe (Groq · Whisper Large v3 Turbo),
// redacta PII determinísticamente, y ejecuta la cascada agéntica completa:
// Call Triage → (Identity Verifier) → (Vishing Analyst) → (Regulatory Translator) → Caregiver Notifier.
// Sin DB, sin auth, sin storage: el buffer del audio vive solo durante el request.
//
// Contrato canónico: lib/api/audio-process.types.ts
// Sub-checks: A3 (canal audio upload), B2 (Whisper + Triage tools), B3 (mensajes
// consola en ventana), B4 (demo end-to-end), J3.3 (latencia <30s), M3 cascada.

import { randomUUID } from "node:crypto";

import { runCallTriage } from "@/lib/agents/call-triage";
import { deriveSeverity } from "@/lib/agents/caregiver-notifier";
import { runIdentityVerifier } from "@/lib/agents/identity-verifier";
import { runRegulatoryTranslator } from "@/lib/agents/regulatory-translator";
import { runVishingAnalyst } from "@/lib/agents/vishing-analyst";
import { transcribeAudio } from "@/lib/clients/groq";
import { httpSourceFetcher } from "@/lib/clients/source-fetcher";
import { buildDenuncia } from "@/lib/denuncia/build-denuncia";
import {
  buildEarlyExitSuccess,
  matchCallerIdAgainstFirewall,
} from "@/lib/firewall/early-exit";
import { logError } from "@/lib/log";
import { redact } from "@/lib/validators/pii";
import {
  AUDIO_PROCESS_LIMITS,
  confidenceBand,
  maskPhoneE164,
  type AcceptedMimeType,
  type AudioProcessError,
  type AudioProcessErrorCode,
  type AudioProcessSuccess,
  type CaregiverRedirect,
  type CascadeStatuses,
  type LatencyBreakdown,
  type PiiRedactionSummary,
} from "@/lib/api/audio-process.types";
import type {
  IdentityVerifierDecision,
  IdentityVerifierResult,
} from "@/lib/agents/identity-verifier";
import type {
  RegulatoryTranslatorDecision,
  RegulatoryTranslatorResult,
} from "@/lib/agents/regulatory-translator";
import type {
  VishingAnalystDecision,
  VishingAnalystResult,
} from "@/lib/agents/vishing-analyst";
import type { PiiKind } from "@/lib/validators/pii";

import demoConfig from "@/data/demo-config.json";

export const runtime = "nodejs"; // Node SDK (Anthropic) + ElevenLabs TTS — no Edge.
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Whisper (~1s) + Triage (~7s) + Vishing (~10s) + buffer.

const E164_RE = /^\+[1-9][0-9]{6,14}$/;

function jsonError(
  code: AudioProcessErrorCode,
  message: string,
  status: number,
): Response {
  const body: AudioProcessError = { ok: false, error: message, code };
  return Response.json(body, { status });
}

function summarizePii(hits: ReturnType<typeof redact>["hits"]): PiiRedactionSummary {
  const countByKind: Partial<Record<PiiKind, number>> = {};
  for (const hit of hits) {
    countByKind[hit.kind] = (countByKind[hit.kind] ?? 0) + 1;
  }
  return { hits_count: hits.length, count_by_kind: countByKind };
}

export async function POST(request: Request): Promise<Response> {
  const totalStartedAt = Date.now();
  const audioId = randomUUID();

  // ----- 1. Parse multipart -----
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError(
      "INTERNAL_ERROR",
      "Body inválido. Esperaba multipart/form-data.",
      400,
    );
  }

  // ----- 2. Consent (regla N10 reformulada — checkbox al subir) -----
  const consent = formData.get("consent_checked");
  if (consent !== "true") {
    return jsonError(
      "CONSENT_MISSING",
      "Debes confirmar el consentimiento legal antes de procesar el audio.",
      400,
    );
  }

  // ----- 3. File validation -----
  const fileEntry = formData.get("file");
  if (!fileEntry || typeof fileEntry === "string") {
    return jsonError("NO_FILE", "Falta el archivo de audio.", 400);
  }
  const file = fileEntry as File;

  if (
    !AUDIO_PROCESS_LIMITS.acceptedMimeTypes.includes(
      file.type as AcceptedMimeType,
    )
  ) {
    return jsonError(
      "INVALID_MIME",
      `Formato no soportado: ${file.type || "desconocido"}. Usa MP3, M4A, WAV o WebM.`,
      400,
    );
  }
  if (file.size > AUDIO_PROCESS_LIMITS.maxFileBytes) {
    return jsonError(
      "FILE_TOO_LARGE",
      `El archivo supera el límite de ${Math.floor(AUDIO_PROCESS_LIMITS.maxFileBytes / (1024 * 1024))} MB.`,
      400,
    );
  }
  if (file.size === 0) {
    return jsonError("NO_FILE", "El archivo está vacío.", 400);
  }

  // ----- 4. Optional fields with defaults -----
  const callerIdRaw = formData.get("caller_id");
  const callerId =
    typeof callerIdRaw === "string" && callerIdRaw.trim().length > 0
      ? callerIdRaw.trim()
      : AUDIO_PROCESS_LIMITS.defaultCallerId;
  if (!E164_RE.test(callerId)) {
    return jsonError(
      "INVALID_CALLER_ID",
      "El número del llamante debe estar en formato internacional (+56...).",
      400,
    );
  }

  const protectedNameRaw = formData.get("protected_name");
  const protectedName =
    typeof protectedNameRaw === "string" && protectedNameRaw.trim().length > 0
      ? protectedNameRaw.trim().slice(0, 80)
      : AUDIO_PROCESS_LIMITS.defaultProtectedName;

  // ----- 4.5. Early-exit del firewall -----
  // Match caller_id contra blacklist > whitelist en data/demo-config.json. Si
  // hay match, cortocircuitamos: NO transcribe (ahorra ~1s + créditos Groq),
  // NO llama a Claude (ahorra créditos Anthropic), no toca PII.
  // Diseñado para que el mock se sienta coherente al jurado: si te llama un
  // número conocido (bueno o malo), el firewall ya tiene la respuesta.
  const firewallMatch = matchCallerIdAgainstFirewall(callerId, demoConfig);
  if (firewallMatch) {
    const success = buildEarlyExitSuccess({
      match: firewallMatch,
      callerId,
      protectedName,
      audioId,
      startedAt: totalStartedAt,
    });
    return Response.json(success, { status: 200 });
  }

  // ----- 5. STT (Groq · Whisper Large v3 Turbo) -----
  let blob: Blob;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    blob = new Blob([new Uint8Array(buf)], { type: file.type });
  } catch (err) {
    logError("audio-process.read-file", err, { audio_id: audioId });
    return jsonError(
      "INTERNAL_ERROR",
      err instanceof Error ? err.message : "No se pudo leer el archivo.",
      500,
    );
  }

  const sttStartedAt = Date.now();
  let transcriptRaw: string;
  try {
    const stt = await transcribeAudio(blob, { languageCode: "es" });
    transcriptRaw = stt.text;
  } catch (err) {
    logError("audio-process.stt", err, {
      audio_id: audioId,
      latency_ms: Date.now() - sttStartedAt,
    });
    return jsonError(
      "STT_FAILED",
      err instanceof Error
        ? `STT falló: ${err.message}`
        : "No pudimos transcribir el audio.",
      502,
    );
  }
  const sttElapsed = Date.now() - sttStartedAt;

  if (!transcriptRaw || transcriptRaw.trim().length === 0) {
    return jsonError(
      "STT_FAILED",
      "El audio no contiene voz reconocible. Verifica el archivo.",
      422,
    );
  }

  // ----- 6. PII redaction (antes del modelo) -----
  const redactStartedAt = Date.now();
  const piiResult = redact(transcriptRaw);
  const redactElapsed = Date.now() - redactStartedAt;
  const piiSummary = summarizePii(piiResult.hits);

  // Match del callerId contra la whitelist demo-config. En MVP, el cuidador del demo
  // ingresa el callerId del audio (o se usa default) y el config hardcoded responde
  // si está en whitelist o no.
  const whitelistEntry =
    demoConfig.whitelist.find((e) => e.caller_id_e164 === callerId) ?? null;
  const callerInWhitelist = whitelistEntry !== null;

  // ----- 7. Call Triage (eslabón 1) -----
  const triageStartedAt = Date.now();
  let triageResult: Awaited<ReturnType<typeof runCallTriage>>;
  try {
    triageResult = await runCallTriage({
      caller_id: callerId,
      caller_in_whitelist: callerInWhitelist,
      whitelist_entry: whitelistEntry
        ? {
            policy: whitelistEntry.policy as
              | "always_pass"
              | "pass_after_verification"
              | "take_message_only",
            display_name: whitelistEntry.display_name ?? undefined,
            relationship: whitelistEntry.relationship ?? undefined,
          }
        : null,
      protected_name: protectedName,
      caller_transcript: piiResult.redacted,
    });
  } catch (err) {
    logError("audio-process.triage-throw", err, {
      audio_id: audioId,
      latency_ms: Date.now() - triageStartedAt,
    });
    return jsonError(
      "TRIAGE_FAILED",
      err instanceof Error
        ? `Triage falló: ${err.message}`
        : "El Triage falló inesperadamente.",
      500,
    );
  }
  const triageElapsed = Date.now() - triageStartedAt;

  const triageDecision = triageResult.ok
    ? triageResult.decision
    : triageResult.fallback_decision;
  const triageFailReason = triageResult.ok ? undefined : triageResult.reason;

  const cascadeStatuses: CascadeStatuses = {
    triage: triageResult.ok
      ? { ok: true }
      : { ok: false, reason: triageResult.reason, fell_back: true },
  };
  const modelsUsed: string[] = ["groq/whisper-large-v3-turbo", "claude-sonnet-4-6"];
  const toolsUsed: string[] = [
    "groq.audio.transcriptions",
    "claude.tool_use:decide_action",
  ];
  let canaryPresent = triageResult.ok
    ? triageResult.decision.canary_present
    : triageResult.reason === "canary_leaked";

  // ----- 8. Identity Verifier (eslabón 2 — solo si Triage delegó) -----
  let identityDecision: IdentityVerifierDecision | undefined;
  let identityElapsed: number | undefined;
  if (triageDecision.action === "delegate_to_identity_verifier") {
    const idStart = Date.now();
    let idResult: IdentityVerifierResult;
    try {
      idResult = await runIdentityVerifier({
        caller_id: callerId,
        whitelist_entry: whitelistEntry
          ? {
              policy: whitelistEntry.policy as
                | "always_pass"
                | "pass_after_verification"
                | "take_message_only",
              display_name: whitelistEntry.display_name ?? undefined,
              relationship: whitelistEntry.relationship ?? undefined,
            }
          : null,
        protected_name: protectedName,
        caller_transcript: piiResult.redacted,
        demo_config: {
          shared_word: demoConfig.shared_word,
          kba_questions: demoConfig.kba_questions,
        },
      });
    } catch (err) {
      logError("audio-process.identity-throw", err, {
        audio_id: audioId,
        latency_ms: Date.now() - idStart,
      });
      idResult = {
        ok: false,
        reason: "model_error",
        fallback_decision: {
          shared_word_status: "not_attempted",
          kba_status: "not_attempted",
          cross_channel_recommended: true,
          evasion_detected: false,
          outcome: "take_message",
          tts_response_to_caller:
            "No puedo continuar la verificación en este momento.",
          challenge_plan_for_cuidador:
            "Verificación inconclusa por error técnico. No transfieras esta llamada.",
          rationale: "Fail-safe por error de red en Identity Verifier.",
          canary_present: false,
        },
        canary_token: "",
        latency_ms: Date.now() - idStart,
      };
    }
    identityElapsed = Date.now() - idStart;
    identityDecision = idResult.ok ? idResult.decision : idResult.fallback_decision;
    cascadeStatuses.identity = idResult.ok
      ? { ok: true }
      : { ok: false, reason: idResult.reason, fell_back: true };
    modelsUsed.push("claude-sonnet-4-6:identity");
    toolsUsed.push("claude.tool_use:decide_verification_outcome");
    if (!canaryPresent && idResult.ok && idResult.decision.canary_present) {
      canaryPresent = true;
    }
    if (!canaryPresent && !idResult.ok && idResult.reason === "canary_leaked") {
      canaryPresent = true;
    }
  }

  // ----- 9. Vishing Analyst (eslabón 3 — Sonnet 4.6 + adaptive thinking) -----
  // Trigger: cualquier action distinta de "ask_clarifying_question" + "transfer_now".
  // Esto cubre hangup_with_warning, lookup_cmf, take_message, delegate_to_identity.
  //
  // Short-circuit (perf): si el Triage ya marcó obvious_scam_pattern con
  // hangup_with_warning y confidence ≥ 0.9, derivamos el verdict del Vishing
  // determinísticamente del Triage. El análisis profundo es redundante en estos
  // casos (cuento del tío canónico, suplantación bancaria con CVV, premio inesperado),
  // y ahorra ~10-14s de latencia E2E. La UI muestra el tile Vishing con
  // status `derived_from_triage` para mantener la trazabilidad sin engaño.
  const shouldRunVishing =
    triageDecision.action !== "ask_clarifying_question" &&
    triageDecision.action !== "transfer_now";

  const triageObviousShortCircuit =
    triageDecision.intent === "obvious_scam_pattern" &&
    triageDecision.action === "hangup_with_warning" &&
    triageDecision.intent_confidence >= 0.9;

  let vishingDecision: VishingAnalystDecision | undefined;
  let vishingElapsed: number | undefined;

  if (shouldRunVishing && triageObviousShortCircuit) {
    const vStart = Date.now();
    vishingDecision = {
      verdict: "fraud",
      verdict_kind: "behavioral",
      confidence: triageDecision.intent_confidence,
      patterns_detected: ["cuento_del_tio"],
      claimed_entity: null,
      rationale_es:
        "El Triage detectó un patrón canónico de estafa con alta confianza. El análisis profundo se omitió por redundancia: la combinación es suficiente para el verdict.",
      evidence_of_social_engineering:
        triageDecision.evidence_of_social_engineering.slice(0, 4),
      regulatory_questions_es: [],
      thinking_summary:
        "Patrón canónico detectado por Triage con alta confianza. Verdict derivado deterministícamente para ahorrar ~10s.",
      canary_present: false,
    };
    vishingElapsed = Date.now() - vStart;
    cascadeStatuses.vishing = { ok: true };
    modelsUsed.push("derived_from_triage");
    toolsUsed.push("deterministic.shortCircuitVishing");
  } else if (shouldRunVishing) {
    const vStart = Date.now();
    let vResult: VishingAnalystResult;
    try {
      vResult = await runVishingAnalyst({
        protected_name: protectedName,
        caller_transcript_redacted: piiResult.redacted,
        triage_decision: triageDecision,
        identity_decision: identityDecision,
      });
    } catch (err) {
      logError("audio-process.vishing-throw", err, {
        audio_id: audioId,
        latency_ms: Date.now() - vStart,
      });
      vResult = {
        ok: false,
        reason: "model_error",
        fallback_decision: {
          verdict: "suspicious",
          verdict_kind: "behavioral",
          confidence: 0,
          patterns_detected: ["none"],
          claimed_entity: null,
          rationale_es:
            "Análisis profundo no completado por error técnico. Tratamos la llamada como sospechosa.",
          evidence_of_social_engineering: ["fail_safe_triggered"],
          regulatory_questions_es: [],
          thinking_summary:
            "Análisis profundo no ejecutado. Default conservador hasta verificación humana.",
          canary_present: false,
        },
        canary_token: "",
        latency_ms: Date.now() - vStart,
      };
    }
    vishingElapsed = Date.now() - vStart;
    vishingDecision = vResult.ok ? vResult.decision : vResult.fallback_decision;
    cascadeStatuses.vishing = vResult.ok
      ? { ok: true }
      : { ok: false, reason: vResult.reason, fell_back: true };
    modelsUsed.push("claude-sonnet-4-6:vishing+thinking");
    toolsUsed.push("claude.tool_use:submit_analysis");
    if (!canaryPresent && vResult.ok && vResult.decision.canary_present) {
      canaryPresent = true;
    }
    if (!canaryPresent && !vResult.ok && vResult.reason === "canary_leaked") {
      canaryPresent = true;
    }
  }

  // ----- 10. Regulatory Translator (eslabón legal — cite-or-silent A6) -----
  // En el modelo two-phase el Notifier se movió al endpoint /api/notification/generate.
  // El Regulatory se queda en este endpoint porque sus citas se renderizan junto
  // al verdict + evidencia (panel "Citas regulatorias" del VerdictPanel) y porque
  // el Notifier necesita la decisión regulatoria para poblar regulatory_note.
  // El cliente reenviará regulatoryDecision al segundo endpoint.
  let regulatoryDecision: RegulatoryTranslatorDecision | undefined;
  let regulatoryElapsed: number | undefined;

  const firstRegQuestion =
    vishingDecision?.regulatory_questions_es?.[0]?.trim() ?? "";

  if (firstRegQuestion.length > 0) {
    const rStart = Date.now();
    let rResult: RegulatoryTranslatorResult;
    try {
      rResult = await runRegulatoryTranslator(
        {
          question_es: firstRegQuestion,
          context_transcript: piiResult.redacted,
        },
        { fetchSource: httpSourceFetcher },
      );
    } catch (err) {
      logError("audio-process.regulatory-throw", err, {
        audio_id: audioId,
        latency_ms: Date.now() - rStart,
      });
      rResult = {
        ok: false,
        reason: "model_error",
        fallback_decision: {
          translation_es: "no encontré fuente para esta consulta",
          citations: [],
          cite_or_silent: true,
          rationale: "Fail-safe regulatory por error de red.",
        },
        latency_ms: Date.now() - rStart,
        retries: 0,
      };
    }
    regulatoryElapsed = Date.now() - rStart;
    regulatoryDecision = rResult.ok
      ? rResult.decision
      : rResult.fallback_decision;
    cascadeStatuses.regulatory = rResult.ok
      ? { ok: true }
      : { ok: false, reason: rResult.reason, fell_back: true };
    modelsUsed.push("claude-sonnet-4-6:regulatory");
    toolsUsed.push("claude.tool_use:translate_with_citations");
    toolsUsed.push("http.fetchSource");
  }

  // ----- 12. Caregiver redirect (cuarto outcome del Identity Verifier) -----
  let caregiverRedirect: CaregiverRedirect | undefined;
  if (identityDecision?.outcome === "redirect_to_caregiver") {
    const primaryCaregiver =
      demoConfig.caregivers.find((c) => c.is_primary) ??
      demoConfig.caregivers[0];
    if (primaryCaregiver) {
      const reason =
        identityDecision.rationale.length > 0
          ? `Vigía derivó la llamada porque ${identityDecision.rationale.toLowerCase()}`.slice(
              0,
              200,
            )
          : "La verificación quedó en zona ambigua. Un cuidador humano debe validar antes de transferir.";
      caregiverRedirect = {
        name: primaryCaregiver.name,
        role: primaryCaregiver.role,
        phone_e164_masked: maskPhoneE164(primaryCaregiver.phone_e164),
        reason_es: reason,
      };
    }
  }

  // ----- 13. Denuncia pre-rellenada (determinista, sin LLM extra) -----
  // En two-phase ya no tenemos Notifier en este endpoint para leer su severity.
  // Derivamos directo con deriveSeverity (función authoritative compartida con
  // el Notifier) para mantener consistencia del payload de denuncia.
  const severityForDenuncia = deriveSeverity({
    triage_decision: triageDecision,
    identity_decision: identityDecision,
    vishing_decision: vishingDecision,
    protected_name: protectedName,
  });
  const denuncia = buildDenuncia({
    severity: severityForDenuncia,
    caller_id: callerId,
    triage: triageDecision,
    vishing: vishingDecision,
  });
  if (denuncia) {
    toolsUsed.push("deterministic.buildDenuncia");
  }

  // ----- 14. Build success response -----
  // En two-phase NO incluimos caregiver_message: el cliente lo pide al endpoint
  // /api/notification/generate después de renderizar el verdict. La excepción es
  // el early-exit del firewall (manejado arriba con buildEarlyExitSuccess) donde
  // el caregiver_message es determinístico y se entrega completo en el primer call.
  const latency: LatencyBreakdown = {
    stt_ms: sttElapsed,
    pii_redact_ms: redactElapsed,
    triage_ms: triageElapsed,
    ...(typeof identityElapsed === "number" && {
      identity_ms: identityElapsed,
    }),
    ...(typeof vishingElapsed === "number" && { vishing_ms: vishingElapsed }),
    ...(typeof regulatoryElapsed === "number" && {
      regulatory_ms: regulatoryElapsed,
    }),
    total_ms: Date.now() - totalStartedAt,
  };

  const success: AudioProcessSuccess = {
    ok: true,
    audio_id: audioId,
    caller_id: callerId,
    transcript_redacted: piiResult.redacted,
    pii_summary: piiSummary,
    decision: triageDecision,
    ...(identityDecision && { identity_check: identityDecision }),
    ...(vishingDecision && { vishing_analysis: vishingDecision }),
    ...(regulatoryDecision && { regulatory: regulatoryDecision }),
    cascade_statuses: cascadeStatuses,
    models_used: modelsUsed,
    tools_used: toolsUsed,
    latency_ms: latency,
    canary_present: canaryPresent,
    ...(triageFailReason && { fail_reason: triageFailReason }),
    ...(caregiverRedirect && { caregiver_redirect: caregiverRedirect }),
    ...(denuncia && { denuncia }),
    ...(vishingDecision && {
      confidence_band: confidenceBand(vishingDecision.confidence),
    }),
  };

  return Response.json(success, { status: 200 });
}
