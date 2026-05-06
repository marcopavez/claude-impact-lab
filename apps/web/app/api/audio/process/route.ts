// POST /api/audio/process — pipeline audio-first stateless (N20).
// Recibe multipart con un audio del llamante, lo transcribe (ElevenLabs Scribe v1),
// redacta PII determinísticamente, y delega al Call Triage. Sin DB, sin auth,
// sin storage: el buffer del audio vive solo durante el request.
//
// Contrato canónico: lib/api/audio-process.types.ts
// Sub-checks: A3 (canal audio upload), B2 (Scribe + Triage tools), B3 (mensajes
// consola en ventana), B4 (demo end-to-end), J3.3 (latencia <30s).

import { randomUUID } from "node:crypto";

import { runCallTriage } from "@/lib/agents/call-triage";
import { transcribeAudio } from "@/lib/clients/elevenlabs";
import { redact } from "@/lib/validators/pii";
import {
  AUDIO_PROCESS_LIMITS,
  type AcceptedMimeType,
  type AudioProcessError,
  type AudioProcessErrorCode,
  type AudioProcessSuccess,
  type PiiRedactionSummary,
} from "@/lib/api/audio-process.types";
import type { PiiKind } from "@/lib/validators/pii";

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

  // ----- 7. Call Triage -----
  const triageStartedAt = Date.now();
  let triageResult: Awaited<ReturnType<typeof runCallTriage>>;
  try {
    triageResult = await runCallTriage({
      caller_id: callerId,
      caller_in_whitelist: false, // Sin DB en MVP — el demo público no tiene whitelist.
      whitelist_entry: null,
      protected_name: protectedName,
      caller_transcript: piiResult.redacted,
    });
  } catch (err) {
    return jsonError(
      "TRIAGE_FAILED",
      err instanceof Error
        ? `Triage falló: ${err.message}`
        : "El Triage falló inesperadamente.",
      500,
    );
  }
  const triageElapsed = Date.now() - triageStartedAt;

  const decision = triageResult.ok
    ? triageResult.decision
    : triageResult.fallback_decision;
  const failReason = triageResult.ok ? undefined : triageResult.reason;
  const canaryPresent = triageResult.ok
    ? triageResult.decision.canary_present
    : triageResult.reason === "canary_leaked";

  // ----- 8. Build success response -----
  const success: AudioProcessSuccess = {
    ok: true,
    audio_id: randomUUID(),
    transcript_redacted: piiResult.redacted,
    pii_summary: piiSummary,
    decision,
    models_used: ["elevenlabs/scribe_v1", "claude-sonnet-4-6"],
    tools_used: ["elevenlabs.speechToText", "claude.tool_use:decide_action"],
    latency_ms: {
      stt_ms: sttElapsed,
      pii_redact_ms: redactElapsed,
      triage_ms: triageElapsed,
      total_ms: Date.now() - totalStartedAt,
    },
    canary_present: canaryPresent,
    ...(failReason && { fail_reason: failReason }),
  };

  return Response.json(success, { status: 200 });
}
