// LoadingState — mostrado mientras corre el POST a /api/audio/process.
// Crítico para accesibilidad:
//   - role="status" + aria-live="polite" anuncian el cambio de estado al lector.
//   - El spinner respeta prefers-reduced-motion (fallback dashed sin rotación).
//   - Texto claro nivel sexto básico — sin "procesando", "analizando IA", etc.

type Props = {
  /** Mensaje principal mostrado debajo del spinner. */
  message?: string;
  /** Detalle secundario (ej. "Esto puede tardar unos 10 segundos"). */
  hint?: string;
};

export function LoadingState({
  message = "Analizando el audio…",
  hint = "Esto puede tardar entre 10 y 30 segundos.",
}: Props) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="surface-card flex flex-col items-center gap-4 p-8 text-center"
    >
      <div className="spinner-vigia" aria-hidden="true" />
      <p className="text-xl font-semibold text-[color:var(--color-text)]">
        {message}
      </p>
      <p className="text-base text-[color:var(--color-text-subtle)] max-w-md">
        {hint}
      </p>
      <span className="sr-only">
        Espere mientras Vigía analiza el audio. El resultado aparecerá en pocos
        segundos.
      </span>
    </div>
  );
}
