// POST /api/notification/generate — segunda fase del flujo two-phase.
//
// El primer endpoint (/api/audio/process) detecta el fraude y devuelve verdict +
// evidencia + denuncia + redirect en ~12-22s. El cliente renderiza eso inmediatamente
// y dispara este endpoint para que Claude Haiku 4.5 arme el mensaje 65+ accionable
// (headline + summary + first_action + secondary_actions + counter_script_es +
// regulatory_note + push_title/body). Mientras este endpoint trabaja (~5-6s), el
// panel "plan de acción" del VerdictPanel muestra spinner.
//
// Stateless: el cliente reenvía las decisiones de la cascada y este endpoint NO
// re-ejecuta Triage/Vishing/Regulatory — solo el Notifier. Sin DB, sin sesión.
//
// Sub-checks: B2 (tool_use submit_notification), B3 (mensaje extra a la consola
// Anthropic en ventana), M3 (separación de eslabones agénticos visible al jurado).

import { runCaregiverNotifier } from "@/lib/agents/caregiver-notifier";
import { logError } from "@/lib/log";
import type {
  CaregiverNotifierDecision,
  CaregiverNotifierResult,
} from "@/lib/agents/caregiver-notifier";
import type {
  NotificationGenerateError,
  NotificationGenerateErrorCode,
  NotificationGenerateRequest,
  NotificationGenerateSuccess,
} from "@/lib/api/audio-process.types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

function jsonError(
  code: NotificationGenerateErrorCode,
  message: string,
  status: number,
): Response {
  const body: NotificationGenerateError = { ok: false, error: message, code };
  return Response.json(body, { status });
}

function isObject(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

export async function POST(request: Request): Promise<Response> {
  const startedAt = Date.now();

  // ----- 1. Parse JSON body -----
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(
      "INVALID_BODY",
      "Body inválido. Esperaba JSON.",
      400,
    );
  }

  if (!isObject(body)) {
    return jsonError("INVALID_BODY", "Body debe ser un objeto.", 400);
  }

  // ----- 2. Validación mínima del contrato -----
  if (typeof body.audio_id !== "string" || body.audio_id.length === 0) {
    return jsonError("INVALID_BODY", "Falta audio_id.", 400);
  }
  if (
    typeof body.protected_name !== "string" ||
    body.protected_name.length === 0
  ) {
    return jsonError("INVALID_BODY", "Falta protected_name.", 400);
  }
  if (!isObject(body.triage_decision)) {
    return jsonError(
      "MISSING_TRIAGE",
      "Falta triage_decision (eslabón obligatorio).",
      400,
    );
  }

  // Cast controlado: arriba ya validamos que sean objetos. Cualquier campo faltante
  // fallará en el Notifier con buildFailSafe + status fell_back, que es exactamente
  // lo que queremos (resilient: nunca dejamos al cliente sin caregiver_message).
  const input = body as unknown as NotificationGenerateRequest;

  // ----- 3. Run Caregiver Notifier -----
  let result: CaregiverNotifierResult;
  try {
    result = await runCaregiverNotifier({
      protected_name: input.protected_name,
      triage_decision: input.triage_decision,
      identity_decision: input.identity_decision,
      vishing_decision: input.vishing_decision,
      // Pasamos undefined adrede: el regulatory_note se inyecta determinísticamente
      // post-merge (igual que en el endpoint principal antes del split). Esto evita
      // que el modelo invente parafraseando la traducción regulatoria.
      regulatory_decision: undefined,
    });
  } catch (err) {
    logError("notification-generate.notifier-throw", err, {
      audio_id: input.audio_id,
      latency_ms: Date.now() - startedAt,
    });
    return jsonError(
      "NOTIFIER_FAILED",
      err instanceof Error
        ? `Notifier falló: ${err.message}`
        : "El Notifier falló inesperadamente.",
      500,
    );
  }

  const decision: CaregiverNotifierDecision = result.ok
    ? result.decision
    : result.fallback_decision;

  // ----- 4. Post-merge regulatory_note (igual lógica que el endpoint principal) -----
  if (
    input.regulatory_decision &&
    input.regulatory_decision.cite_or_silent === false &&
    input.regulatory_decision.citations.length > 0 &&
    decision.regulatory_note.length === 0
  ) {
    const sourceLabel = input.regulatory_decision.citations[0].source_id;
    const translation = input.regulatory_decision.translation_es.trim();
    const PREFIX = `Según ${sourceLabel}: `;
    const MAX = 350;
    const room = MAX - PREFIX.length;
    decision.regulatory_note =
      PREFIX +
      (translation.length <= room
        ? translation
        : translation.slice(0, Math.max(0, room - 1)).trimEnd() + "…");
  }

  const success: NotificationGenerateSuccess = {
    ok: true,
    audio_id: input.audio_id,
    caregiver_message: decision,
    status: result.ok
      ? { ok: true }
      : { ok: false, reason: result.reason, fell_back: true },
    models_used: ["claude-haiku-4-5:notifier"],
    tools_used: ["claude.tool_use:submit_notification"],
    latency_ms: Date.now() - startedAt,
    canary_present: result.ok ? result.decision.canary_present : false,
  };

  return Response.json(success, { status: 200 });
}
