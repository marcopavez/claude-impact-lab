// ErrorState — render del AudioProcessError con mensaje en español chileno.
// Usa ERROR_MESSAGES_ES del contrato (no inventamos textos).

import type { AudioProcessError } from "../lib/api/audio-process.types";
import { ERROR_MESSAGES_ES } from "../lib/api/audio-process.types";

type Props = {
  error: AudioProcessError;
  onRetry: () => void;
};

export function ErrorState({ error, onRetry }: Props) {
  const friendlyMessage = ERROR_MESSAGES_ES[error.code] ?? error.error;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="surface-card p-6 border-l-4"
      style={{
        borderLeftColor: "var(--color-danger)",
        background: "var(--color-danger-bg)",
      }}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex-shrink-0 mt-0.5 inline-flex items-center justify-center w-8 h-8 rounded-full bg-[color:var(--color-danger)] text-white font-bold"
          >
            !
          </span>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-[color:var(--color-danger)]">
              No pudimos procesar el audio
            </h2>
            <p className="mt-2 text-[color:var(--color-text)]">
              {friendlyMessage}
            </p>
            <p className="mt-2 text-sm text-[color:var(--color-text-subtle)] font-mono">
              Código: {error.code}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onRetry}
            className="btn-primary"
            aria-label="Reintentar el análisis del audio"
          >
            Reintentar
          </button>
        </div>
      </div>
    </div>
  );
}
