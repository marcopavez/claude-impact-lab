// Contrato compartido entre el endpoint POST /api/audio/process,
// el frontend PWA y cualquier consumidor (smoke tests, golden-set runner).
// Sin DB en MVP (N20): el response se devuelve in-memory y no persiste nada.

import type {
  CallTriageDecision,
  CallTriageFailReason,
  WhitelistPolicy,
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
  /**
   * Echo del caller_id E.164 que mandó el formulario (default
   * AUDIO_PROCESS_LIMITS.defaultCallerId si no se envió). Necesario en UI
   * para permitir agregar el número a la blacklist personal del usuario
   * (IndexedDB) o derivarlo a las acciones del veredicto.
   */
  caller_id: string;
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
  /**
   * Recomendación de derivar a un humano de confianza cuando la cascada quedó
   * en zona ambigua (whitelist hit + shared word incorrecto, claim familiar
   * no verificado, severity MEDIUM con cross_channel_recommended). Solo presente
   * si identity_check.outcome === "redirect_to_caregiver".
   */
  caregiver_redirect?: CaregiverRedirect;
  /**
   * Texto de denuncia pre-rellenado + links a portales oficiales (PDI, Sernac,
   * CSIRT). Generado deterministamente en el orquestador (sin LLM extra). Solo
   * presente cuando severity ≥ MEDIUM o verdict ∈ {fraud, suspicious}.
   */
  denuncia?: DenunciaPayload;
  /**
   * Banda de confianza derivada deterministamente desde vishing_analysis.confidence
   * para mostrarla en UI como "alta / media / baja" en vez de un número crudo.
   * Solo presente si vishing_analysis está presente.
   */
  confidence_band?: ConfidenceBand;
  /**
   * Atajo del firewall de identidad: cuando el caller_id matchea blacklist o
   * whitelist en data/demo-config.json, el orquestador NO llama a STT ni a
   * Claude — la cascada se cortocircuita y este campo describe el match. Si
   * está presente, transcript_redacted="", models_used=["firewall.local"] y
   * latency_ms.* todos 0 salvo total_ms (que mide solo el match).
   */
  early_exit?: EarlyExitMatch;
};

// ============================================================
// Early-exit del firewall — match contra blacklist/whitelist
// ============================================================

/**
 * Detalle del match firewall que cortocircuitó la cascada. Discriminado por
 * `reason` para que la UI pueda renderizar texto y fuente apropiados sin re-
 * mapear conceptos.
 */
export type EarlyExitMatch =
  | {
      reason: "blacklist_match";
      caller_id: string;
      /** Etiqueta humana de la entrada blacklist (ej. "Vishing impostor SII"). */
      display_name: string;
      /** Fuente que reportó el número (ej. "CMF Alertas al público"). */
      source: string;
      /** URL de la fuente, para que el cuidador verifique. */
      source_url: string;
      /** Razón textual de la entrada (ej. "Suplantación de ejecutivo bancario"). */
      blacklist_reason: string;
      /** ISO date del reporte (ej. "2026-04-15"). */
      reported_at: string;
    }
  | {
      reason: "whitelist_match";
      caller_id: string;
      /** Nombre del contacto confiable (ej. "Pedro"). */
      display_name: string;
      /** Relación con la persona protegida (ej. "nieto"). */
      relationship: string;
      /** Política aplicada al match. */
      policy: WhitelistPolicy;
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
// /api/notification/generate — segunda fase del flujo
// ============================================================
//
// Two-phase endpoint pattern: el primer call (/api/audio/process) detecta y
// devuelve verdict + evidence + denuncia + redirect; el cliente renderiza eso
// inmediatamente y dispara este segundo call para que Claude Haiku 4.5 arme el
// mensaje 65+ accionable. Mientras ese segundo call corre, el panel "plan de
// acción" muestra spinner.
//
// Stateless: el cliente reenvía el contexto necesario (decisiones de la
// cascada + transcripción usada para derivar severity). Sin DB, sin sesión.
// Si el primer response ya trae caregiver_message (early-exit firewall), el
// cliente NO dispara este endpoint — el mensaje ya está completo y determinístico.

export type NotificationGenerateRequest = {
  /** Echo del audio_id del primer response, para correlación de logs. */
  audio_id: string;
  /** Primer nombre de la persona protegida (mismo que se mandó al primer endpoint). */
  protected_name: string;
  /** Decisión completa del Triage (siempre presente). */
  triage_decision: CallTriageDecision;
  /** Identity Verifier decision (si Triage delegó). */
  identity_decision?: IdentityVerifierDecision;
  /** Vishing Analyst decision (si la cascada gatilló análisis profundo). */
  vishing_decision?: VishingAnalystDecision;
  /** Regulatory Translator decision (si Vishing pidió citas regulatorias). */
  regulatory_decision?: RegulatoryTranslatorDecision;
};

export type NotificationGenerateSuccess = {
  ok: true;
  audio_id: string;
  caregiver_message: CaregiverNotifierDecision;
  /** Status del Notifier (ok / fallback con reason). */
  status: CascadeStageStatus<CaregiverNotifierFailReason>;
  /** Modelos invocados (refuerza M3 / B3). */
  models_used: string[];
  /** Tools/clientes invocados (B2). */
  tools_used: string[];
  latency_ms: number;
  /** Marcador anti-exfiltración. */
  canary_present: boolean;
};

export type NotificationGenerateErrorCode =
  | "INVALID_BODY"
  | "MISSING_TRIAGE"
  | "NOTIFIER_FAILED"
  | "INTERNAL_ERROR";

export type NotificationGenerateError = {
  ok: false;
  error: string;
  code: NotificationGenerateErrorCode;
};

export type NotificationGenerateResponse =
  | NotificationGenerateSuccess
  | NotificationGenerateError;

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

// ============================================================
// Caregiver redirect — cuarto outcome del Identity Verifier
// ============================================================

/**
 * Información mínima del cuidador humano al que se debería derivar la llamada
 * cuando la verificación quedó ambigua (whitelist hit + shared_word incorrecto,
 * claim familiar no verificado, etc.). El teléfono SIEMPRE viaja enmascarado
 * al frontend para evitar exponer PII en el response.
 */
export type CaregiverRedirect = {
  /** Nombre de pila del cuidador. */
  name: string;
  /** "hija", "hijo", "nieto", "nieta", "yerno", etc. */
  role: string;
  /** Teléfono enmascarado para mostrar al usuario, ej. "+569****5678". */
  phone_e164_masked: string;
  /** Razón en español 65+, ≤200 chars, por qué se derivó a este cuidador. */
  reason_es: string;
};

/**
 * Enmascara un teléfono E.164 chileno preservando los últimos 4 dígitos.
 *   "+56987654321" → "+569****4321"
 *   "+56222119988" → "+5622****9988"
 * Para números que no calzan con el patrón chileno, conserva los últimos 4 dígitos.
 */
export function maskPhoneE164(e164: string): string {
  if (!e164 || e164.length < 6) return "+******";
  const cleaned = e164.startsWith("+") ? e164 : `+${e164}`;
  const last4 = cleaned.slice(-4);
  if (cleaned.startsWith("+569") && cleaned.length === 12) {
    return `+569****${last4}`;
  }
  if (cleaned.startsWith("+56") && cleaned.length === 12) {
    return `+56${cleaned.slice(3, 5)}****${last4}`;
  }
  const visible = cleaned.slice(0, Math.max(3, cleaned.length - 8));
  return `${visible}****${last4}`;
}

// ============================================================
// Confidence band — derivada de vishing_analysis.confidence
// ============================================================

export type ConfidenceBand = "low" | "medium" | "high";

/**
 * Thresholds explícitos para la banda. Diseñados para que la "zona ambigua"
 * coincida con el mismo rango donde el Identity Verifier debería evaluar
 * outcome=redirect_to_caregiver (confidence ∈ [0.4, 0.7] aprox).
 */
export const CONFIDENCE_THRESHOLDS = {
  /** confidence < 0.5 → band "low" */
  lowMax: 0.5,
  /** confidence ≥ 0.8 → band "high"; entre 0.5 y 0.8 → "medium" */
  highMin: 0.8,
} as const;

export function confidenceBand(confidence: number): ConfidenceBand {
  if (!Number.isFinite(confidence)) return "low";
  if (confidence < CONFIDENCE_THRESHOLDS.lowMax) return "low";
  if (confidence < CONFIDENCE_THRESHOLDS.highMin) return "medium";
  return "high";
}

export const CONFIDENCE_LABEL_ES: Record<ConfidenceBand, string> = {
  low: "Confianza baja",
  medium: "Confianza media",
  high: "Confianza alta",
};

export const CONFIDENCE_DESCRIPTION_ES: Record<ConfidenceBand, string> = {
  low: "Vigía no encontró suficiente evidencia para estar seguro. Trata el audio con cautela y verifica antes de actuar.",
  medium:
    "Vigía detectó señales pero no son concluyentes. Conviene validar con un humano de confianza antes de actuar.",
  high: "Vigía está seguro de su análisis: hay evidencia clara para sostener el veredicto.",
};

// ============================================================
// Denuncia payload — generado deterministamente en el orquestador
// ============================================================

export type DenunciaLeyPrincipal = {
  /** Número de la ley (ej. "21.459"). */
  numero: string;
  /** Nombre corto ciudadano (ej. "Ley de Delitos Informáticos"). */
  nombre_corto: string;
  /** URL canónica BCN para que el cuidador verifique. */
  url: string;
};

export type DenunciaLink = {
  /** Etiqueta amigable (ej. "PDI Cibercrimen"). */
  label: string;
  /** URL del portal oficial de denuncia. */
  url: string;
};

export type DenunciaPayload = {
  /**
   * Texto pre-rellenado que el cuidador puede copiar al portapapeles y pegar
   * en el formulario oficial de denuncia. Lenguaje 65+, sin jerga jurídica,
   * cita la ley_principal por número, ≤2500 chars.
   */
  texto_denuncia: string;
  /** Ley principal citada en el texto. */
  ley_principal: DenunciaLeyPrincipal;
  /** Links a portales oficiales (≥1, típicamente PDI + Sernac + denuncia.cl). */
  links_denuncia: DenunciaLink[];
  /**
   * Patrones de vishing que motivan la denuncia (vienen de vishing_analysis.patterns_detected
   * o, si no hubo Vishing Analyst, derivados del Triage). ≥1.
   */
  patrones_motivantes: string[];
};
