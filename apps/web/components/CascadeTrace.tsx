"use client";

// CascadeTrace — mini-panel de trazabilidad de la cascada agéntica.
//
// Sustenta dos cosas:
//   1. Honestidad post-análisis: el LoadingState es narrativa simulada
//      client-side; CascadeTrace muestra qué eslabones efectivamente
//      corrieron en este audio, leyendo cascade_statuses + presencia
//      de los campos opcionales del response.
//   2. Defensa M3 (rúbrica): la cascada es proporcional al riesgo.
//      Cada eslabón tiene un gate explícito en el orquestador. Para un
//      "cuento del tío" típico no corre Identity (no es claim_family
//      ambiguo) ni Regulatory (verdict_kind=behavioral). Mostrar el
//      por qué evita preguntas tipo "¿y la cita a la ley?" en Q&A.
//
// El componente NO duplica los detalles colapsados de cada agente —
// solo muestra el panorama (corrió / no aplicó + motivo). Los detalles
// específicos (rationale, citas, challenge plan) viven en sus propios
// `<details>` dentro del VerdictPanel.

import type { AudioProcessSuccess } from "../lib/api/audio-process.types";
import { CheckCircleIcon, CircleIcon } from "./icons";

type Stage = {
  id: string;
  label: string;
  modelLabel: string;
  ran: boolean;
  reasonNotRun?: string;
};

function buildStages(result: AudioProcessSuccess): Stage[] {
  // Early-exit local: el firewall cortocircuita antes de tocar ningún LLM.
  // No mostramos los 5 eslabones de la cascada — confunde. Mostramos solo
  // el match local + un slot que explica por qué no se invocó la cascada.
  if (result.early_exit) {
    return [
      {
        id: "firewall",
        label: "Firewall local del cuidador",
        modelLabel: "decisión local, sin LLM",
        ran: true,
      },
      {
        id: "cascade-skipped",
        label: "Cascada agéntica de Claude",
        modelLabel: "—",
        ran: false,
        reasonNotRun:
          "El número del llamante coincidió con la lista del cuidador (whitelist o blacklist). La decisión se toma localmente sin invocar LLM, ahorrando latencia y créditos.",
      },
    ];
  }

  const stages: Stage[] = [];

  // Triage corre siempre cuando el firewall no corta.
  stages.push({
    id: "triage",
    label: "Triaje del llamante",
    modelLabel: "Sonnet 4.6 + tool use",
    ran: true,
  });

  // Identity Verifier — solo si Triage delegó (intent=claim_family ambiguo).
  const identityRan = result.identity_check !== undefined;
  stages.push({
    id: "identity",
    label: "Verificación de identidad familiar",
    modelLabel: "Sonnet 4.6 + tool use",
    ran: identityRan,
    reasonNotRun: identityRan
      ? undefined
      : "Solo se invoca cuando el llamante reclama ser un familiar de forma ambigua. El triaje de este audio tomó otra ruta (estafa obvia, take_message o pregunta aclaratoria).",
  });

  // Vishing Analyst — corre cuando Triage no resolvió trivialmente.
  const vishingRan = result.vishing_analysis !== undefined;
  stages.push({
    id: "vishing",
    label: "Análisis profundo (razonamiento extendido)",
    modelLabel: "Opus 4.7 + adaptive thinking",
    ran: vishingRan,
    reasonNotRun: vishingRan
      ? undefined
      : "Solo se invoca cuando el triaje no resuelve el caso de forma trivial. Para este audio el triaje fue suficiente.",
  });

  // Regulatory Translator — solo si Vishing planteó preguntas legales concretas.
  const regulatoryRan = result.regulatory !== undefined;
  stages.push({
    id: "regulatory",
    label: "Cita literal de ley chilena",
    modelLabel: "Sonnet 4.6 + fuentes oficiales",
    ran: regulatoryRan,
    reasonNotRun: regulatoryRan
      ? undefined
      : "Solo se invoca cuando el análisis profundo plantea una pregunta legal específica. Para este audio el veredicto fue de tipo comportamental — no requirió cita oficial.",
  });

  // Caregiver Notifier — corre siempre que el triaje sea ok.
  const notifierRan = result.caregiver_message !== undefined;
  stages.push({
    id: "notifier",
    label: "Recomendación accionable al cuidador",
    modelLabel: "Haiku 4.5 + tool use",
    ran: notifierRan,
  });

  return stages;
}

export function CascadeTrace({ result }: { result: AudioProcessSuccess }) {
  const stages = buildStages(result);
  const ranCount = stages.filter((s) => s.ran).length;

  return (
    <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
      <summary className="cursor-pointer font-semibold text-[color:var(--color-text)] text-base">
        Cascada agéntica
        <span className="ml-2 text-sm font-normal text-[color:var(--color-text-muted)]">
          {ranCount} de {stages.length} eslabón{ranCount === 1 ? "" : "es"}{" "}
          invocado{ranCount === 1 ? "" : "s"}
        </span>
      </summary>
      <ol className="mt-3 flex flex-col gap-3">
        {stages.map((s) => (
          <li key={s.id} className="flex items-start gap-3">
            <span aria-hidden="true" className="mt-0.5 flex-shrink-0">
              {s.ran ? (
                <CheckCircleIcon className="w-5 h-5 text-[color:var(--color-safe)]" />
              ) : (
                <CircleIcon className="w-5 h-5 text-[color:var(--color-text-subtle)]" />
              )}
            </span>
            <div className="flex flex-col gap-0.5 text-sm flex-1 min-w-0">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-[color:var(--color-text)]">
                  {s.label}
                </span>
                <span
                  className="inline-block px-1.5 py-0.5 rounded font-mono text-xs bg-[var(--color-surface-3)] text-[color:var(--color-text-muted)]"
                  aria-label={
                    s.ran
                      ? `Corrió con ${s.modelLabel}`
                      : "No se invocó en este audio"
                  }
                >
                  {s.ran ? `corrió · ${s.modelLabel}` : "no aplicó"}
                </span>
              </p>
              {s.reasonNotRun ? (
                <p className="text-[color:var(--color-text-muted)] leading-relaxed">
                  {s.reasonNotRun}
                </p>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-[color:var(--color-text-subtle)] leading-relaxed">
        Cada eslabón tiene un gate explícito en el orquestador: la cascada es
        proporcional al riesgo del audio.
      </p>
    </details>
  );
}
