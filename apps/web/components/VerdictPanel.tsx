"use client";

// VerdictPanel — render del AudioProcessSuccess.
//
// Decisiones de UX (post-audit +65):
//   - Barra superior coloreada full-width que comunica severidad ANTES
//     de que el usuario empiece a leer.
//   - Ícono SVG enorme (64px) + headline text-4xl/5xl con font-display.
//     El verdict tiene que entenderse en <1 segundo.
//   - Botón "Escuchar veredicto" usa Web Speech API nativa (es-CL).
//     Esencial para baja visión y para confirmar entendimiento.
//   - caregiver_message se muestra SIEMPRE expandido (es la acción que
//     debe leer el cuidador). Vishing / Identity / Triage / Tech van
//     colapsados por default — reduce scroll y carga cognitiva.
//   - PII placeholders renderizan con candado SVG + label legible
//     en lugar de "<RUT_REDACTED>" literal.

import { useCallback, useEffect, useState } from "react";
import type {
  AudioProcessSuccess,
  UiBadgeSeverity,
} from "../lib/api/audio-process.types";
import {
  ACTION_DESCRIPTION_ES,
  ACTION_LABEL_ES,
  AUDIO_PROCESS_LIMITS,
  badgeSeverityForAction,
  badgeSeverityForResponse,
  CONFIDENCE_DESCRIPTION_ES,
  CONFIDENCE_LABEL_ES,
} from "../lib/api/audio-process.types";
import {
  addToHistory,
  type HistoryEntry,
  type HistoryVerdict,
} from "../lib/storage/history";
import { CaregiverRedirectCard } from "./CaregiverRedirectCard";
import { CascadeTrace } from "./CascadeTrace";
import { CounterScriptCard } from "./CounterScriptCard";
import { DamageControlCard } from "./DamageControlCard";
import { DenunciaCard } from "./DenunciaCard";
import { EarlyExitBanner } from "./EarlyExitBanner";
import { PersonalBlacklistButton } from "./PersonalBlacklistButton";
import { PoweredByClaudeBadge } from "./PoweredByClaudeBadge";
import {
  AlertOctagonIcon,
  AlertTriangleIcon,
  CheckCircleIcon,
  InfoIcon,
  LockIcon,
  RefreshIcon,
  ShieldCheckIcon,
  VolumeIcon,
  VolumeMuteIcon,
} from "./icons";

type Props = {
  result: AudioProcessSuccess;
  onReset: () => void;
  /**
   * Two-phase: cuando es true, el verdict + evidencia + denuncia ya están
   * completos pero el plan de acción del cuidador (caregiver_message) está
   * siendo generado por /api/notification/generate. El panel correspondiente
   * muestra spinner. Cuando termina, el padre actualiza result y este flag
   * vuelve a false. En early-exit del firewall siempre es false (el plan
   * llegó completo en el primer response).
   */
  caregiverPending?: boolean;
};

type SeverityStyle = {
  bg: string;
  fg: string;
  border: string;
  stripe: string;
  ariaPrefix: string;
  Icon: (props: { className?: string }) => React.JSX.Element;
  pulse: boolean;
};

const SEVERITY_STYLES: Record<UiBadgeSeverity, SeverityStyle> = {
  danger: {
    bg: "var(--color-danger)",
    fg: "var(--color-danger-fg)",
    border: "var(--color-danger)",
    stripe: "var(--color-danger)",
    ariaPrefix: "Riesgo alto:",
    Icon: AlertOctagonIcon,
    pulse: true,
  },
  warning: {
    bg: "var(--color-warning)",
    fg: "var(--color-warning-fg)",
    border: "var(--color-warning)",
    stripe: "var(--color-warning)",
    ariaPrefix: "Atención:",
    Icon: AlertTriangleIcon,
    pulse: false,
  },
  neutral: {
    bg: "var(--color-neutral)",
    fg: "var(--color-neutral-fg)",
    border: "var(--color-neutral)",
    stripe: "var(--color-neutral)",
    ariaPrefix: "Mensaje guardado:",
    Icon: InfoIcon,
    pulse: false,
  },
  safe: {
    bg: "var(--color-safe)",
    fg: "var(--color-safe-fg)",
    border: "var(--color-safe)",
    stripe: "var(--color-safe)",
    ariaPrefix: "Llamada segura:",
    Icon: ShieldCheckIcon,
    pulse: false,
  },
};

const PII_LABELS: Record<string, string> = {
  RUT: "Número de identidad RUT (oculto por seguridad)",
  PHONE: "Número de teléfono móvil (oculto por seguridad)",
  CARD: "Número de tarjeta bancaria (oculto por seguridad)",
  IBAN: "Cuenta bancaria internacional IBAN (oculta por seguridad)",
  ACCOUNT: "Número de cuenta bancaria (oculto por seguridad)",
};

const PII_SHORT_LABELS: Record<string, string> = {
  RUT: "RUT oculto",
  PHONE: "Teléfono oculto",
  CARD: "Tarjeta oculta",
  IBAN: "Cuenta IBAN oculta",
  ACCOUNT: "Cuenta oculta",
};

const PLACEHOLDER_REGEX =
  /<(RUT|PHONE|CARD|IBAN|ACCOUNT)_REDACTED>/g;

/**
 * Render del transcript con cada `<XXX_REDACTED>` reemplazado por un span
 * con candado + label legible + tooltip nativo, accesible por teclado.
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
    const longLabel = PII_LABELS[kind] ?? "Dato sensible oculto";
    const shortLabel = PII_SHORT_LABELS[kind] ?? "Dato oculto";
    parts.push(
      <span
        key={nodeKey++}
        className="pii-placeholder"
        title={longLabel}
        aria-label={longLabel}
        tabIndex={0}
      >
        <LockIcon className="w-3 h-3" />
        <span>{shortLabel}</span>
      </span>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < transcript.length) {
    parts.push(<span key={nodeKey++}>{transcript.slice(lastIndex)}</span>);
  }
  return parts;
}

/**
 * Deriva el HistoryEntry que se guarda en IndexedDB para alimentar el panel
 * "Análisis recientes". Determinista, sin LLM. La severity y headline canónicas
 * vienen del Caregiver Notifier cuando éste corrió; si la cascada se cortó
 * antes (firewall early-exit, Triage falló), caemos al action label del Triage
 * como mejor aproximación al texto que el cuidador acaba de ver.
 */
function historyEntryFromResult(result: AudioProcessSuccess): HistoryEntry {
  let verdict: HistoryVerdict;
  if (result.early_exit) {
    if (result.early_exit.reason === "blacklist_match") {
      verdict = "blacklist_match";
    } else {
      switch (result.early_exit.policy) {
        case "always_pass":
          verdict = "whitelist_pass";
          break;
        case "pass_after_verification":
          verdict = "whitelist_verify";
          break;
        case "take_message_only":
          verdict = "whitelist_message";
          break;
      }
    }
  } else if (result.vishing_analysis) {
    verdict = result.vishing_analysis.verdict;
  } else {
    verdict = "unknown";
  }

  const severity = result.caregiver_message?.severity ?? "MEDIUM";
  const headline =
    result.caregiver_message?.headline ?? ACTION_LABEL_ES[result.decision.action];

  return {
    audio_id: result.audio_id,
    caller_id_e164: result.caller_id,
    verdict,
    severity,
    headline: headline.slice(0, 80),
    created_at: new Date().toISOString(),
    was_early_exit: result.early_exit !== undefined,
  };
}

/** Construye el texto que el TTS lee en voz alta. */
function buildTtsText(args: {
  ariaPrefix: string;
  headline: string;
  description: string;
  firstAction?: string;
}): string {
  const parts: string[] = [];
  parts.push(args.ariaPrefix);
  parts.push(args.headline);
  parts.push(args.description);
  if (args.firstAction) {
    parts.push("Lo primero que tienes que hacer:");
    parts.push(args.firstAction);
  }
  return parts.join(". ");
}

/** Selecciona la mejor voz es-CL / es-* disponible en el browser. */
function pickSpanishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  const cl = voices.find((v) => v.lang === "es-CL");
  if (cl) return cl;
  const otherEs = voices.find((v) => v.lang.startsWith("es"));
  return otherEs ?? null;
}

export function VerdictPanel({ result, onReset, caregiverPending = false }: Props) {
  const severity = badgeSeverityForResponse(result);
  const sty = SEVERITY_STYLES[severity];
  const isEarlyExit = result.early_exit !== undefined;
  const isWhitelistMatch =
    result.early_exit?.reason === "whitelist_match";

  // Para whitelist matches, el header (icono gigante + stripe + eyebrow) usa
  // estilo "safe" (verde, ShieldCheckIcon) aunque la severity computada sea
  // MEDIUM (caso pass_after_verification). El recuadro "Lo primero que tienes
  // que hacer" sigue usando `sty` (severity real), así la cautela queda visible
  // sin contradecir el mensaje principal "este número está en tus contactos".
  const headerSty = isWhitelistMatch ? SEVERITY_STYLES.safe : sty;
  const eyebrowText = isWhitelistMatch
    ? "Contacto registrado en tus confiables"
    : "Veredicto de Vigía";
  // Prefijo para aria-label + TTS. "Llamada segura:" del estilo `safe` se lee
  // mal para pass_after_verification (Pedro) porque después el body dice
  // "verifica antes de devolver". "Contacto registrado:" funciona para LOW y
  // MEDIUM whitelist sin contradecirse.
  const headerAriaPrefix = isWhitelistMatch
    ? "Contacto registrado:"
    : sty.ariaPrefix;

  const headline =
    result.caregiver_message?.headline ??
    ACTION_LABEL_ES[result.decision.action];
  const description =
    result.caregiver_message?.summary ??
    ACTION_DESCRIPTION_ES[result.decision.action];
  const firstAction = result.caregiver_message?.first_action;
  const triageLabel = ACTION_LABEL_ES[result.decision.action];
  const triageBadgeSty =
    SEVERITY_STYLES[badgeSeverityForAction(result.decision.action)];

  const totalSeconds = (result.latency_ms.total_ms / 1000).toFixed(1);
  const primaryModel = result.models_used[0] ?? "claude-sonnet-4-6";

  // ---------- TTS state ----------
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      setTtsAvailable(true);
      // El listado de voces a veces se carga async — forzamos un fetch
      // para que pickSpanishVoice() funcione en el primer click.
      window.speechSynthesis.getVoices();
    }
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Persistir el análisis en el historial client-side (IndexedDB). La
  // dependencia es result.audio_id en lugar del objeto entero para evitar
  // re-inserts si el padre re-renderiza el mismo resultado por otra razón.
  // El primary key es audio_id, por lo que un re-insert sería idempotente,
  // pero igual evitamos el ruido de eventos extra.
  useEffect(() => {
    void addToHistory(historyEntryFromResult(result));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.audio_id]);

  const speakOrStop = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const text = buildTtsText({
      ariaPrefix: headerAriaPrefix,
      headline,
      description,
      firstAction,
    });
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-CL";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    const voice = pickSpanishVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, [
    isSpeaking,
    headerAriaPrefix,
    headline,
    description,
    firstAction,
  ]);

  return (
    <article
      aria-labelledby="verdict-title"
      className="surface-card overflow-hidden flex flex-col"
    >
      {/* Barra superior coloreada — comunica severidad antes de leer. */}
      <div
        className="verdict-stripe"
        style={{ background: headerSty.stripe }}
        aria-hidden="true"
      />

      <div className="p-6 sm:p-8 flex flex-col gap-6">
        {/* ================== Header con badge gigante ================== */}
        <header className="flex flex-col gap-4">
          <p
            className="text-sm uppercase tracking-wide font-semibold text-[color:var(--color-text-muted)]"
            id="verdict-eyebrow"
          >
            {eyebrowText}
          </p>

          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-4"
            aria-label={`${headerAriaPrefix} ${headline}`}
          >
            <span
              aria-hidden="true"
              className={`flex-shrink-0 inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full ${
                headerSty.pulse ? "pulse-danger" : ""
              }`}
              style={{
                background: headerSty.bg,
                color: headerSty.fg,
              }}
            >
              <headerSty.Icon className="w-9 h-9 sm:w-11 sm:h-11" />
            </span>
            <div className="flex flex-col gap-1 min-w-0">
              <h1
                id="verdict-title"
                className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-[color:var(--color-text)]"
              >
                {headline}
              </h1>
              <p className="text-lg text-[color:var(--color-text-muted)] leading-relaxed">
                {description}
              </p>
            </div>
          </div>

          {/* Acciones del verdict: TTS + badge Claude. */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {ttsAvailable ? (
              <button
                type="button"
                onClick={speakOrStop}
                className="btn-secondary"
                aria-pressed={isSpeaking}
                aria-label={
                  isSpeaking
                    ? "Detener la lectura del veredicto"
                    : "Escuchar el veredicto en voz alta"
                }
              >
                {isSpeaking ? (
                  <VolumeMuteIcon className="w-5 h-5" />
                ) : (
                  <VolumeIcon className="w-5 h-5" />
                )}
                <span>
                  {isSpeaking ? "Detener lectura" : "Escuchar este resultado"}
                </span>
              </button>
            ) : (
              <span />
            )}
            {isEarlyExit ? (
              <span
                className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] font-medium text-[color:var(--color-text-muted)] text-sm py-1 px-2"
                aria-label="Decisión local del firewall, sin llamar a Claude"
              >
                <ShieldCheckIcon className="w-4 h-4 text-[color:var(--color-brand)]" />
                <span>
                  Decisión{" "}
                  <strong className="text-[color:var(--color-text)]">
                    local
                  </strong>{" "}
                  del firewall
                </span>
              </span>
            ) : (
              <PoweredByClaudeBadge model={primaryModel} size="sm" />
            )}
          </div>
        </header>

        {/* ================== Banner early-exit (firewall match) ================== */}
        {result.early_exit ? (
          <EarlyExitBanner match={result.early_exit} />
        ) : null}

        {/* ================== Acción primaria (siempre visible) ================== */}
        {result.caregiver_message ? (
          <section
            aria-labelledby="caregiver-action-heading"
            className="rounded-md border-2 p-5 flex flex-col gap-4"
            style={{
              borderColor: sty.border,
              background: "var(--color-surface-2)",
            }}
          >
            <h2
              id="caregiver-action-heading"
              className="text-lg font-bold text-[color:var(--color-text)]"
            >
              Lo primero que tienes que hacer
            </h2>
            <p className="text-xl leading-relaxed text-[color:var(--color-text)] font-medium">
              {result.caregiver_message.first_action}
            </p>
            {result.caregiver_message.secondary_actions.length > 0 ? (
              <div>
                <p className="text-sm font-semibold text-[color:var(--color-text-muted)] mb-2">
                  Y después:
                </p>
                <ul className="list-disc pl-6 flex flex-col gap-1.5 text-[color:var(--color-text)]">
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
        ) : caregiverPending ? (
          // Two-phase pending: el verdict ya está visible arriba; el plan
          // accionable lo está generando Claude Haiku 4.5 vía /api/notification/generate.
          // Latencia típica: ~5s. Mientras tanto mostramos el slot con spinner +
          // chip del modelo (J3.4 Claude evidente).
          <section
            aria-labelledby="caregiver-action-pending-heading"
            aria-busy="true"
            className="rounded-md border-2 border-dashed p-5 flex flex-col gap-3"
            style={{
              borderColor: "var(--color-border)",
              background: "var(--color-surface-2)",
            }}
          >
            <h2
              id="caregiver-action-pending-heading"
              className="text-lg font-bold text-[color:var(--color-text)]"
            >
              Preparando tu plan de acción…
            </h2>
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="inline-block w-5 h-5 rounded-full border-2 border-[color:var(--color-brand)] border-t-transparent animate-spin motion-reduce:animate-none"
              />
              <p className="text-base text-[color:var(--color-text-muted)] leading-relaxed">
                Claude Haiku 4.5 está adaptando la recomendación para que sea
                clara y accionable.
              </p>
            </div>
          </section>
        ) : (
          // Two-phase falló o el cliente no esperó: el verdict ya está, pero el
          // plan accionable no llegó. Mostramos un fallback simple que no bloquea
          // la lectura del veredicto principal.
          <section
            aria-labelledby="caregiver-action-fallback-heading"
            className="rounded-md border border-[var(--color-border)] p-5 flex flex-col gap-2"
            style={{ background: "var(--color-surface-2)" }}
          >
            <h2
              id="caregiver-action-fallback-heading"
              className="text-base font-semibold text-[color:var(--color-text-muted)]"
            >
              Plan de acción no disponible
            </h2>
            <p className="text-base text-[color:var(--color-text-muted)] leading-relaxed">
              No pudimos generar el plan adaptado para esta llamada. La
              recomendación general: no devuelvas el llamado al número que
              apareció. Si era importante, llama al número oficial publicado.
            </p>
          </section>
        )}

        {/* ================== Derivación a humano de confianza ================== */}
        {result.caregiver_redirect ? (
          <CaregiverRedirectCard redirect={result.caregiver_redirect} />
        ) : null}

        {/* ================== Frase defensiva para futuras llamadas ================== */}
        {result.caregiver_message?.counter_script_es ? (
          <CounterScriptCard
            counterScript={result.caregiver_message.counter_script_es}
          />
        ) : null}

        {/* ================== Plan de denuncia pre-rellenado ================== */}
        {result.denuncia ? <DenunciaCard denuncia={result.denuncia} /> : null}

        {/* ================== ¿Ya entregó datos? — respuesta a incidente ================== */}
        {/*
          Solo se renderiza si severity ≥ MEDIUM (el componente retorna null en LOW).
          Cubre cascada (caregiver_message presente) y early-exit blacklist HIGH.
          Sin LLM extra: las acciones se derivan deterministicamente de patterns +
          institutional_registry.
        */}
        <DamageControlCard
          patterns={result.vishing_analysis?.patterns_detected ?? []}
          severity={result.caregiver_message?.severity ?? "MEDIUM"}
        />

        {/* ================== Transcripción (oculta en early-exit) ================== */}
        {!isEarlyExit ? (
        <section
          aria-labelledby="transcript-heading"
          className="flex flex-col gap-2"
        >
          <h2
            id="transcript-heading"
            className="text-lg font-semibold text-[color:var(--color-text)]"
          >
            Lo que dijo el llamante
          </h2>
          <div
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 leading-relaxed text-[color:var(--color-text)]"
            lang="es-CL"
          >
            {renderTranscript(result.transcript_redacted)}
          </div>
          {result.pii_summary.hits_count > 0 ? (
            <p className="text-sm text-[color:var(--color-text-muted)]">
              Vigía ocultó <strong>{result.pii_summary.hits_count}</strong>{" "}
              dato(s) sensible(s) en la transcripción.
            </p>
          ) : (
            <p className="text-sm text-[color:var(--color-text-subtle)]">
              No se detectaron datos sensibles en la transcripción.
            </p>
          )}
          {result.caller_id !== AUDIO_PROCESS_LIMITS.defaultCallerId ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
              <span className="text-sm text-[color:var(--color-text-muted)]">
                Número del llamante:{" "}
                <span className="font-mono text-[color:var(--color-text)]">
                  {result.caller_id}
                </span>
              </span>
              <PersonalBlacklistButton
                callerId={result.caller_id}
                defaultReason={
                  result.caregiver_message?.headline ??
                  "Llamada sospechosa detectada por Vigía"
                }
                sourceAudioId={result.audio_id}
              />
            </div>
          ) : null}
        </section>
        ) : null}

        {/* ================== Cascada agéntica — trazabilidad de qué corrió ================== */}
        <CascadeTrace result={result} />

        {/* ================== Análisis profundo (Vishing Analyst) ================== */}
        {result.vishing_analysis ? (
          <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <summary className="cursor-pointer font-semibold text-[color:var(--color-text)] text-base">
              Análisis profundo de la llamada
              <span className="ml-2 inline-block px-2 py-0.5 rounded text-xs font-mono bg-[var(--color-surface-3)] text-[color:var(--color-text-muted)]">
                {result.vishing_analysis.verdict}
              </span>
              {result.confidence_band ? (
                <span
                  title={CONFIDENCE_DESCRIPTION_ES[result.confidence_band]}
                  aria-label={CONFIDENCE_DESCRIPTION_ES[result.confidence_band]}
                  className="ml-2 inline-block px-2 py-0.5 rounded text-xs font-semibold bg-[var(--color-surface-3)] text-[color:var(--color-text)] border border-[var(--color-border)]"
                >
                  {CONFIDENCE_LABEL_ES[result.confidence_band]}
                </span>
              ) : null}
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
                      <li
                        key={p}
                        className="leading-relaxed font-mono text-sm"
                      >
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {result.vishing_analysis.claimed_entity ? (
                <p className="text-sm">
                  <span className="font-semibold">
                    Entidad reclamada por el llamante:
                  </span>{" "}
                  {result.vishing_analysis.claimed_entity}
                </p>
              ) : null}
            </div>
          </details>
        ) : null}

        {/* ================== Verificación de identidad (Identity Verifier) ================== */}
        {result.identity_check ? (
          <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <summary className="cursor-pointer font-semibold text-[color:var(--color-text)] text-base">
              Verificación de identidad del llamante
              <span className="ml-2 inline-block px-2 py-0.5 rounded text-xs font-mono bg-[var(--color-surface-3)] text-[color:var(--color-text-muted)]">
                {result.identity_check.outcome}
              </span>
            </summary>
            <div className="mt-3 flex flex-col gap-3 text-[color:var(--color-text)]">
              <p className="leading-relaxed">
                {result.identity_check.rationale}
              </p>
              <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-3)] p-3">
                <p className="text-sm font-semibold text-[color:var(--color-text-muted)] mb-1">
                  Plan de verificación humana sugerido:
                </p>
                <p className="leading-relaxed text-[color:var(--color-text)] whitespace-pre-wrap">
                  {result.identity_check.challenge_plan_for_cuidador}
                </p>
              </div>
              {result.identity_check.evasion_detected ? (
                <p className="text-sm font-semibold text-[color:var(--color-danger)]">
                  Vigía detectó señales de evasión o presión durante la
                  conversación.
                </p>
              ) : null}
            </div>
          </details>
        ) : null}

        {/* ================== Citas regulatorias (Regulatory Translator) ================== */}
        {result.regulatory && !result.regulatory.cite_or_silent &&
        result.regulatory.citations.length > 0 ? (
          <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <summary className="cursor-pointer font-semibold text-[color:var(--color-text)] text-base">
              Citas regulatorias verificadas
              <span className="ml-2 inline-block px-2 py-0.5 rounded text-xs font-mono bg-[var(--color-surface-3)] text-[color:var(--color-text-muted)]">
                {result.regulatory.citations.length} cita
                {result.regulatory.citations.length === 1 ? "" : "s"}
              </span>
            </summary>
            <div className="mt-3 flex flex-col gap-4 text-[color:var(--color-text)]">
              <p className="leading-relaxed">
                {result.regulatory.translation_es}
              </p>
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
                      className="mt-2 inline-block text-sm underline text-[color:var(--color-brand)] break-all"
                    >
                      Ver en fuente oficial →
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </details>
        ) : null}

        {/* ================== Razonamiento del Triage (oculto en early-exit) ================== */}
        {!isEarlyExit ? (
        <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
          <summary className="cursor-pointer font-semibold text-[color:var(--color-text)] text-base">
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
                <p className="font-semibold mb-1">
                  Señales detectadas en el primer pase:
                </p>
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
        ) : null}

        {/* ================== Pie técnico (colapsable, cerrado) ================== */}
        <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
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

          <div className="mt-4 pt-3 border-t border-[var(--color-border)] flex flex-col gap-2">
            <p className="text-xs text-[color:var(--color-text-subtle)] leading-relaxed">
              Cada eslabón de la cascada tiene un gate explícito en el orquestador:
              la profundidad del análisis es proporcional al riesgo del audio.
            </p>
            <p className="text-xs text-[color:var(--color-text-subtle)] leading-relaxed">
              Las recomendaciones de respuesta a incidente se generan
              deterministamente a partir de los patrones detectados — no las
              inventa Claude.
            </p>
          </div>
        </details>

        {/* ================== Reset ================== */}
        <div className="flex flex-col sm:flex-row sm:justify-end gap-3">
          <button
            type="button"
            onClick={onReset}
            className="btn-primary"
            aria-label="Volver al inicio para analizar otro audio"
          >
            <RefreshIcon className="w-5 h-5" />
            <span>Analizar otro audio</span>
          </button>
        </div>
      </div>
    </article>
  );
}
