import { UploadForm } from "../components/UploadForm";
import { PoweredByClaudeBadge } from "../components/PoweredByClaudeBadge";
import { FontSizeToggle } from "../components/FontSizeToggle";
import { ShieldCheckIcon } from "../components/icons";

// Landing — single page demo público.
// Estructura: header (branding + toggle texto + claim) → main (hero + form
// + cómo funciona) → footer.
// El UploadForm y FontSizeToggle son Client Components; el resto es
// Server Component por default.

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[color:var(--color-bg)]">
      {/* ================== HEADER ================== */}
      <header
        className="border-b border-[var(--color-border)] bg-white"
        role="banner"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-[color:var(--color-brand)] text-white"
            >
              <ShieldCheckIcon className="w-7 h-7" />
            </span>
            <div>
              <p className="font-display text-2xl font-bold text-[color:var(--color-text)] leading-tight">
                Vigía
              </p>
              <p className="text-sm text-[color:var(--color-text-subtle)]">
                Detector de estafas telefónicas
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <FontSizeToggle />
            <PoweredByClaudeBadge size="sm" />
          </div>
        </div>
      </header>

      {/* ================== MAIN ================== */}
      <main
        id="contenido-principal"
        className="flex-1 mx-auto max-w-3xl w-full px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-10"
      >
        {/* Hero */}
        <section
          aria-labelledby="hero-heading"
          className="flex flex-col gap-5"
        >
          <h1
            id="hero-heading"
            className="font-display text-[2.25rem] sm:text-[2.75rem] font-bold text-[color:var(--color-text)] leading-tight"
          >
            ¿Recibiste una llamada que te dejó dudando?
          </h1>
          <p className="text-lg text-[color:var(--color-text-muted)] leading-relaxed">
            Sube la grabación y Vigía la analiza en menos de 30 segundos. Te
            decimos si la llamada es real o si es un intento de estafa, y te
            explicamos con palabras simples qué señales encontramos.
          </p>
          <ul className="flex flex-col gap-2 text-base text-[color:var(--color-text)]">
            <li className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-1 inline-block w-2.5 h-2.5 rounded-full bg-[color:var(--color-safe)] flex-shrink-0"
              />
              <span>
                <strong>Es gratis</strong> y no necesitas crear una cuenta.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-1 inline-block w-2.5 h-2.5 rounded-full bg-[color:var(--color-safe)] flex-shrink-0"
              />
              <span>
                <strong>No guardamos el audio</strong>: se analiza y se descarta
                de inmediato.
              </span>
            </li>
            <li className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="mt-1 inline-block w-2.5 h-2.5 rounded-full bg-[color:var(--color-safe)] flex-shrink-0"
              />
              <span>
                <strong>Ocultamos los datos sensibles</strong> (RUT, números de
                cuenta, teléfonos) antes de mostrarte la transcripción.
              </span>
            </li>
          </ul>
        </section>

        {/* Form */}
        <UploadForm />

        {/* Cómo funciona */}
        <section
          aria-labelledby="how-heading"
          className="surface-card p-6 sm:p-8"
        >
          <h2
            id="how-heading"
            className="text-xl font-semibold text-[color:var(--color-text)] mb-4"
          >
            Cómo funciona
          </h2>
          <ol className="flex flex-col gap-4 text-[color:var(--color-text)]">
            <li className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-[color:var(--color-brand)] text-white font-bold"
              >
                1
              </span>
              <span className="leading-relaxed pt-1">
                <strong>Subes el audio</strong> de la llamada que recibió la
                persona protegida.
              </span>
            </li>
            <li className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-[color:var(--color-brand)] text-white font-bold"
              >
                2
              </span>
              <span className="leading-relaxed pt-1">
                <strong>Vigía transcribe</strong> el audio y oculta automáticamente
                los datos sensibles.
              </span>
            </li>
            <li className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-[color:var(--color-brand)] text-white font-bold"
              >
                3
              </span>
              <span className="leading-relaxed pt-1">
                <strong>Claude analiza la conversación</strong> con un protocolo
                defensivo y decide si es legítima, sospechosa o estafa.
              </span>
            </li>
            <li className="flex gap-4">
              <span
                aria-hidden="true"
                className="flex-shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-full bg-[color:var(--color-brand)] text-white font-bold"
              >
                4
              </span>
              <span className="leading-relaxed pt-1">
                <strong>Te mostramos el veredicto</strong> con la explicación de
                las señales detectadas y citas a la ley chilena.
              </span>
            </li>
          </ol>
        </section>
      </main>

      {/* ================== FOOTER ================== */}
      <footer
        className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)] mt-8"
        role="contentinfo"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 flex flex-col gap-2 text-sm text-[color:var(--color-text-muted)]">
          <p className="leading-relaxed">
            Vigía es una herramienta cívica construida para acompañar a las
            personas mayores de Chile frente a estafas telefónicas.
          </p>
          <p className="text-xs text-[color:var(--color-text-subtle)]">
            Inspirado en alertas de Sernac, CSIRT Nacional y PDI Cibercrimen ·
            Construido en el Claude Impact Lab Chile 2026.
          </p>
        </div>
      </footer>
    </div>
  );
}
