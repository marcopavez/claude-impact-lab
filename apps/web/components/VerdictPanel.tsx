// VerdictPanel — render del AudioProcessSuccess.
//
// Decisiones de UX:
//   - Badge de severidad enorme (font-size 1.5rem, weight 700) — el cuidador
//     debe entender el veredicto en <1 segundo.
//   - Transcript con placeholders <RUT_REDACTED> renderizados como "chips" con
//     tooltip explicativo para no asustar al usuario al ver el HTML literal.
//   - Razonamiento + footer técnico colapsables vía <details>/<summary> nativo:
//     accesibilidad gratis (Tab + Enter/Space), sin JS extra.
//   - Botón "Analizar otro audio" para reset hace foco-trap implícito vía onReset.

import type { AudioProcessSuccess } from "../lib/api/audio-process.types";
import {
  ACTION_DESCRIPTION_ES,
  ACTION_LABEL_ES,
  badgeSeverityForAction,
} from "../lib/api/audio-process.types";
import { PoweredByClaudeBadge } from "./PoweredByClaudeBadge";

type Props = {
  result: AudioProcessSuccess;
  onReset: () => void;
};

const SEVERITY_STYLES: Record<
  ReturnType<typeof badgeSeverityForAction>,
  { bg: string; fg: string; border: string; ariaPrefix: string }
> = {
  danger: {
    bg: "var(--color-danger)",
    fg: "var(--color-danger-fg)",
    border: "var(--color-danger)",
    ariaPrefix: "Riesgo alto:",
  },
  warning: {
    bg: "var(--color-warning)",
    fg: "var(--color-warning-fg)",
    border: "var(--color-warning)",
    ariaPrefix: "Atención:",
  },
  neutral: {
    bg: "var(--color-neutral)",
    fg: "var(--color-neutral-fg)",
    border: "var(--color-neutral)",
    ariaPrefix: "Mensaje guardado:",
  },
  safe: {
    bg: "var(--color-safe)",
    fg: "var(--color-safe-fg)",
    border: "var(--color-safe)",
    ariaPrefix: "Llamada segura:",
  },
};

const PII_LABELS: Record<string, string> = {
  RUT: "Número de identidad RUT (oculto por seguridad)",
  PHONE: "Número de teléfono móvil (oculto por seguridad)",
  CARD: "Número de tarjeta bancaria (oculto por seguridad)",
  IBAN: "Cuenta bancaria internacional IBAN (oculta por seguridad)",
  ACCOUNT: "Número de cuenta bancaria (oculto por seguridad)",
};

const PLACEHOLDER_REGEX =
  /<(RUT|PHONE|CARD|IBAN|ACCOUNT)_REDACTED>/g;

/**
 * Render del transcript con cada `<XXX_REDACTED>` reemplazado por un span
 * con tooltip nativo (`title`) + aria-label, accesible por teclado.
 */
function renderTranscript(transcript: string): React.ReactNode {
  if (!transcript) {
    return (
      <span className="italic text-[color:var(--color-text-subtle)]">
        Sin transcripción disponible.
      </span>
    );
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  // Reset state explícito porque la regex tiene flag g.
  PLACEHOLDER_REGEX.lastIndex = 0;
  let nodeKey = 0;

  while ((match = PLACEHOLDER_REGEX.exec(transcript)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <span key={nodeKey++}>
          {transcript.slice(lastIndex, match.index)}
        </span>,
      );
    }
    const kind = match[1];
    const label = PII_LABELS[kind] ?? "Dato sensible oculto";
    parts.push(
      <span
        key={nodeKey++}
        className="pii-placeholder"
        title={label}
        aria-label={label}
        tabIndex={0}
      >
        {match[0]}
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < transcript.length) {
    parts.push(<span key={nodeKey++}>{transcript.slice(lastIndex)}</span>);
  }
  return parts;
}

export function VerdictPanel({ result, onReset }: Props) {
  const severity = badgeSeverityForAction(result.decision.action);
  const sty = SEVERITY_STYLES[severity];
  const label = ACTION_LABEL_ES[result.decision.action];
  const description = ACTION_DESCRIPTION_ES[result.decision.action];

  const totalSeconds = (result.latency_ms.total_ms / 1000).toFixed(1);
  const primaryModel = result.models_used[0] ?? "claude-sonnet-4-6";

  return (
    <article
      aria-labelledby="verdict-title"
      className="surface-card p-6 sm:p-8 flex flex-col gap-6"
    >
      {/* ================== Header con badge ================== */}
      <header className="flex flex-col gap-3">
        <p
          className="text-sm uppercase tracking-wide font-semibold text-[color:var(--color-text-muted)]"
          id="verdict-eyebrow"
        >
          Veredicto de Vigía
        </p>
        <div
          role="status"
          aria-live="polite"
          className="inline-flex items-center self-start rounded-md px-4 py-3 text-2xl font-bold"
          style={{
            background: sty.bg,
            color: sty.fg,
            border: `2px solid ${sty.border}`,
          }}
          aria-label={`${sty.ariaPrefix} ${label}`}
        >
          {label}
        </div>
        <h2
          id="verdict-title"
          className="text-xl text-[color:var(--color-text)] leading-relaxed"
        >
          {description}
        </h2>
        <div>
          <PoweredByClaudeBadge model={primaryModel} size="sm" />
        </div>
      </header>

      {/* ================== Transcripción ================== */}
      <section aria-labelledby="transcript-heading" className="flex flex-col gap-2">
        <h3
          id="transcript-heading"
          className="text-lg font-semibold text-[color:var(--color-text)]"
        >
          Lo que dijo el llamante
        </h3>
        <p className="text-sm text-[color:var(--color-text-subtle)]">
          Los datos sensibles (cuentas, teléfonos, RUT) fueron ocultados antes
          de mostrarte el resultado.
        </p>
        <div
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 leading-relaxed text-[color:var(--color-text)]"
          lang="es-CL"
        >
          {renderTranscript(result.transcript_redacted)}
        </div>
        {result.pii_summary.hits_count > 0 ? (
          <p className="text-sm text-[color:var(--color-text-muted)]">
            Vigía ocultó <strong>{result.pii_summary.hits_count}</strong> dato(s)
            sensible(s) en la transcripción.
          </p>
        ) : (
          <p className="text-sm text-[color:var(--color-text-subtle)]">
            No se detectaron datos sensibles en la transcripción.
          </p>
        )}
      </section>

      {/* ================== Razonamiento (colapsable) ================== */}
      <details className="surface-card border-0 bg-[var(--color-surface-2)] p-4">
        <summary className="cursor-pointer font-semibold text-[color:var(--color-text)] text-base focus-visible:outline-2">
          Por qué Vigía decidió esto
        </summary>
        <div className="mt-3 flex flex-col gap-3 text-[color:var(--color-text)]">
          <p className="leading-relaxed">{result.decision.rationale}</p>

          {result.decision.evidence_of_social_engineering.length > 0 ? (
            <div>
              <p className="font-semibold mb-1">Señales detectadas:</p>
              <ul className="list-disc pl-6 flex flex-col gap-1">
                {result.decision.evidence_of_social_engineering.map(
                  (item, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {item}
                    </li>
                  ),
                )}
              </ul>
            </div>
          ) : (
            <p className="text-[color:var(--color-text-subtle)] italic">
              No se identificaron señales de manipulación.
            </p>
          )}
        </div>
      </details>

      {/* ================== Pie técnico (colapsable) ================== */}
      <details className="surface-card border-0 bg-[var(--color-surface-2)] p-4">
        <summary className="cursor-pointer font-semibold text-[color:var(--color-text)] text-base">
          Detalles técnicos
        </summary>
        <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          <div>
            <dt className="text-sm font-semibold text-[color:var(--color-text-muted)]">
              Modelos de Claude usados
            </dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {result.models_used.map((m) => (
                <span
                  key={m}
                  className="inline-block px-2 py-1 rounded font-mono text-xs bg-[var(--color-surface-3)] text-[color:var(--color-text)]"
                >
                  {m}
                </span>
              ))}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-semibold text-[color:var(--color-text-muted)]">
              Herramientas invocadas
            </dt>
            <dd className="mt-1 flex flex-wrap gap-2">
              {result.tools_used.map((t) => (
                <span
                  key={t}
                  className="inline-block px-2 py-1 rounded font-mono text-xs bg-[var(--color-surface-3)] text-[color:var(--color-text)]"
                >
                  {t}
                </span>
              ))}
            </dd>
          </div>

          <div>
            <dt className="text-sm font-semibold text-[color:var(--color-text-muted)]">
              Tiempo total de análisis
            </dt>
            <dd className="mt-1 text-[color:var(--color-text)]">
              {totalSeconds} segundos
            </dd>
          </div>

          <div>
            <dt className="text-sm font-semibold text-[color:var(--color-text-muted)]">
              Datos sensibles ocultados
            </dt>
            <dd className="mt-1 text-[color:var(--color-text)]">
              {result.pii_summary.hits_count}
            </dd>
          </div>

          <div className="sm:col-span-2">
            <dt className="text-sm font-semibold text-[color:var(--color-text-muted)]">
              Identificador del análisis
            </dt>
            <dd className="mt-1 font-mono text-xs text-[color:var(--color-text-subtle)] break-all">
              {result.audio_id}
            </dd>
          </div>
        </dl>
      </details>

      {/* ================== Reset ================== */}
      <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
        <button
          type="button"
          onClick={onReset}
          className="btn-primary"
          aria-label="Volver al inicio para analizar otro audio"
        >
          Analizar otro audio
        </button>
      </div>
    </article>
  );
}
