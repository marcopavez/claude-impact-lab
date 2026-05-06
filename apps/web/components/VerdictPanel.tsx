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

import type {
  AudioProcessSuccess,
  UiBadgeSeverity,
} from "../lib/api/audio-process.types";
import {
  ACTION_DESCRIPTION_ES,
  ACTION_LABEL_ES,
  badgeSeverityForAction,
  badgeSeverityForResponse,
} from "../lib/api/audio-process.types";
import { PoweredByClaudeBadge } from "./PoweredByClaudeBadge";

type Props = {
  result: AudioProcessSuccess;
  onReset: () => void;
};

const SEVERITY_STYLES: Record<
  UiBadgeSeverity,
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
  const severity = badgeSeverityForResponse(result);
  const sty = SEVERITY_STYLES[severity];

  // Headline + descripción canónica vienen del Notifier cuando está disponible.
  // Si la cascada se cortó en Triage, caemos al mapping clásico de action.
  const headline =
    result.caregiver_message?.headline ??
    ACTION_LABEL_ES[result.decision.action];
  const description =
    result.caregiver_message?.summary ??
    ACTION_DESCRIPTION_ES[result.decision.action];
  const triageLabel = ACTION_LABEL_ES[result.decision.action];
  const triageBadgeSty = SEVERITY_STYLES[badgeSeverityForAction(result.decision.action)];

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
          aria-label={`${sty.ariaPrefix} ${headline}`}
        >
          {headline}
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

      {/* ================== Acción primaria del cuidador ================== */}
      {result.caregiver_message ? (
        <section
          aria-labelledby="caregiver-action-heading"
          className="rounded-md border-2 p-4 flex flex-col gap-3"
          style={{
            borderColor: sty.border,
            background: "var(--color-surface-2)",
          }}
        >
          <h3
            id="caregiver-action-heading"
            className="text-lg font-semibold text-[color:var(--color-text)]"
          >
            Lo primero que tenés que hacer
          </h3>
          <p className="text-lg leading-relaxed text-[color:var(--color-text)] font-medium">
            {result.caregiver_message.first_action}
          </p>
          {result.caregiver_message.secondary_actions.length > 0 ? (
            <div>
              <p className="text-sm font-semibold text-[color:var(--color-text-muted)] mb-1">
                Y después:
              </p>
              <ul className="list-disc pl-6 flex flex-col gap-1 text-[color:var(--color-text)]">
                {result.caregiver_message.secondary_actions.map((a, i) => (
                  <li key={i} className="leading-relaxed">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.caregiver_message.regulatory_note.length > 0 ? (
            <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-3)] p-3">
              <p className="text-sm font-semibold text-[color:var(--color-text-muted)] mb-1">
                Lo que dice la ley chilena:
              </p>
              <p className="text-[color:var(--color-text)] leading-relaxed">
                {result.caregiver_message.regulatory_note}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* ================== Transcripción ================== */}
      <section aria-labelledby="transcript-heading" className="flex flex-col gap-2">
        <h3
          id="transcript-heading"
          className="text-lg font-semibold text-[color:var(--color-text)]"
        >
          Lo que dijo el llamante
        </h3>
        <p className="text-sm text-[color:var(--color-text-subtle)]">
          Antes del análisis, Vigía revisa la transcripción en busca de RUT,
          números de cuenta y teléfonos para ocultarlos automáticamente.
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

      {/* ================== Análisis profundo (Vishing Analyst) ================== */}
      {result.vishing_analysis ? (
        <details
          className="surface-card border-0 bg-[var(--color-surface-2)] p-4"
          open
        >
          <summary className="cursor-pointer font-semibold text-[color:var(--color-text)] text-base focus-visible:outline-2">
            Análisis profundo de la llamada
            <span className="ml-2 inline-block px-2 py-0.5 rounded text-xs font-mono bg-[var(--color-surface-3)] text-[color:var(--color-text-muted)]">
              {result.vishing_analysis.verdict}
            </span>
          </summary>
          <div className="mt-3 flex flex-col gap-3 text-[color:var(--color-text)]">
            <p className="leading-relaxed">
              {result.vishing_analysis.thinking_summary}
            </p>
            <p className="leading-relaxed">
              {result.vishing_analysis.rationale_es}
            </p>
            {result.vishing_analysis.patterns_detected.length > 0 &&
            result.vishing_analysis.patterns_detected[0] !== "none" ? (
              <div>
                <p className="font-semibold mb-1">Patrones detectados:</p>
                <ul className="list-disc pl-6 flex flex-col gap-1">
                  {result.vishing_analysis.patterns_detected.map((p) => (
                    <li key={p} className="leading-relaxed font-mono text-sm">
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {result.vishing_analysis.claimed_entity ? (
              <p className="text-sm">
                <span className="font-semibold">Entidad reclamada por el llamante:</span>{" "}
                {result.vishing_analysis.claimed_entity}
              </p>
            ) : null}
          </div>
        </details>
      ) : null}

      {/* ================== Verificación de identidad (Identity Verifier) ================== */}
      {result.identity_check ? (
        <details
          className="surface-card border-0 bg-[var(--color-surface-2)] p-4"
          open={result.identity_check.outcome !== "transfer_authorized"}
        >
          <summary className="cursor-pointer font-semibold text-[color:var(--color-text)] text-base focus-visible:outline-2">
            Verificación de identidad del llamante
            <span className="ml-2 inline-block px-2 py-0.5 rounded text-xs font-mono bg-[var(--color-surface-3)] text-[color:var(--color-text-muted)]">
              {result.identity_check.outcome}
            </span>
          </summary>
          <div className="mt-3 flex flex-col gap-3 text-[color:var(--color-text)]">
            <p className="leading-relaxed">{result.identity_check.rationale}</p>
            <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-3)] p-3">
              <p className="text-sm font-semibold text-[color:var(--color-text-muted)] mb-1">
                Plan de verificación humana sugerido al cuidador:
              </p>
              <p className="leading-relaxed text-[color:var(--color-text)] whitespace-pre-wrap">
                {result.identity_check.challenge_plan_for_cuidador}
              </p>
            </div>
            {result.identity_check.evasion_detected ? (
              <p className="text-sm font-semibold text-[color:var(--color-danger)]">
                Vigía detectó señales de evasión / presión durante la verificación.
              </p>
            ) : null}
          </div>
        </details>
      ) : null}

      {/* ================== Citas regulatorias (Regulatory Translator) ================== */}
      {result.regulatory && !result.regulatory.cite_or_silent &&
      result.regulatory.citations.length > 0 ? (
        <details
          className="surface-card border-0 bg-[var(--color-surface-2)] p-4"
        >
          <summary className="cursor-pointer font-semibold text-[color:var(--color-text)] text-base focus-visible:outline-2">
            Citas regulatorias verificadas
            <span className="ml-2 inline-block px-2 py-0.5 rounded text-xs font-mono bg-[var(--color-surface-3)] text-[color:var(--color-text-muted)]">
              {result.regulatory.citations.length} cita
              {result.regulatory.citations.length === 1 ? "" : "s"}
            </span>
          </summary>
          <div className="mt-3 flex flex-col gap-4 text-[color:var(--color-text)]">
            <p className="leading-relaxed">{result.regulatory.translation_es}</p>
            <ul className="flex flex-col gap-3">
              {result.regulatory.citations.map((c, i) => (
                <li
                  key={i}
                  className="rounded border border-[var(--color-border)] bg-[var(--color-surface-3)] p-3"
                >
                  <p className="text-sm font-semibold text-[color:var(--color-text-muted)] mb-1">
                    Fuente: {c.source_id}
                  </p>
                  <blockquote className="border-l-4 border-[var(--color-border)] pl-3 leading-relaxed italic">
                    “{c.quote}”
                  </blockquote>
                  <a
                    href={c.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-sm underline text-[color:var(--color-text-link)] break-all"
                  >
                    Ver en fuente oficial →
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : null}

      {/* ================== Razonamiento del Triage (colapsable) ================== */}
      <details className="surface-card border-0 bg-[var(--color-surface-2)] p-4">
        <summary className="cursor-pointer font-semibold text-[color:var(--color-text)] text-base focus-visible:outline-2">
          Decisión inicial del Triage
          <span
            className="ml-2 inline-block px-2 py-0.5 rounded text-xs font-bold"
            style={{
              background: triageBadgeSty.bg,
              color: triageBadgeSty.fg,
              border: `1px solid ${triageBadgeSty.border}`,
            }}
          >
            {triageLabel}
          </span>
        </summary>
        <div className="mt-3 flex flex-col gap-3 text-[color:var(--color-text)]">
          <p className="leading-relaxed">{result.decision.rationale}</p>

          {result.decision.evidence_of_social_engineering.length > 0 ? (
            <div>
              <p className="font-semibold mb-1">Señales detectadas en el primer pase:</p>
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
              No se identificaron señales de manipulación en el primer pase.
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
              Tiempo por agente
            </dt>
            <dd className="mt-1 flex flex-wrap gap-2 text-xs font-mono text-[color:var(--color-text)]">
              <span className="px-2 py-1 rounded bg-[var(--color-surface-3)]">
                STT: {result.latency_ms.stt_ms}ms
              </span>
              <span className="px-2 py-1 rounded bg-[var(--color-surface-3)]">
                PII: {result.latency_ms.pii_redact_ms}ms
              </span>
              <span className="px-2 py-1 rounded bg-[var(--color-surface-3)]">
                Triage: {result.latency_ms.triage_ms}ms
              </span>
              {typeof result.latency_ms.identity_ms === "number" ? (
                <span className="px-2 py-1 rounded bg-[var(--color-surface-3)]">
                  Identity: {result.latency_ms.identity_ms}ms
                </span>
              ) : null}
              {typeof result.latency_ms.vishing_ms === "number" ? (
                <span className="px-2 py-1 rounded bg-[var(--color-surface-3)]">
                  Vishing: {result.latency_ms.vishing_ms}ms
                </span>
              ) : null}
              {typeof result.latency_ms.regulatory_ms === "number" ? (
                <span className="px-2 py-1 rounded bg-[var(--color-surface-3)]">
                  Regulatory: {result.latency_ms.regulatory_ms}ms
                </span>
              ) : null}
              {typeof result.latency_ms.notifier_ms === "number" ? (
                <span className="px-2 py-1 rounded bg-[var(--color-surface-3)]">
                  Notifier: {result.latency_ms.notifier_ms}ms
                </span>
              ) : null}
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
