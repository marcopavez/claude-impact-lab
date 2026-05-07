// Contrato compartido entre el endpoint POST /api/audio/process,
// el frontend PWA y cualquier consumidor (smoke tests, golden-set runner).
// Sin DB en MVP (N20): el response se devuelve in-memory y no persiste nada.

import type {
  CallTriageDecision,
  CallTriageFailReason,
} from "../agents/call-triage";
import type {
  CaregiverNotifierDecision,
  CaregiverNotifierFailReason,
} from "../agents/caregiver-notifier";
import type {
  IdentityVerifierDecision,
  IdentityVerifierFailReason,
} from "../agents/identity-verifier";
import type {
  RegulatoryTranslatorDecision,
  RegulatoryTranslatorFailReason,
} from "../agents/regulatory-translator";
import type {
  VishingAnalystDecision,
  VishingAnalystFailReason,
} from "../agents/vishing-analyst";
import type { PiiKind } from "../validators/pii";

// ============================================================
// Request — multipart/form-data
// ============================================================

export const AUDIO_PROCESS_LIMITS = {
  /** ≤10MB cubre 60s mp3 a 192kbps con margen. */
  maxFileBytes: 10 * 1024 * 1024,
  acceptedMimeTypes: [
    "audio/mpeg",
    "audio/mp4",
    "audio/m4a",
    "audio/x-m4a",
    "audio/wav",
    "audio/x-wav",
    "audio/webm",
  ] as const,
  /** Default simbólico: en MVP sin DB, el cuidador no necesita registrar caller_id real. */
  defaultCallerId: "+56000000000",
  defaultProtectedName: "el adulto mayor",
} as const;

export type AcceptedMimeType =
  (typeof AUDIO_PROCESS_LIMITS.acceptedMimeTypes)[number];

/** Campos del FormData esperados por el endpoint. */
export type AudioProcessFormFields = {
  /** Audio del llamante. mp3/m4a/wav/webm, ≤10MB. */
  file: File;
  /** Debe ser exactamente "true". Sin esto, el endpoint responde 400 CONSENT_MISSING. */
  consent_checked: "true";
  /** Opcional. E.164 (+56...). Default: AUDIO_PROCESS_LIMITS.defaultCallerId. */
  caller_id?: string;
  /** Opcional. Primer nombre. Default: "el adulto mayor". */
  protected_name?: string;
};

// ============================================================
// Response 200 — éxito
// ============================================================

export type LatencyBreakdown = {
  stt_ms: number;
  pii_redact_ms: number;
  triage_ms: number;
  /** Solo presente si Triage delegó a Identity Verifier. */
  identity_ms?: number;
  /** Solo presente si la cascada invocó Vishing Analyst (verdict ≠ legit o sospecha). */
  vishing_ms?: number;
  /** Solo presente si Vishing pidió citas regulatorias. */
  regulatory_ms?: number;
  /** Siempre presente cuando Triage devolvió ok=true. */
  notifier_ms?: number;
  total_ms: number;
};

export type PiiRedactionSummary = {
  /** Total de hits redactados en el transcript. */
  hits_count: number;
  /** Conteo por tipo (RUT, PHONE, CARD, IBAN, ACCOUNT). */
  count_by_kind: Partial<Record<PiiKind, number>>;
};

/** Estado por agente de la cascada, incluyendo fallback. */
export type CascadeStageStatus<F extends string> =
  | { ok: true }
  | { ok: false; reason: F; fell_back: true };

export type CascadeStatuses = {
  triage: CascadeStageStatus<CallTriageFailReason>;
  identity?: CascadeStageStatus<IdentityVerifierFailReason>;
  vishing?: CascadeStageStatus<VishingAnalystFailReason>;
  regulatory?: CascadeStageStatus<RegulatoryTranslatorFailReason>;
  notifier?: CascadeStageStatus<CaregiverNotifierFailReason>;
};

export type AudioProcessSuccess = {
  ok: true;
  /** UUID v4 generado in-memory. Solo para correlación de logs/UI; NO persiste. */
  audio_id: string;
  /** Transcript con PII determinísticamente redactada (RUT, móviles, cuentas, etc.). */
  transcript_redacted: string;
  /** Resumen de la redacción aplicada — útil para que el cuidador entienda qué se filtró. */
  pii_summary: PiiRedactionSummary;
  /** Decisión completa del Call Triage. Schema canónico en lib/agents/call-triage.ts. */
  decision: CallTriageDecision;
  /** Identity Verifier decision (presente si Triage delegó a "delegate_to_identity_verifier"). */
  identity_check?: IdentityVerifierDecision;
  /** Vishing Analyst decision (presente si la cascada gatilló análisis profundo). */
  vishing_analysis?: VishingAnalystDecision;
  /** Regulatory Translator decision (presente si Vishing pidió citas regulatorias). */
  regulatory?: RegulatoryTranslatorDecision;
  /** Mensaje accionable consolidado para el cuidador (siempre presente cuando Triage ok). */
  caregiver_message?: CaregiverNotifierDecision;
  /** Estado por agente — útil para auditar dónde cayó la cascada. */
  cascade_statuses: CascadeStatuses;
  /** Modelos invocados durante el procesamiento (rúbrica B3 + M3 multi-modelo). */
  models_used: string[];
  /** Tools/clientes invocados (rúbrica B2). */
  tools_used: string[];
  latency_ms: LatencyBreakdown;
  /** ¿Se detectó intento de exfiltrar canary token? Si true, algún eslabón cayó a fail-safe. */
  canary_present: boolean;
  /** Si el Triage cayó a fail-safe (canary_leaked / schema_invalid / model_error), aquí va el motivo. */
  fail_reason?: CallTriageFailReason;
};

// ============================================================
// Response 4xx/5xx — error
// ============================================================

export type AudioProcessErrorCode =
  | "NO_FILE"
  | "INVALID_MIME"
  | "FILE_TOO_LARGE"
  | "CONSENT_MISSING"
  | "INVALID_CALLER_ID"
  | "STT_FAILED"
  | "TRIAGE_FAILED"
  | "INTERNAL_ERROR";

export type AudioProcessError = {
  ok: false;
  error: string;
  code: AudioProcessErrorCode;
};

export type AudioProcessResponse = AudioProcessSuccess | AudioProcessError;

// ============================================================
// Helpers para el frontend
// ============================================================

/** Lookup user-friendly del status code para mostrar en UI accesible. */
export const ERROR_MESSAGES_ES: Record<AudioProcessErrorCode, string> = {
  NO_FILE: "No se adjuntó archivo de audio.",
  INVALID_MIME:
    "El formato del audio no es compatible. Usa MP3, M4A, WAV o WebM.",
  FILE_TOO_LARGE: "El archivo supera los 10 MB. Prueba con un audio más corto.",
  CONSENT_MISSING:
    "Debes confirmar que el llamante fue notificado de la grabación.",
  INVALID_CALLER_ID:
    "El número del llamante debe estar en formato internacional (+56...).",
  STT_FAILED:
    "No pudimos transcribir el audio. Verifica que se escucha y reintenta.",
  TRIAGE_FAILED:
    "El análisis no pudo completarse. Por seguridad, trata la llamada como sospechosa.",
  INTERNAL_ERROR: "Error inesperado. Reintenta en unos segundos.",
};

/** Severidad del badge UI según action del Triage. */
export type UiBadgeSeverity = "danger" | "warning" | "safe" | "neutral";

export function badgeSeverityForAction(
  action: CallTriageDecision["action"],
): UiBadgeSeverity {
  switch (action) {
    case "hangup_with_warning":
      return "danger";
    case "delegate_to_identity_verifier":
    case "ask_clarifying_question":
      return "warning";
    case "lookup_cmf_then_take_message":
    case "take_message":
      return "neutral";
    case "transfer_now":
      return "safe";
  }
}

/** Severidad del badge UI según el Caregiver Notifier (canónico cuando la cascada completó). */
export function badgeSeverityForCaregiver(
  severity: CaregiverNotifierDecision["severity"],
): UiBadgeSeverity {
  switch (severity) {
    case "HIGH":
      return "danger";
    case "MEDIUM":
      return "warning";
    case "LOW":
      return "neutral";
  }
}

/**
 * Selector unificado: si el Notifier produjo un mensaje, su severity es la canónica
 * (consolida triage + identity + vishing). Si no (cascada cortada en Triage), caemos
 * al mapping del Triage para no romper UI cuando solo hay decisión del primer eslabón.
 */
export function badgeSeverityForResponse(
  result: AudioProcessSuccess,
): UiBadgeSeverity {
  if (result.caregiver_message) {
    return badgeSeverityForCaregiver(result.caregiver_message.severity);
  }
  return badgeSeverityForAction(result.decision.action);
}

// Las etiquetas describen lo que Vigía DETECTÓ en el audio que el cuidador subió.
// El MVP/PoC analiza audios pre-grabados; no cortamos llamadas en vivo. Evitamos verbos
// como "bloquear / cortar / transferir" que sugieren acción telefónica en tiempo real.

/** Etiqueta humana corta (≤24 chars) por action — para badge accesible en español chileno claro. */
export const ACTION_LABEL_ES: Record<CallTriageDecision["action"], string> = {
  hangup_with_warning: "Estafa detectada",
  delegate_to_identity_verifier: "Verificación pendiente",
  lookup_cmf_then_take_message: "Verifica el banco",
  take_message: "Sin acciones urgentes",
  ask_clarifying_question: "Motivo poco claro",
  transfer_now: "Audio sin señales",
};

/** Descripción larga por action — para tooltip o párrafo descriptivo accesible. */
export const ACTION_DESCRIPTION_ES: Record<
  CallTriageDecision["action"],
  string
> = {
  hangup_with_warning:
    "Vigía detectó señales claras de estafa en este audio. No devuelvas la llamada al número que llamó.",
  delegate_to_identity_verifier:
    "El llamante dice ser familiar. Antes de devolver la llamada, verifica con palabra clave y llama tú al número real conocido del familiar.",
  lookup_cmf_then_take_message:
    "El llamante dice ser de un banco. Antes de cualquier acción, llama tú al número oficial del banco que aparece en la tarjeta o el sitio oficial.",
  take_message:
    "Llamada sin urgencia ni señales claras de estafa. Revisa el mensaje cuando puedas; no hay acción inmediata.",
  ask_clarifying_question:
    "El motivo del llamado no quedó claro en este audio. Conviene pedir aclaración antes de cualquier acción.",
  transfer_now:
    "Audio sin señales de estafa. No hay acciones urgentes para el cuidador.",
};
