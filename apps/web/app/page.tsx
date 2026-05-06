import { UploadForm } from "../components/UploadForm";
import { PoweredByClaudeBadge } from "../components/PoweredByClaudeBadge";

// Landing — single page demo público.
// Estructura: header (branding + claim) → main (upload form en el centro) → footer.
// El UploadForm es Client Component; el resto es Server Component por default.

export default function Page() {
  return (
    <div className="min-h-screen flex flex-col bg-[color:var(--color-bg)]">
      {/* ================== HEADER ================== */}
      <header
        className="border-b border-[var(--color-border)] bg-white"
        role="banner"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[color:var(--color-brand)] text-white font-bold text-xl"
            >
              V
            </span>
            <div>
              <p className="text-xl font-bold text-[color:var(--color-text)] leading-tight">
                Vigía
              </p>
              <p className="text-sm text-[color:var(--color-text-subtle)]">
                Detector de estafas telefónicas
              </p>
            </div>
          </div>
          <PoweredByClaudeBadge size="sm" />
        </div>
      </header>

      {/* ================== MAIN ================== */}
      <main
        id="contenido-principal"
        className="flex-1 mx-auto max-w-3xl w-full px-4 sm:px-6 py-8 sm:py-12 flex flex-col gap-8"
      >
        {/* Hero */}
        <section
          aria-labelledby="hero-heading"
          className="flex flex-col gap-4"
        >
          <h1
            id="hero-heading"
            className="text-3xl sm:text-4xl font-bold text-[color:var(--color-text)] leading-tight"
          >
            Subí el audio sospechoso. Te decimos si es estafa.
          </h1>
          <p className="text-lg text-[color:var(--color-text-muted)] leading-relaxed">
            Vigía escucha la grabación de la llamada, busca señales del cuento
            del tío y de suplantación de bancos, y te entrega un veredicto en
            menos de 30 segundos. Pensado para cuidadores de adultos mayores en
            Chile.
          </p>
          <ul className="text-base text-[color:var(--color-text)] flex flex-col gap-1 list-disc pl-6">
            <li>No guardamos el audio. Se analiza y se descarta.</li>
            <li>
              Ocultamos automáticamente RUT, números de cuenta y otros datos
              sensibles.
            </li>
            <li>El veredicto incluye una explicación corta y clara.</li>
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
          <ol className="flex flex-col gap-3 list-decimal pl-6 text-[color:var(--color-text)]">
            <li>
              <strong>Subís el audio</strong> de la llamada que recibió la
              persona protegida.
            </li>
            <li>
              <strong>Vigía transcribe</strong> el audio con un servicio de voz
              a texto.
            </li>
            <li>
              <strong>Claude analiza la transcripción</strong> con un protocolo
              defensivo y decide si es legítimo, sospechoso o estafa.
            </li>
            <li>
              <strong>Te mostramos el veredicto</strong> con la explicación de
              las señales detectadas.
            </li>
          </ol>
        </section>
      </main>

      {/* ================== FOOTER ================== */}
      <footer
        className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]"
        role="contentinfo"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 py-6 flex flex-col sm:flex-row sm:justify-between gap-3 text-sm text-[color:var(--color-text-muted)]">
          <p>
            Línea 02 · Ciberseguridad Ciudadana · Claude Impact Lab Chile 2026
          </p>
          <p>MVP audio-first · 6 mayo 2026</p>
        </div>
      </footer>
    </div>
  );
}
