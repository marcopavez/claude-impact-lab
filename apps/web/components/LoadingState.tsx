"use client";

// LoadingState — stepper progresivo mientras corre /api/audio/process.
// Antes era solo spinner; para una espera de 10-30s, +65 puede pensar
// que se trabó. El stepper da feedback emocional + cumple J3.4 (Claude
// evidente: muestra que la cascada existe).
//
// Timing simulado client-side (los tiempos absolutos vienen de los
// rangos medidos del backend; el endpoint es one-shot y no emite
// progress events, así que aproximamos):
//   - Step 1 (Transcribiendo audio):     t = 0    → 1.5 s (Groq Whisper ~<1s)
//   - Step 2 (Detectando patrones):      t = 1.5  → 11 s  (Triage ~9s en Sonnet 4.6)
//   - Step 3 (Análisis profundo):        t = 11   → 21 s  (Vishing ~10s en Sonnet 4.6 + thinking)
//   - Step 4 (Preparando recomendación): t = 21+  → hasta que llegue el response (Notifier ~5s)
//
// Los labels son fieles para CUALQUIER audio: describen lo que la
// cascada hace en general, sin afirmar acciones específicas (Identity
// Verifier, Regulatory Translator) que solo corren en cierto subset
// de casos. La trazabilidad real de qué eslabones efectivamente se
// invocaron se muestra en CascadeTrace dentro del VerdictPanel.
//
// Cada step expone:
//   - `model`: chip pequeño con el modelo/proveedor que está corriendo,
//     visible solo cuando el step está active o done. Sustenta J3.4
//     (Claude evidente) durante la espera.
//   - `details`: sub-actividades concretas que se "iluminan" una a una
//     mientras el step está activo, dando sensación de progreso interno
//     y evidencia visible de qué hace el bot. Cuántas se han marcado se
//     calcula dividiendo la duración del step entre el número de detalles.
//
// Accesibilidad:
//   - role="status" + aria-live="polite" anuncia cambios al lector.
//   - El spinner del step activo respeta prefers-reduced-motion (CSS).
//   - aria-current="step" en el step en curso y el sub-detalle activo.

import { useEffect, useState } from "react";
import { CheckCircleIcon, CircleIcon, LoaderIcon } from "./icons";

type Step = {
  label: string;
  description: string;
  /** Chip discreto con el modelo/proveedor que ejecuta este paso. */
  model: string;
  /** Sub-actividades concretas; se iluminan progresivamente en el step activo. */
  details: readonly string[];
  completeAtMs: number;
};

const STEPS: readonly Step[] = [
  {
    label: "Transcribiendo el audio",
    description: "Convirtiendo la voz en texto.",
    model: "Groq · Whisper Large v3 Turbo",
    details: [
      "Reconocimiento de voz en español chileno",
      "Preservando palabras clave para el análisis",
    ],
    completeAtMs: 1500,
  },
  {
    label: "Detectando patrones de fraude",
    description:
      "Clasificando la intención del llamante y las señales de manipulación.",
    model: "Claude Sonnet 4.6",
    details: [
      "Buscando «cuento del tío» (familiar inventado + urgencia)",
      "Suplantación bancaria (pide clave, OTP o coordenadas)",
      "Suplantación de autoridad (PDI, SII, Carabineros)",
      "Premio, herencia o sorteo inesperado",
      "Urgencia, secreto o presión emocional",
    ],
    completeAtMs: 11000,
  },
  {
    label: "Análisis profundo de la conversación",
    description:
      "Cruzando indicios y razonando paso a paso sobre la llamada.",
    model: "Claude Sonnet 4.6 + razonamiento extendido",
    details: [
      "Combinando indicios para reducir falsos positivos",
      "Cruzando con la decisión del triaje",
      "Evaluando si requiere cita literal de ley chilena",
      "Verificando citas regulatorias contra fuente oficial",
    ],
    completeAtMs: Number.POSITIVE_INFINITY,
  },
  // El paso "Preparando la recomendación" se movió al endpoint two-phase
  // /api/notification/generate. El verdict aparece apenas termina el análisis
  // profundo; el plan adaptado para el cuidador se genera en background y se
  // inyecta en el VerdictPanel cuando llega (el panel muestra spinner mientras
  // tanto). Por eso este LoadingState termina en el step anterior.
];

/**
 * Cuántos sub-detalles ya están marcados en el step activo. Para steps con
 * duración finita, divide la duración entre el número de detalles. Para el
 * último step (Infinity), cycle cada 1800 ms hasta que el response llegue.
 */
function calcSubDoneCount(
  activeIdx: number,
  elapsedMs: number,
  detailsLen: number,
): number {
  if (detailsLen === 0) return 0;
  const stepStart = activeIdx === 0 ? 0 : STEPS[activeIdx - 1].completeAtMs;
  const stepEnd = STEPS[activeIdx].completeAtMs;
  const inStep = Math.max(0, elapsedMs - stepStart);

  if (!Number.isFinite(stepEnd)) {
    return Math.min(detailsLen, Math.floor(inStep / 1800));
  }

  const stepDuration = stepEnd - stepStart;
  const interval = stepDuration / detailsLen;
  return Math.min(detailsLen, Math.floor(inStep / interval));
}

export function LoadingState() {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    const start = Date.now();
    const id = window.setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 250);
    return () => window.clearInterval(id);
  }, []);

  // currentIndex es el primer step que aún no superó su completeAtMs.
  const currentIndex = STEPS.findIndex((s) => elapsedMs < s.completeAtMs);
  const safeCurrent = currentIndex === -1 ? STEPS.length - 1 : currentIndex;

  const totalSeconds = Math.floor(elapsedMs / 1000);

  const subDoneCount = calcSubDoneCount(
    safeCurrent,
    elapsedMs,
    STEPS[safeCurrent].details.length,
  );

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="surface-card p-6 sm:p-8 flex flex-col gap-6"
      aria-label="Vigía está analizando el audio"
    >
      <header className="flex flex-col gap-2">
        <p className="text-sm uppercase tracking-wide font-semibold text-[color:var(--color-text-muted)]">
          Análisis en curso
        </p>
        <h2 className="font-display text-2xl sm:text-3xl font-bold text-[color:var(--color-text)] leading-tight">
          Vigía está escuchando la llamada
        </h2>
        <p className="text-base text-[color:var(--color-text-muted)]">
          Esto suele tardar entre 10 y 30 segundos. Llevamos {totalSeconds}{" "}
          segundo{totalSeconds === 1 ? "" : "s"}.
        </p>
      </header>

      <ol className="flex flex-col">
        {STEPS.map((step, idx) => {
          const state =
            idx < safeCurrent ? "done" : idx === safeCurrent ? "active" : "pending";
          const showDetails = state === "active" && step.details.length > 0;
          return (
            <li
              key={step.label}
              data-state={state}
              aria-current={state === "active" ? "step" : undefined}
              className="step-row"
            >
              <span className="step-icon flex-shrink-0">
                {state === "done" ? (
                  <CheckCircleIcon className="w-7 h-7" />
                ) : state === "active" ? (
                  <LoaderIcon className="w-7 h-7 animate-spin" />
                ) : (
                  <CircleIcon className="w-7 h-7" />
                )}
              </span>
              <span className="flex flex-col gap-1 min-w-0">
                <span className="step-label text-base flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span>{step.label}</span>
                  {state !== "pending" ? (
                    <span
                      className="inline-block px-1.5 py-0.5 rounded font-mono text-xs font-normal bg-[var(--color-surface-3)] text-[color:var(--color-text-muted)]"
                      aria-label={`Procesado por ${step.model}`}
                    >
                      {step.model}
                    </span>
                  ) : null}
                  {state === "active" ? (
                    <span className="sr-only">, en curso</span>
                  ) : state === "done" ? (
                    <span className="sr-only">, completado</span>
                  ) : (
                    <span className="sr-only">, pendiente</span>
                  )}
                </span>
                {state !== "pending" ? (
                  <span className="text-sm text-[color:var(--color-text-subtle)]">
                    {step.description}
                  </span>
                ) : null}
                {showDetails ? (
                  <ul
                    className="mt-1.5 flex flex-col gap-1.5 text-sm"
                    aria-label="Sub-actividades en este paso"
                  >
                    {step.details.map((d, i) => {
                      const subDone = i < subDoneCount;
                      const subActive = i === subDoneCount;
                      return (
                        <li
                          key={d}
                          className="flex items-start gap-2"
                          aria-current={subActive ? "step" : undefined}
                        >
                          <span
                            aria-hidden="true"
                            className={`mt-1 flex-shrink-0 inline-block w-3 h-3 rounded-full transition-colors ${
                              subDone
                                ? "bg-[color:var(--color-safe)]"
                                : subActive
                                ? "bg-[color:var(--color-brand)] animate-pulse"
                                : "border-2 border-[color:var(--color-text-subtle)]"
                            }`}
                          />
                          <span
                            className={
                              subDone
                                ? "text-[color:var(--color-text)]"
                                : "text-[color:var(--color-text-muted)]"
                            }
                          >
                            {d}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-sm text-[color:var(--color-text-subtle)]">
        No cierres esta página.
      </p>
    </div>
  );
}
