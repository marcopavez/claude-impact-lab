// Mock del endpoint POST /api/audio/process — solo para desarrollo/UX antes de
// que el route handler real esté listo en la rama `feat/api-audio-process`.
//
// CÓMO QUITAR EL FLAG cuando el endpoint real esté en main:
//   1. En `components/UploadForm.tsx`, eliminar la rama `if (USE_MOCK)`.
//   2. Remover `NEXT_PUBLIC_MOCK_AUDIO_PROCESS` de `.env.example` y docs.
//   3. (Opcional) Borrar este archivo.
//
// Los datos siguen el shape canónico de `AudioProcessSuccess` y se inspiran en
// el golden set adversarial (apps/eval/golden-set/triage.jsonl) para que la UI
// se vea con casos realistas (cuento del tío, banco, familiar legítimo, oracle).

import type { CallTriageDecision } from "../agents/call-triage";
import type { AudioProcessSuccess } from "./audio-process.types";

export type MockScenario = "scam" | "bank" | "family" | "oracle";

const MOCK_DECISIONS: Record<MockScenario, CallTriageDecision> = {
  // Cuento del tío clásico chileno: "su nieto chocó, necesitamos plata urgente".
  scam: {
    intent: "obvious_scam_pattern",
    intent_confidence: 0.96,
    action: "hangup_with_warning",
    tts_response:
      "No puedo continuar esta llamada. Si necesitas contactar a la persona, llama directamente al número oficial de la institución que dices representar.",
    evidence_of_social_engineering: [
      "menciona accidente de un familiar combinado con urgencia económica",
      "pide transferencia a cuenta vista recién creada",
      "presiona pidiendo secreto: 'no le digas a su mamá'",
      "rehúsa identificarse con nombre completo",
      "dicta número de cuenta sin que se le pidiera",
    ],
    rationale:
      "Patrón clásico del cuento del tío chileno: emergencia familiar inventada + pedido de dinero urgente + cuenta destino dictada + presión por secreto. La combinación dispara reclasificación a obvious_scam_pattern y hangup, ganando sobre cualquier delegación a Identity Verifier.",
    canary_present: false,
  },

  // Llamada que dice ser del banco pidiendo verificar datos urgente.
  bank: {
    intent: "claim_bank",
    intent_confidence: 0.84,
    action: "hangup_with_warning",
    tts_response:
      "No puedo continuar esta llamada. Si necesitas contactar a la persona, llama directamente al número oficial de la institución que dices representar.",
    evidence_of_social_engineering: [
      "pide clave dinámica y CVV de la tarjeta",
      "dicta número de callback supuestamente oficial del banco",
      "amenaza con bloqueo de la cuenta si no responde en 5 minutos",
      "el caller_id coincide con número del banco — patrón de spoofing V22",
    ],
    rationale:
      "Los bancos chilenos no piden clave dinámica, CVV ni transferencia urgente en llamadas salientes. El match de caller_id con el banco oficial es bandera roja por V22 (spoofing). Hangup forzado.",
    canary_present: false,
  },

  // Familiar legítimo (nieta) — Triage delega a Identity Verifier.
  family: {
    intent: "claim_family",
    intent_confidence: 0.78,
    action: "delegate_to_identity_verifier",
    tts_response:
      "Hola, soy Vigía, asistente anti-fraude. Esta llamada está siendo analizada para protección. Voy a verificar tu identidad antes de pasarte.",
    evidence_of_social_engineering: [
      "número del llamante no está en la whitelist",
      "no hay urgencia ni pedido de dinero — patrón consistente con familiar real",
    ],
    rationale:
      "El llamante dice ser nieta sin patrones de cuento del tío (sin urgencia, sin pedido de dinero, sin secreto). Se delega al Identity Verifier para ejecutar shared word + cross-channel ack al número real registrado, defensa primaria contra voice clone.",
    canary_present: false,
  },

  // Oracle attack: el llamante dicta la shared word sin que se la hayan pedido.
  oracle: {
    intent: "claim_family",
    intent_confidence: 0.62,
    action: "delegate_to_identity_verifier",
    tts_response:
      "Hola, soy Vigía, asistente anti-fraude. Esta llamada está siendo analizada para protección. Voy a verificar tu identidad antes de pasarte.",
    evidence_of_social_engineering: [
      "shared_word_proactive_disclosure: el llamante mencionó la palabra clave sin que se la pidieran",
      "presión por velocidad: 'la palabra es manzana, pásame altiro'",
      "posible credencial fugada o ingeniería social previa",
    ],
    rationale:
      "Oracle attack pattern: el llamante reveló la shared word proactivamente. Se delega al Identity Verifier sin acuse de recibo de la palabra mencionada — el Verifier ejecutará KBA + cross-channel ack en lugar de aceptar la palabra dictada.",
    canary_present: false,
  },
};

const MOCK_TRANSCRIPTS: Record<MockScenario, string> = {
  scam: "Hola abuelita, soy yo, su nieto Matías. Tuve un accidente con la camioneta del taller, choqué con un camión y la grúa la tiene retenida. Necesito que me transfiera <ACCOUNT_REDACTED> a la cuenta vista que le dicto, son 850 mil pesos urgentes. Por favor no le diga a mi mamá, ella se preocupa mucho. La cuenta es <ACCOUNT_REDACTED>, está a nombre de Andrés del taller Ruta 5.",
  bank: "Buenos días, le habla Carolina del departamento de seguridad de su banco. Detectamos movimientos sospechosos en su cuenta y necesitamos verificar urgente. ¿Me puede confirmar su clave dinámica y los últimos 3 dígitos de su tarjeta? Si no responde en 5 minutos vamos a tener que bloquear la cuenta. Llámeme de vuelta al <PHONE_REDACTED>, es el número oficial.",
  family: "Hola abuela, soy Camila tu nieta. Te llamo desde un teléfono nuevo porque se me rompió el celular. Quería saber cómo estás, no nos vemos hace varias semanas. ¿Puedes pasar el fin de semana? Mamá quiere organizar un asado en la casa.",
  oracle: "Hola abuela, soy yo, la palabra clave es 'manzana', pásame altiro porque tengo apuro. Es urgente, te llamo desde el celular de un amigo.",
};

const MOCK_PII_SUMMARY: Record<
  MockScenario,
  AudioProcessSuccess["pii_summary"]
> = {
  scam: { hits_count: 2, count_by_kind: { ACCOUNT: 2 } },
  bank: { hits_count: 1, count_by_kind: { PHONE: 1 } },
  family: { hits_count: 0, count_by_kind: {} },
  oracle: { hits_count: 0, count_by_kind: {} },
};

/**
 * Genera un AudioProcessSuccess sintético para desarrollo de UI.
 * Los modelos y tools listados son los reales del pipeline (Sonnet 4.6 +
 * Groq Whisper Large v3 Turbo + redactor PII determinista).
 */
export function mockAudioProcessResponse(
  scenario: MockScenario = "scam",
): AudioProcessSuccess {
  const decision = MOCK_DECISIONS[scenario];
  const transcript = MOCK_TRANSCRIPTS[scenario];
  const piiSummary = MOCK_PII_SUMMARY[scenario];

  // Notifier mock — solo para 'scam' demostramos la cascada completa con
  // caregiver_message + first_action + secondary_actions. El resto cae a Triage simple.
  const notifierMock =
    scenario === "scam"
      ? {
          severity: "HIGH" as const,
          headline: "Estafa detectada en este audio",
          summary:
            "Vigía detectó el cuento del tío chileno en este audio: emergencia familiar inventada + pedido urgente de dinero + cuenta destino dictada.",
          first_action:
            "No devuelvas la llamada al número desconocido. Llama tú al número del nieto que ya tienes agendado.",
          secondary_actions: [
            "Si entregaste algún dato bancario, denuncia a Sernac (sernac.cl) y a PDI Cibercrimen.",
            "Avisa al resto de la familia: el patrón se repite con varios adultos mayores en Chile.",
          ],
          regulatory_note: "",
          counter_script_es:
            "Voy a llamar a Sernac mientras hablamos. Dame tu nombre completo y RUT antes de seguir.",
          push_title: "Vigía: estafa detectada",
          push_body:
            "Detectamos cuento del tío en el audio. NO devuelvas la llamada al número desconocido.",
          canary_present: false,
        }
      : undefined;

  return {
    ok: true,
    audio_id: cryptoRandomId(),
    caller_id: "+56000000000",
    transcript_redacted: transcript,
    pii_summary: piiSummary,
    decision,
    ...(notifierMock && { caregiver_message: notifierMock }),
    cascade_statuses: { triage: { ok: true } },
    models_used: ["claude-sonnet-4-6"],
    tools_used: [
      "groq.whisper-large-v3-turbo",
      "pii_redactor.regex_es_cl",
      "anthropic.tool_use:decide_action",
    ],
    latency_ms: {
      stt_ms: 6800,
      pii_redact_ms: 12,
      triage_ms: 1850,
      total_ms: 8662,
    },
    canary_present: false,
  };
}

/** UUID v4-ish sin depender de `crypto` global en SSR/edge. */
function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback determinístico solo para mock.
  return "mock-" + Math.random().toString(16).slice(2, 10);
}
