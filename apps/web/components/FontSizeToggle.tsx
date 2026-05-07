"use client";

// Toggle de tamaño de texto in-app — accesibilidad +65.
//
// El usuario adulto mayor frecuentemente no sabe Ctrl + (zoom del browser).
// Este toggle multiplica --font-size-base por un factor (1 / 1.25 / 1.5)
// que --font-size-base aplica via clamp() en globals.css.
//
// Persistido en localStorage; al mount lee el valor antes del primer paint
// para evitar flicker. Se aplica al html.style.fontSize directamente.

import { useEffect, useState } from "react";

const STORAGE_KEY = "vigia-font-scale";
type Scale = "1" | "1.25" | "1.5";
const DEFAULT_SCALE: Scale = "1";

const OPTIONS: Array<{ value: Scale; label: string; ariaLabel: string }> = [
  { value: "1", label: "A", ariaLabel: "Tamaño de texto normal" },
  { value: "1.25", label: "A+", ariaLabel: "Tamaño de texto grande" },
  { value: "1.5", label: "A++", ariaLabel: "Tamaño de texto extra grande" },
];

function applyScale(scale: Scale) {
  if (typeof document === "undefined") return;
  // --font-scale es leído por --font-size-base en globals.css.
  document.documentElement.style.setProperty("--font-scale", scale);
}

export function FontSizeToggle() {
  const [scale, setScale] = useState<Scale>(DEFAULT_SCALE);

  // Hidratación: leer localStorage al mount y aplicar.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === "1" || stored === "1.25" || stored === "1.5") {
        setScale(stored);
        applyScale(stored);
      }
    } catch {
      // localStorage puede fallar en privado / sandbox — ignoramos.
    }
  }, []);

  const handleChange = (next: Scale) => {
    setScale(next);
    applyScale(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Misma razón que arriba.
    }
  };

  return (
    <div
      role="group"
      aria-label="Tamaño del texto"
      className="inline-flex items-center gap-0 rounded-md border border-[var(--color-border)] bg-white overflow-hidden"
    >
      {OPTIONS.map((opt, idx) => {
        const active = scale === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => handleChange(opt.value)}
            aria-pressed={active}
            aria-label={opt.ariaLabel}
            className={[
              "min-h-[44px] min-w-[44px] px-3 py-1 font-semibold transition-colors",
              idx > 0 ? "border-l border-[var(--color-border)]" : "",
              active
                ? "bg-[var(--color-brand)] text-white"
                : "bg-white text-[color:var(--color-text)] hover:bg-[var(--color-surface-2)]",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{
              fontSize:
                opt.value === "1" ? "0.95rem" : opt.value === "1.25" ? "1.05rem" : "1.15rem",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
