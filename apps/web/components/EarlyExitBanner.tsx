// EarlyExitBanner — render del atajo del firewall.
//
// Cuando el caller_id matchea blacklist o whitelist en data/demo-config.json,
// el endpoint /api/audio/process NO transcribe ni llama a Claude. El veredicto
// se construye determinísticamente; este banner explica al cuidador por qué
// el audio no se analizó y muestra la fuente del match.

import type { EarlyExitMatch } from "../lib/api/audio-process.types";
import {
  AlertOctagonIcon,
  AlertTriangleIcon,
  ShieldCheckIcon,
} from "./icons";

type Props = { match: EarlyExitMatch };

const POLICY_LABEL_ES: Record<
  Extract<EarlyExitMatch, { reason: "whitelist_match" }>["policy"],
  string
> = {
  always_pass: "Pasa siempre",
  pass_after_verification: "Verificar antes de devolver",
  take_message_only: "Solo tomar mensaje",
};

export function EarlyExitBanner({ match }: Props) {
  if (match.reason === "blacklist_match") {
    return (
      <section
        aria-labelledby="early-exit-heading"
        className="rounded-md border-2 p-5 flex flex-col gap-3"
        style={{
          borderColor: "var(--color-danger)",
          background: "var(--color-danger-bg)",
        }}
      >
        <header className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center w-10 h-10 rounded-full"
            style={{
              background: "var(--color-danger)",
              color: "var(--color-danger-fg)",
            }}
          >
            <AlertOctagonIcon className="w-6 h-6" />
          </span>
          <h2
            id="early-exit-heading"
            className="text-lg font-bold text-[color:var(--color-text)]"
          >
            Atajo del firewall — el audio no se analizó
          </h2>
        </header>
        <p className="text-base leading-relaxed text-[color:var(--color-text)]">
          El número{" "}
          <span className="font-mono font-semibold">{match.caller_id}</span>{" "}
          está en la lista oficial de amenazas reportada por{" "}
          <strong>{match.source}</strong> el {match.reported_at}. Vigía no
          transcribió ni envió el audio a Claude: el match contra la lista de
          amenazas es razón suficiente para descartar la llamada.
        </p>
        <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 leading-relaxed">
          <p className="text-sm font-semibold text-[color:var(--color-text-muted)] mb-1">
            Por qué fue reportado:
          </p>
          <p className="text-[color:var(--color-text)]">
            {match.blacklist_reason}
          </p>
        </div>
        <a
          href={match.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-sm underline text-[color:var(--color-brand)] break-all"
        >
          Ver alerta oficial de {match.source} →
        </a>
      </section>
    );
  }

  // whitelist_match
  const isVerify = match.policy === "pass_after_verification";
  const accentBg = isVerify
    ? "var(--color-warning)"
    : "var(--color-safe)";
  const accentFg = isVerify
    ? "var(--color-warning-fg)"
    : "var(--color-safe-fg)";
  const accentBorder = isVerify
    ? "var(--color-warning)"
    : "var(--color-safe)";
  const accentSurface = isVerify
    ? "var(--color-warning-bg)"
    : "var(--color-safe-bg)";
  const Icon = isVerify ? AlertTriangleIcon : ShieldCheckIcon;

  return (
    <section
      aria-labelledby="early-exit-heading"
      className="rounded-md border-2 p-5 flex flex-col gap-3"
      style={{
        borderColor: accentBorder,
        background: accentSurface,
      }}
    >
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full"
          style={{ background: accentBg, color: accentFg }}
        >
          <Icon className="w-6 h-6" />
        </span>
        <h2
          id="early-exit-heading"
          className="text-lg font-bold text-[color:var(--color-text)]"
        >
          Atajo del firewall — el audio no se analizó
        </h2>
      </header>
      <p className="text-base leading-relaxed text-[color:var(--color-text)]">
        El número{" "}
        <span className="font-mono font-semibold">{match.caller_id}</span>{" "}
        corresponde a <strong>{match.display_name}</strong> ({match.relationship}
        ) en tus contactos confiables. Vigía no transcribió el audio porque la
        política configurada para este contacto ya define el desenlace.
      </p>
      <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface)] p-3 leading-relaxed">
        <p className="text-sm font-semibold text-[color:var(--color-text-muted)] mb-1">
          Política aplicada:
        </p>
        <p className="text-[color:var(--color-text)]">
          {POLICY_LABEL_ES[match.policy]}
        </p>
      </div>
      {isVerify ? (
        <p className="text-sm text-[color:var(--color-text-muted)] leading-relaxed">
          Tip: aunque el número está en tus contactos confiables, suplantar
          caller-ID es trivial. Verifica con palabra clave familiar y devuelve
          tú al número que conoces antes de cualquier transferencia de dinero o
          datos.
        </p>
      ) : null}
    </section>
  );
}
