"use client";

// LoadingState — stepper progresivo mientras corre /api/audio/process.
// Antes era solo spinner; para una espera de 10-30s, +65 puede pensar
// que se trabó. El stepper da feedback emocional + cumple J3.4 (Claude
// evidente: muestra que la cascada existe).
//
// Timing simulado client-side (los tiempos absolutos vienen de los
// rangos medidos del backend; el endpoint es one-shot y no emite
// progress events, así que aproximamos):
//   - Step 1 (Transcribiendo audio):     t = 0   → 3 s   (Scribe ~1.5s)
//   - Step 2 (Detectando patrones):      t = 3   → 13 s  (Triage ~10s en Sonnet 4.6)
//   - Step 3 (Análisis profundo):        t = 13  → 28 s  (Vishing ~16s en Opus 4.7 + thinking)
//   - Step 4 (Preparando recomendación): t = 28+ → hasta que llegue el response (Notifier ~5s)
//
// Los labels son fieles para CUALQUIER audio: describen lo que la
// cascada hace en general, sin afirmar acciones específicas (Identity
// Verifier, Regulatory Translator) que solo corren en cierto subset
// de casos. La trazabilidad real de qué eslabones efectivamente se
// invocaron se muestra en CascadeTrace dentro del VerdictPanel.
//
// Accesibilidad:
//   - role="status" + aria-live="polite" anuncia cambios al lector.
//   - El spinner del step activo respeta prefers-reduced-motion (CSS).
//   - aria-current="step" en el step en curso.

import { useEffect, useState } from "react";
import { CheckCircleIcon, CircleIcon, LoaderIcon } from "./icons";

const STEPS = [
  {
    label: "Transcribiendo el audio",
    description: "Convirtiendo la voz en texto.",
    completeAtMs: 3000,
  },
  {
    label: "Detectando patrones de fraude",
    description: "Clasificando la intención del llamante y señales de manipulación.",
    completeAtMs: 13000,
  },
  {
    label: "Análisis profundo de la conversación",
    description:
      "Cruzando indicios de cuento del tío, suplantación y presión emocional.",
    completeAtMs: 28000,
  },
  {
    label: "Preparando la recomendación",
    description: "Síntesis del veredicto en lenguaje claro para el cuidador.",
    completeAtMs: Number.POSITIVE_INFINITY,
  },
] as const;

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
              <span className="flex flex-col">
                <span className="step-label text-base">
                  {step.label}
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
              </span>
            </li>
          );
        })}
      </ol>

      <p className="text-sm text-[color:var(--color-text-subtle)]">
        Mientras esperas, no cierres esta página. El audio nunca se guarda en
        nuestros servidores.
      </p>
    </div>
  );
}
