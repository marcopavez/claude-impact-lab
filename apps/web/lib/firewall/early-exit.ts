// Early-exit del firewall de identidad (MVP/PoC N20).
//
// El módulo cruza el caller_id que llega al endpoint /api/audio/process contra
// la blacklist y la whitelist de data/demo-config.json. Si hay match, el
// orquestador corta la cascada: NO se transcribe el audio, NO se llama a Claude,
// NO se factura Groq. La respuesta se construye determinísticamente acá.
//
// Por qué corto incluso para whitelist `pass_after_verification`: para que el
// mock se sienta coherente al jurado en la demo. La defensa contra V22 (caller-ID
// spoofing) se mantiene porque el mensaje al cuidador SIEMPRE pide verificación
// out-of-band cuando la policy lo exige; no transferimos "ciegamente". En V2 con
// telefonía real este atajo se reemplaza por el flujo Identity Verifier completo.
//
// Precedencia de match: blacklist > whitelist. Si un mismo número aparece en
// ambas listas, gana blacklist (bias defensivo).

import type {
  CallTriageDecision,
  WhitelistPolicy,
} from "../agents/call-triage";
import type {
  CaregiverNotifierDecision,
  NotificationSeverity,
} from "../agents/caregiver-notifier";
import { buildDenuncia } from "../denuncia/build-denuncia";
import {
  AUDIO_PROCESS_LIMITS,
  confidenceBand,
  type AudioProcessSuccess,
  type CascadeStatuses,
  type EarlyExitMatch,
  type LatencyBreakdown,
} from "../api/audio-process.types";

// ============================================================
// Schema mínimo del demo-config relevante para el match
// ============================================================
//
// Tipamos solo los campos que consumimos. Evita acoplar el módulo al JSON
// completo y mantiene el match testeable en isolation.

type BlacklistEntry = {
  caller_id_e164: string;
  display_name: string;
  source: string;
  source_url: string;
  reason: string;
  reported_at: string;
};

type WhitelistEntry = {
  caller_id_e164: string;
  display_name: string;
  relationship: string;
  // El JSON estático llega como `string`; validamos a `WhitelistPolicy` al
  // momento del match. Tipar acá como `string` evita acoplar el módulo a
  // assertions en cada call site.
  policy: string;
};

export type FirewallConfigShape = {
  blacklist: BlacklistEntry[];
  whitelist: WhitelistEntry[];
};

const WHITELIST_POLICIES: ReadonlySet<WhitelistPolicy> = new Set([
  "always_pass",
  "pass_after_verification",
  "take_message_only",
]);

function assertWhitelistPolicy(p: string): WhitelistPolicy {
  if ((WHITELIST_POLICIES as ReadonlySet<string>).has(p)) {
    return p as WhitelistPolicy;
  }
  // Default conservador: cualquier política no reconocida cae a take_message_only,
  // que es el outcome más seguro (sin transferencia automática).
  return "take_message_only";
}

// ============================================================
// Match
// ============================================================

export function matchCallerIdAgainstFirewall(
  callerId: string,
  config: FirewallConfigShape,
): EarlyExitMatch | null {
  // El default callerId (+56000000000) NUNCA debe matchear, aunque alguien lo
  // agregue accidentalmente al config — sigue siendo el sentinel "sin número".
  if (callerId === AUDIO_PROCESS_LIMITS.defaultCallerId) return null;

  const blackHit = config.blacklist.find(
    (e) => e.caller_id_e164 === callerId,
  );
  if (blackHit) {
    return {
      reason: "blacklist_match",
      caller_id: callerId,
      display_name: blackHit.display_name,
      source: blackHit.source,
      source_url: blackHit.source_url,
      blacklist_reason: blackHit.reason,
      reported_at: blackHit.reported_at,
    };
  }

  const whiteHit = config.whitelist.find(
    (e) => e.caller_id_e164 === callerId,
  );
  if (whiteHit) {
    return {
      reason: "whitelist_match",
      caller_id: callerId,
      display_name: whiteHit.display_name,
      relationship: whiteHit.relationship,
      policy: assertWhitelistPolicy(whiteHit.policy),
    };
  }

  return null;
}

// ============================================================
// Builder de la respuesta sintética
// ============================================================

const BLACKLIST_TTS_HANGUP =
  "No puedo continuar esta llamada. Si necesitas contactar a la persona, llama directamente al número oficial de la institución que dices representar.";

const WHITELIST_PASS_TTS = (firstName: string) =>
  `Hola, soy Vigía, asistente anti-fraude de ${firstName}. Esta llamada está siendo analizada para protección.`;

function buildBlacklistTriage(match: Extract<EarlyExitMatch, { reason: "blacklist_match" }>): CallTriageDecision {
  return {
    intent: "obvious_scam_pattern",
    intent_confidence: 1,
    action: "hangup_with_warning",
    tts_response: BLACKLIST_TTS_HANGUP,
    evidence_of_social_engineering: [
      "caller_id_in_threat_blacklist",
      `${match.source}: ${match.blacklist_reason}`,
    ],
    rationale: `El número ${match.caller_id} está en la blacklist oficial mantenida por ${match.source} (reportado el ${match.reported_at}). No se transcribió ni analizó el audio: el match contra la lista de amenazas es señal suficiente para desestimar la llamada.`,
    canary_present: false,
  };
}

function buildBlacklistNotifier(
  match: Extract<EarlyExitMatch, { reason: "blacklist_match" }>,
): CaregiverNotifierDecision {
  return {
    severity: "HIGH",
    headline: `Estafa conocida — número reportado por ${match.source}`,
    summary: `El número que llamó ya está en la lista oficial de amenazas mantenida por ${match.source}. Vigía no transcribió ni analizó el audio porque el match es suficiente para descartarlo.`,
    first_action:
      "No devuelvas el llamado al número que apareció. Si era importante, llama tú al número oficial de la institución que dijo representar.",
    secondary_actions: [
      "Bloquea este número en tu teléfono para que no vuelva a sonar.",
      "Si la persona protegida llegó a entregar datos, denuncia a Sernac y a la PDI Cibercrimen.",
    ],
    regulatory_note: "",
    counter_script_es:
      "Estoy avisada de tu número. No me llames más; cualquier comunicación oficial la reviso por mi banco o el organismo correspondiente.",
    push_title: "Vigía: estafa conocida",
    push_body: `${match.source} ya reportó este número como parte de una estafa.`,
    canary_present: false,
  };
}

function buildWhitelistTriage(
  match: Extract<EarlyExitMatch, { reason: "whitelist_match" }>,
  protectedName: string,
): CallTriageDecision {
  switch (match.policy) {
    case "always_pass":
      return {
        intent: "claim_family",
        intent_confidence: 1,
        action: "transfer_now",
        tts_response: WHITELIST_PASS_TTS(protectedName),
        evidence_of_social_engineering: [],
        rationale: `El número ${match.caller_id} corresponde a ${match.display_name} (${match.relationship}) con política "always_pass" en los contactos confiables. No se transcribió ni analizó el audio.`,
        canary_present: false,
      };
    case "pass_after_verification":
      return {
        intent: "claim_family",
        intent_confidence: 1,
        action: "delegate_to_identity_verifier",
        tts_response: WHITELIST_PASS_TTS(protectedName),
        evidence_of_social_engineering: [],
        rationale: `El número ${match.caller_id} corresponde a ${match.display_name} (${match.relationship}) con política "pass_after_verification". Se permite el atajo, pero la verificación con palabra clave familiar y devolver el llamado al número conocido siguen siendo OBLIGATORIAS antes de cualquier transferencia de dinero o datos.`,
        canary_present: false,
      };
    case "take_message_only":
      return {
        intent: "claim_service",
        intent_confidence: 1,
        action: "take_message",
        tts_response: WHITELIST_PASS_TTS(protectedName),
        evidence_of_social_engineering: [],
        rationale: `El número ${match.caller_id} corresponde a ${match.display_name} con política "take_message_only". No se transcribe el audio: por configuración, este contacto solo deja mensaje, sin transferencia.`,
        canary_present: false,
      };
  }
}

function buildWhitelistNotifier(
  match: Extract<EarlyExitMatch, { reason: "whitelist_match" }>,
): CaregiverNotifierDecision {
  switch (match.policy) {
    case "always_pass":
      return {
        severity: "LOW",
        headline: `Llamada de ${match.display_name} (${match.relationship})`,
        summary: `Este número está en tus contactos confiables con política "pasa siempre". Vigía no transcribió ni analizó el audio.`,
        first_action: `Puedes devolver el llamado a ${match.display_name} con tranquilidad.`,
        secondary_actions: [
          "Si la voz o el tono te suenan distintos a lo habitual, pide la palabra clave familiar antes de tomar decisiones que involucren dinero.",
        ],
        regulatory_note: "",
        counter_script_es: "",
        push_title: `Vigía: llamada de ${match.display_name}`,
        push_body: "Contacto confiable. Sin acciones urgentes.",
        canary_present: false,
      };
    case "pass_after_verification":
      return {
        severity: "MEDIUM",
        headline: `${match.display_name} (${match.relationship}) — verifica antes de devolver`,
        summary: `El número está en tus contactos confiables, pero su política exige verificación. Vigía no transcribió el audio; igual debes verificar identidad antes de transferir dinero o datos.`,
        first_action: `Llama tú al número conocido de ${match.display_name} y pídele la palabra clave familiar antes de devolver el llamado.`,
        secondary_actions: [
          "No transfieras dinero ni datos hasta confirmar identidad por el número que tú conoces.",
          "Si el llamante presiona con urgencia, eso por sí solo es una bandera roja — incluso desde un número confiable (puede haber suplantación o secuestro de línea).",
        ],
        regulatory_note: "",
        counter_script_es:
          "Te llamo yo al número que conozco. Si era urgente, dejame mensaje en mi número fijo y verifico antes de cualquier movimiento de plata.",
        push_title: `Vigía: ${match.display_name} llamó`,
        push_body: "Verifica con palabra clave familiar antes de devolver.",
        canary_present: false,
      };
    case "take_message_only":
      return {
        severity: "LOW",
        headline: `${match.display_name} dejó un mensaje`,
        summary: `Este número está configurado como "solo tomar mensaje". Vigía no transcribió el audio: por política, no se transfiere ni se devuelve el llamado en caliente.`,
        first_action: `Para confirmar el motivo del llamado, llama tú al número oficial de ${match.display_name} (no al que aparece en pantalla — puede estar suplantado).`,
        secondary_actions: [
          "Si era una citación médica o trámite, valida directamente en el sitio web o app oficial del servicio.",
        ],
        regulatory_note: "",
        counter_script_es: "",
        push_title: `Vigía: mensaje de ${match.display_name}`,
        push_body: "Llama tú al número oficial para confirmar.",
        canary_present: false,
      };
  }
}

function severityForMatch(match: EarlyExitMatch): NotificationSeverity {
  if (match.reason === "blacklist_match") return "HIGH";
  if (match.policy === "pass_after_verification") return "MEDIUM";
  return "LOW";
}

export function buildEarlyExitSuccess(args: {
  match: EarlyExitMatch;
  callerId: string;
  protectedName: string;
  audioId: string;
  startedAt: number;
}): AudioProcessSuccess {
  const { match, callerId, protectedName, audioId, startedAt } = args;

  const triageDecision: CallTriageDecision =
    match.reason === "blacklist_match"
      ? buildBlacklistTriage(match)
      : buildWhitelistTriage(match, protectedName);

  const notifierDecision: CaregiverNotifierDecision =
    match.reason === "blacklist_match"
      ? buildBlacklistNotifier(match)
      : buildWhitelistNotifier(match);

  const cascadeStatuses: CascadeStatuses = {
    triage: { ok: true },
  };

  // Sin Claude ni Whisper — el match es local y determinista. La UI muestra
  // explícitamente "firewall.local" para no inducir al jurado a creer que la
  // decisión vino de un modelo.
  const modelsUsed = ["firewall.local"];
  const toolsUsed = ["firewall.matchCallerIdAgainstFirewall"];

  const severity = severityForMatch(match);
  // Denuncia pre-rellenada SOLO para blacklist match. Para whitelist match
  // (incluso pass_after_verification con severity MEDIUM) sería alarmista —
  // todavía no sabemos si fue spoofing o el contacto real. Si el cuidador
  // confirma luego que sí era estafa, puede generarla manualmente.
  const denuncia =
    match.reason === "blacklist_match"
      ? buildDenuncia({
          severity,
          caller_id: callerId,
          triage: triageDecision,
        })
      : undefined;
  if (denuncia) {
    toolsUsed.push("deterministic.buildDenuncia");
  }

  const totalMs = Date.now() - startedAt;
  const latency: LatencyBreakdown = {
    stt_ms: 0,
    pii_redact_ms: 0,
    triage_ms: 0,
    total_ms: totalMs,
  };

  const success: AudioProcessSuccess = {
    ok: true,
    audio_id: audioId,
    caller_id: callerId,
    transcript_redacted: "",
    pii_summary: { hits_count: 0, count_by_kind: {} },
    decision: triageDecision,
    caregiver_message: notifierDecision,
    cascade_statuses: cascadeStatuses,
    models_used: modelsUsed,
    tools_used: toolsUsed,
    latency_ms: latency,
    canary_present: false,
    early_exit: match,
    ...(denuncia && { denuncia }),
    confidence_band: confidenceBand(match.reason === "blacklist_match" ? 1 : 0.5),
  };

  // protectedName está disponible para los TTS y queda implícito en el rationale
  // del Triage. No se exporta literal en el response (regla de mínima exposición).
  void protectedName;

  return success;
}
