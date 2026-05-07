// Badge "Powered by Claude" — sostiene J3.4 ("Claude evidente") en la demo.
// Visible siempre que se renderice un veredicto, idealmente cerca del CTA.
// Reemplazado el emoji ⚡ por un SparkleIcon SVG para consistencia entre OS.

import { SparkleIcon } from "./icons";

type Props = {
  /** Modelo activo a mostrar; default Sonnet 4.6 que es el que mueve el Triage. */
  model?: string;
  /** Densidad del componente. */
  size?: "sm" | "md";
  /** Marca-clase adicional para layouting. */
  className?: string;
};

export function PoweredByClaudeBadge({
  model = "claude-sonnet-4-6",
  size = "md",
  className,
}: Props) {
  const sizeClasses =
    size === "sm" ? "text-sm py-1 px-2" : "text-base py-1.5 px-3";

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] font-medium text-[color:var(--color-text-muted)] ${sizeClasses} ${className ?? ""}`}
      aria-label={`Análisis hecho con Claude, modelo ${model}`}
    >
      <SparkleIcon className="w-4 h-4 text-[color:var(--color-brand)]" />
      <span>
        Análisis con{" "}
        <strong className="text-[color:var(--color-text)]">Claude</strong>
      </span>
      <span
        aria-hidden="true"
        className="font-mono text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-3)] text-[color:var(--color-text-muted)]"
      >
        {model}
      </span>
    </span>
  );
}
