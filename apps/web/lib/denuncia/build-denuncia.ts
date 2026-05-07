// Build determinista del payload de denuncia (sin LLM, sin red).
// Se ejecuta en el orquestador POST /api/audio/process cuando severity ≥ MEDIUM.
// Lenguaje ciudadano 65+, tuteo chileno, ≤2500 chars.

import type {
  DenunciaPayload,
  DenunciaLeyPrincipal,
  DenunciaLink,
} from "@/lib/api/audio-process.types";
import type { CallTriageDecision } from "@/lib/agents/call-triage";
import type {
  VishingAnalystDecision,
  VishingPattern,
} from "@/lib/agents/vishing-analyst";
import type { NotificationSeverity } from "@/lib/agents/caregiver-notifier";

export type BuildDenunciaInput = {
  severity: NotificationSeverity;
  caller_id: string;
  triage: CallTriageDecision;
  vishing?: VishingAnalystDecision;
};

const LEY_21459: DenunciaLeyPrincipal = {
  numero: "21.459",
  nombre_corto: "Ley de Delitos Informáticos",
  url: "https://www.bcn.cl/leychile/navegar?idNorma=1177743",
};

const LEY_21521: DenunciaLeyPrincipal = {
  numero: "21.521",
  nombre_corto: "Ley Fintec",
  url: "https://www.bcn.cl/leychile/navegar?idNorma=1188906",
};

const LINKS_DENUNCIA: DenunciaLink[] = [
  { label: "PDI Cibercrimen", url: "https://www.pdichile.cl" },
  { label: "Sernac — Reclamos", url: "https://www.sernac.cl" },
  { label: "CSIRT Nacional", url: "https://www.csirt.gob.cl" },
];

const PATTERN_TO_FRASE: Record<VishingPattern, string> = {
  cuento_del_tio:
    "El llamante invocó a un familiar (nieto/hijo/sobrino) en una situación de emergencia para pedir dinero o datos.",
  suplantacion_autoridad:
    "El llamante dijo ser de PDI, Carabineros, SII, Tribunales o similar y exigió pago/datos por teléfono (las autoridades no operan así).",
  suplantacion_bancaria:
    "El llamante dijo ser de un banco y pidió clave, OTP, número de tarjeta o coordenadas.",
  premio_oferta:
    "El llamante anunció un premio, herencia o sorteo sin que la persona haya participado.",
  utilidad_servicio:
    "El llamante dijo ser de Enel/Movistar/etc. y amenazó con corte inmediato exigiendo pago telefónico.",
  romance_emocional:
    "El llamante apeló a un vínculo afectivo prolongado para pedir dinero.",
  urgency_pressure:
    "El llamante presionó con urgencia artificial (tienes 5 minutos / antes de que se cierre).",
  secrecy_request:
    "El llamante pidió no avisar a otros familiares o cuidadores.",
  voice_clone_signal:
    "Hubo inconsistencias en la voz respecto al familiar reclamado.",
  none: "Señales generales de manipulación en la conversación.",
};

const FRASE_FALLBACK = "Señales generales de manipulación en la conversación.";
const PATRONES_VACIOS_FALLBACK = "señales sospechosas en la llamada";
const TEXTO_MAX = 2500;
const EVIDENCE_LINE_MAX = 200;

function selectLeyPrincipal(
  patterns: VishingPattern[] | undefined,
): DenunciaLeyPrincipal {
  if (!patterns || patterns.length === 0) return LEY_21459;
  if (patterns.includes("suplantacion_bancaria")) return LEY_21521;
  if (patterns.includes("suplantacion_autoridad")) return LEY_21459;
  return LEY_21459;
}

function selectPatronesMotivantes(
  triage: CallTriageDecision,
  vishing: VishingAnalystDecision | undefined,
): string[] {
  const fromVishing = (vishing?.patterns_detected ?? []).filter(
    (p) => p !== "none",
  );
  if (fromVishing.length > 0) {
    return fromVishing.slice(0, 5);
  }
  const fromTriage = triage.evidence_of_social_engineering.slice(0, 5);
  if (fromTriage.length > 0) return fromTriage;
  return [PATRONES_VACIOS_FALLBACK];
}

function patternToFrase(item: string): string {
  if (item in PATTERN_TO_FRASE) {
    return PATTERN_TO_FRASE[item as VishingPattern];
  }
  // Caso fallback (evidence del Triage o string libre): truncamos a 200 chars.
  const trimmed = item.trim();
  if (trimmed.length === 0) return FRASE_FALLBACK;
  return trimmed.length > EVIDENCE_LINE_MAX
    ? trimmed.slice(0, EVIDENCE_LINE_MAX - 1).trimEnd() + "…"
    : trimmed;
}

function buildTextoDenuncia(
  callerId: string,
  patrones: string[],
  ley: DenunciaLeyPrincipal,
  vishing: VishingAnalystDecision | undefined,
): string {
  const header = `Denuncia de intento de estafa telefónica (vishing)

Fecha de la llamada: [a completar por el cuidador]
Número que llamó: ${callerId}

El día indicado, recibí una llamada del número ${callerId}. Durante la conversación, detecté las siguientes señales que coinciden con un intento de estafa telefónica:`;

  const footerParts: string[] = [];
  if (vishing?.claimed_entity && vishing.claimed_entity.trim().length > 0) {
    footerParts.push(
      `El llamante dijo representar a: ${vishing.claimed_entity.trim()}.`,
    );
  }
  if (vishing?.rationale_es && vishing.rationale_es.trim().length > 0) {
    footerParts.push(vishing.rationale_es.trim());
  }

  const cierre = `Esta conducta puede encuadrarse en la Ley ${ley.numero} (${ley.nombre_corto}). Solicito a la autoridad competente la apertura de una investigación y la inclusión del número en los registros oficiales de números asociados a estafas.

Datos del denunciante (a completar):
- Nombre completo: __________
- RUT: __________
- Teléfono de contacto: __________
- Correo electrónico: __________

Adjunto: grabación del audio de la llamada (si la conservé).`;

  const buildWithBullets = (bullets: string[]): string => {
    const bulletBlock = bullets.map((b) => `- ${b}`).join("\n");
    const middle = footerParts.length > 0 ? `\n\n${footerParts.join(" ")}` : "";
    return `${header}\n\n${bulletBlock}${middle}\n\n${cierre}`;
  };

  const bullets = patrones.map(patternToFrase);
  let texto = buildWithBullets(bullets);

  // Truncamos inteligentemente eliminando bullets desde el final si superamos
  // 2500 chars. Garantizamos al menos 1 bullet (o el fallback genérico).
  while (texto.length > TEXTO_MAX && bullets.length > 1) {
    bullets.pop();
    texto = buildWithBullets(bullets);
  }
  if (texto.length > TEXTO_MAX) {
    // Último recurso: truncar el bullet único + footer rationale.
    const minimalBullets = [FRASE_FALLBACK];
    texto = buildWithBullets(minimalBullets);
    if (texto.length > TEXTO_MAX) {
      texto = texto.slice(0, TEXTO_MAX - 1).trimEnd() + "…";
    }
  }
  return texto;
}

export function buildDenuncia(
  input: BuildDenunciaInput,
): DenunciaPayload | undefined {
  if (input.severity === "LOW") return undefined;

  const ley = selectLeyPrincipal(input.vishing?.patterns_detected);
  const patrones = selectPatronesMotivantes(input.triage, input.vishing);
  const texto = buildTextoDenuncia(
    input.caller_id,
    patrones,
    ley,
    input.vishing,
  );

  return {
    texto_denuncia: texto,
    ley_principal: ley,
    links_denuncia: LINKS_DENUNCIA,
    patrones_motivantes: patrones,
  };
}
