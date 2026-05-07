"use client";

// CaregiverRedirectCard — panel destacado cuando la cascada decide derivar la
// llamada a un humano de confianza (Identity Verifier outcome="redirect_to_caregiver").
//
// Decisiones de UX:
//   - Borde brand grueso para diferenciarlo del veredicto principal sin alarmar.
//   - El teléfono SIEMPRE viaja enmascarado desde el server (PII discipline);
//     el cuidador encuentra el número completo en su agenda, no acá.
//   - blockquote para la razón: legibilidad alta y semántica accesible.

import type { CaregiverRedirect } from "../lib/api/audio-process.types";
import { UserIcon } from "./icons";

type Props = {
  redirect: CaregiverRedirect;
};

export function CaregiverRedirectCard({ redirect }: Props) {
  return (
    <section
      aria-labelledby="caregiver-redirect-heading"
      className="surface-card overflow-hidden flex flex-col"
      style={{
        borderColor: "var(--color-warning)",
        borderWidth: "2px",
      }}
    >
      <div
        className="verdict-stripe"
        style={{ background: "var(--color-warning)" }}
        aria-hidden="true"
      />
      <div className="p-5 sm:p-6 flex flex-col gap-4">
        <header className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex-shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-full"
            style={{
              background: "var(--color-warning)",
              color: "var(--color-warning-fg)",
            }}
          >
            <UserIcon className="w-6 h-6" />
          </span>
          <div className="flex flex-col gap-1 min-w-0">
            <h2
              id="caregiver-redirect-heading"
              className="font-display text-2xl font-bold leading-tight text-[color:var(--color-text)]"
            >
              Llamada derivada a un familiar de confianza
            </h2>
            <p className="text-base text-[color:var(--color-text-muted)] leading-relaxed">
              Vigía sugiere que <strong>{redirect.name} ({redirect.role})</strong>{" "}
              atienda esta llamada en lugar de la persona protegida.
            </p>
          </div>
        </header>

        <div className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
          <p className="text-sm font-semibold text-[color:var(--color-text-muted)] mb-1">
            Teléfono
          </p>
          <p
            className="font-mono text-base text-[color:var(--color-text)]"
            aria-label={`Teléfono enmascarado del familiar: ${redirect.phone_e164_masked}`}
          >
            {redirect.phone_e164_masked}
          </p>
        </div>

        <blockquote
          className="border-l-4 pl-4 py-2 italic leading-relaxed text-[color:var(--color-text)]"
          style={{ borderColor: "var(--color-warning)" }}
        >
          {redirect.reason_es}
        </blockquote>

        <p className="text-xs text-[color:var(--color-text-subtle)] leading-relaxed">
          El número está enmascarado por seguridad. Encuentras el número
          completo en tu agenda.
        </p>
      </div>
    </section>
  );
}
