// POST /api/audio/process — pipeline audio-first stateless (N20).
// Recibe multipart con un audio del llamante, lo transcribe (ElevenLabs Scribe v1),
// redacta PII determinísticamente, y ejecuta la cascada agéntica completa:
// Call Triage → (Identity Verifier) → (Vishing Analyst) → (Regulatory Translator) → Caregiver Notifier.
// Sin DB, sin auth, sin storage: el buffer del audio vive solo durante el request.
//
// Contrato canónico: lib/api/audio-process.types.ts
// Sub-checks: A3 (canal audio upload), B2 (Scribe + Triage tools), B3 (mensajes
// consola en ventana), B4 (demo end-to-end), J3.3 (latencia <30s), M3 cascada.

import { randomUUID } from "node:crypto";

import { runCallTriage } from "@/lib/agents/call-triage";
import { runCaregiverNotifier } from "@/lib/agents/caregiver-notifier";
import { runIdentityVerifier } from "@/lib/agents/identity-verifier";
import { runRegulatoryTranslator } from "@/lib/agents/regulatory-translator";
import { runVishingAnalyst } from "@/lib/agents/vishing-analyst";
import { transcribeAudio } from "@/lib/clients/elevenlabs";
import { httpSourceFetcher } from "@/lib/clients/source-fetcher";
import { logError } from "@/lib/log";
import { redact } from "@/lib/validators/pii";
import {
  AUDIO_PROCESS_LIMITS,
  type AcceptedMimeType,
  type AudioProcessError,
  type AudioProcessErrorCode,
  type AudioProcessSuccess,
  type CascadeStatuses,
  type LatencyBreakdown,
  type PiiRedactionSummary,
} from "@/lib/api/audio-process.types";
import type {
  CaregiverNotifierDecision,
  CaregiverNotifierResult,
} from "@/lib/agents/caregiver-notifier";
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

export const runtime = "nodejs"; // Node SDK (Anthropic + ElevenLabs) — no Edge.
export const dynamic = "force-dynamic";
export const maxDuration = 60; // Scribe (~10s) + Triage (~2s) + buffer.

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
      "Debés confirmar el consentimiento legal antes de procesar el audio.",
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
      `Formato no soportado: ${file.type || "desconocido"}. Usá MP3, M4A, WAV o WebM.`,
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

  // ----- 5. STT (ElevenLabs Scribe v1) -----
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
      "El audio no contiene voz reconocible. Verificá el archivo.",
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
  const modelsUsed: string[] = ["elevenlabs/scribe_v1", "claude-sonnet-4-6"];
  const toolsUsed: string[] = [
    "elevenlabs.speechToText",
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

  // ----- 9. Vishing Analyst (eslabón 3 — Opus 4.7 + extended thinking) -----
  // Trigger: cualquier action distinta de "ask_clarifying_question" + "transfer_now".
  // Esto cubre hangup_with_warning, lookup_cmf, take_message, delegate_to_identity.
  // El analista decide después si verdict="legit" cuando no hay patrones.
  const shouldRunVishing =
    triageDecision.action !== "ask_clarifying_question" &&
    triageDecision.action !== "transfer_now";

  let vishingDecision: VishingAnalystDecision | undefined;
  let vishingElapsed: number | undefined;
  if (shouldRunVishing) {
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
          next_steps_es:
            "No devuelvas el llamado al número desconocido. Si te pidieron datos, denunciá a Sernac y PDI Cibercrimen.",
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
    modelsUsed.push("claude-opus-4-7+thinking");
    toolsUsed.push("claude.tool_use:submit_analysis");
    if (!canaryPresent && vResult.ok && vResult.decision.canary_present) {
      canaryPresent = true;
    }
    if (!canaryPresent && !vResult.ok && vResult.reason === "canary_leaked") {
      canaryPresent = true;
    }
  }

  // ----- 10+11. Regulatory Translator + Caregiver Notifier (en paralelo) -----
  // Ambos consumen los outputs de Triage/Identity/Vishing y son independientes
  // entre sí. Lanzamos en paralelo. El Notifier corre con regulatory_decision=undefined;
  // si Regulatory devuelve cita válida, después populamos el regulatory_note del
  // Notifier de forma determinista (sin llamada extra al modelo). Ahorro: ~3-7s
  // de latencia cuando ambos eslabones aplican.
  let regulatoryDecision: RegulatoryTranslatorDecision | undefined;
  let regulatoryElapsed: number | undefined;
  let notifierDecision: CaregiverNotifierDecision | undefined;
  let notifierElapsed: number | undefined;

  const firstRegQuestion =
    vishingDecision?.regulatory_questions_es?.[0]?.trim() ?? "";

  const regulatoryPromise: Promise<{
    result: RegulatoryTranslatorResult | null;
    elapsed: number;
  }> =
    firstRegQuestion.length > 0
      ? (async () => {
          const rStart = Date.now();
          try {
            const r = await runRegulatoryTranslator(
              {
                question_es: firstRegQuestion,
                context_transcript: piiResult.redacted,
              },
              { fetchSource: httpSourceFetcher },
            );
            return { result: r, elapsed: Date.now() - rStart };
          } catch (err) {
            logError("audio-process.regulatory-throw", err, {
              audio_id: audioId,
              latency_ms: Date.now() - rStart,
            });
            return {
              result: {
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
              },
              elapsed: Date.now() - rStart,
            };
          }
        })()
      : Promise.resolve({ result: null, elapsed: 0 });

  const notifierPromise: Promise<{
    result: CaregiverNotifierResult;
    elapsed: number;
  }> = (async () => {
    const nStart = Date.now();
    try {
      const n = await runCaregiverNotifier({
        protected_name: protectedName,
        triage_decision: triageDecision,
        identity_decision: identityDecision,
        vishing_decision: vishingDecision,
        // Paralelo con Regulatory: el Notifier no recibe la decisión regulatoria,
        // y por contrato emite regulatory_note="". Se rellena después si aplica.
        regulatory_decision: undefined,
      });
      return { result: n, elapsed: Date.now() - nStart };
    } catch (err) {
      logError("audio-process.notifier-throw", err, {
        audio_id: audioId,
        latency_ms: Date.now() - nStart,
      });
      return {
        result: {
          ok: false,
          reason: "model_error",
          fallback_decision: {
            severity: "MEDIUM",
            headline: "Audio sospechoso — verificación pendiente",
            summary:
              "El análisis se completó parcialmente. Por seguridad tratamos este audio como sospechoso.",
            first_action:
              "No devuelvas el llamado al número que apareció. Si era importante, llamá vos al número oficial.",
            secondary_actions: [],
            regulatory_note: "",
            push_title: "Vigía: verificación pendiente",
            push_body: "Análisis parcial. Llamá vos al número oficial.",
            canary_present: false,
          },
          canary_token: "",
          latency_ms: Date.now() - nStart,
        },
        elapsed: Date.now() - nStart,
      };
    }
  })();

  const [regulatoryOutcome, notifierOutcome] = await Promise.all([
    regulatoryPromise,
    notifierPromise,
  ]);

  // ----- Procesar resultado de Regulatory -----
  if (regulatoryOutcome.result !== null) {
    const rResult = regulatoryOutcome.result;
    regulatoryElapsed = regulatoryOutcome.elapsed;
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

  // ----- Procesar resultado de Notifier -----
  {
    const nResult = notifierOutcome.result;
    notifierElapsed = notifierOutcome.elapsed;
    notifierDecision = nResult.ok ? nResult.decision : nResult.fallback_decision;
    cascadeStatuses.notifier = nResult.ok
      ? { ok: true }
      : { ok: false, reason: nResult.reason, fell_back: true };
    modelsUsed.push("claude-sonnet-4-6:notifier");
    toolsUsed.push("claude.tool_use:submit_notification");
    if (!canaryPresent && nResult.ok && nResult.decision.canary_present) {
      canaryPresent = true;
    }
    if (!canaryPresent && !nResult.ok && nResult.reason === "canary_leaked") {
      canaryPresent = true;
    }
  }

  // ----- Post-merge: inyectar regulatory_note en el Notifier si Regulatory aportó cita válida -----
  // Como corren en paralelo, el Notifier no podía saber si Regulatory iba a citar.
  // Si tenemos cita válida (cite_or_silent=false y citations≥1), poblamos el
  // regulatory_note de forma determinista, respetando el cap de 350 chars del schema.
  if (
    notifierDecision &&
    regulatoryDecision &&
    regulatoryDecision.cite_or_silent === false &&
    regulatoryDecision.citations.length > 0 &&
    notifierDecision.regulatory_note.length === 0
  ) {
    const sourceLabel = regulatoryDecision.citations[0].source_id;
    const translation = regulatoryDecision.translation_es.trim();
    const PREFIX = `Según ${sourceLabel}: `;
    const MAX = 350;
    const room = MAX - PREFIX.length;
    notifierDecision.regulatory_note =
      PREFIX +
      (translation.length <= room
        ? translation
        : translation.slice(0, Math.max(0, room - 1)).trimEnd() + "…");
  }

  // ----- 12. Build success response -----
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
    ...(typeof notifierElapsed === "number" && {
      notifier_ms: notifierElapsed,
    }),
    total_ms: Date.now() - totalStartedAt,
  };

  const success: AudioProcessSuccess = {
    ok: true,
    audio_id: audioId,
    transcript_redacted: piiResult.redacted,
    pii_summary: piiSummary,
    decision: triageDecision,
    ...(identityDecision && { identity_check: identityDecision }),
    ...(vishingDecision && { vishing_analysis: vishingDecision }),
    ...(regulatoryDecision && { regulatory: regulatoryDecision }),
    ...(notifierDecision && { caregiver_message: notifierDecision }),
    cascade_statuses: cascadeStatuses,
    models_used: modelsUsed,
    tools_used: toolsUsed,
    latency_ms: latency,
    canary_present: canaryPresent,
    ...(triageFailReason && { fail_reason: triageFailReason }),
  };

  return Response.json(success, { status: 200 });
}
