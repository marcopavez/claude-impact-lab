"use client";

// CounterScriptCard — frase defensiva que el cuidador puede DECIR si el mismo
// número vuelve a llamar. La genera el Caregiver Notifier solo cuando severity
// >= MEDIUM (LOW devuelve string vacío, y aquí no renderizamos nada).
//
// Decisiones de UX:
//   - Cita destacada (blockquote, italica, font grande) para que sea fácil de
//     leer en voz alta directamente desde la pantalla.
//   - Pie con justificación corta: por qué decir esa frase ayuda.

import { MegaphoneIcon } from "./icons";

type Props = {
  counterScript: string;
};

export function CounterScriptCard({ counterScript }: Props) {
  if (counterScript === "") return null;

  return (
    <section
      aria-labelledby="counter-script-heading"
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 flex flex-col gap-3"
    >
      <header className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex-shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full"
          style={{
            background: "var(--color-brand)",
            color: "var(--color-brand-fg)",
          }}
        >
          <MegaphoneIcon className="w-5 h-5" />
        </span>
        <h3
          id="counter-script-heading"
          className="text-lg font-bold text-[color:var(--color-text)]"
        >
          Si vuelven a llamar
        </h3>
      </header>

      <blockquote
        className="border-l-4 pl-4 py-2 italic text-xl leading-relaxed text-[color:var(--color-text)]"
        style={{ borderColor: "var(--color-brand)" }}
        lang="es-CL"
      >
        {counterScript}
      </blockquote>

      <p className="text-sm text-[color:var(--color-text-muted)] leading-relaxed">
        Di esta frase en voz firme. Los estafadores cuelgan ante referencias a
        Sernac o PDI.
      </p>
    </section>
  );
}
