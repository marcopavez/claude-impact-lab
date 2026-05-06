// Contrato compartido entre el endpoint POST /api/audio/process,
// el frontend PWA y cualquier consumidor (smoke tests, golden-set runner).
// Sin DB en MVP (N20): el response se devuelve in-memory y no persiste nada.

import type {
  CallTriageDecision,
  CallTriageFailReason,
} from "../agents/call-triage";
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
  total_ms: number;
};

export type PiiRedactionSummary = {
  /** Total de hits redactados en el transcript. */
  hits_count: number;
  /** Conteo por tipo (RUT, PHONE, CARD, IBAN, ACCOUNT). */
  count_by_kind: Partial<Record<PiiKind, number>>;
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
  /** Modelos invocados durante el procesamiento (rúbrica B3 + M3 multi-modelo). */
  models_used: string[];
  /** Tools/clientes invocados (rúbrica B2). */
  tools_used: string[];
  latency_ms: LatencyBreakdown;
  /** ¿Se detectó intento de exfiltrar canary token? Si true, el Triage cayó a fail-safe. */
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
    "El formato del audio no es compatible. Usá MP3, M4A, WAV o WebM.",
  FILE_TOO_LARGE: "El archivo supera los 10 MB. Probá con un audio más corto.",
  CONSENT_MISSING:
    "Debés confirmar que el llamante fue notificado de la grabación.",
  INVALID_CALLER_ID:
    "El número del llamante debe estar en formato internacional (+56...).",
  STT_FAILED:
    "No pudimos transcribir el audio. Verificá que se escucha y reintentá.",
  TRIAGE_FAILED:
    "El análisis no pudo completarse. Por seguridad, tratá la llamada como sospechosa.",
  INTERNAL_ERROR: "Error inesperado. Reintentá en unos segundos.",
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

/** Etiqueta humana corta (≤24 chars) por action — para badge accesible en español chileno claro. */
export const ACTION_LABEL_ES: Record<CallTriageDecision["action"], string> = {
  hangup_with_warning: "Llamada bloqueada",
  delegate_to_identity_verifier: "Verificación pendiente",
  lookup_cmf_then_take_message: "Mensaje + verificación",
  take_message: "Mensaje guardado",
  ask_clarifying_question: "Pidiendo aclaración",
  transfer_now: "Transferencia",
};

/** Descripción larga por action — para tooltip o párrafo descriptivo accesible. */
export const ACTION_DESCRIPTION_ES: Record<
  CallTriageDecision["action"],
  string
> = {
  hangup_with_warning:
    "Vigía detectó señales claras de estafa y cortó la llamada. No es necesaria acción del cuidador.",
  delegate_to_identity_verifier:
    "El llamante dice ser familiar. Vigía iniciará verificación con palabra clave + canal alternativo antes de transferir.",
  lookup_cmf_then_take_message:
    "El llamante dice ser de un banco. Vigía verifica la entidad en CMF y toma mensaje, sin transferir.",
  take_message:
    "Servicio o llamada legítima sin urgencia. Vigía tomó el mensaje para revisar más tarde.",
  ask_clarifying_question:
    "El motivo del llamado no quedó claro. Vigía pide aclaración antes de decidir.",
  transfer_now: "Llamada verificada como segura. Transferida al titular.",
};
