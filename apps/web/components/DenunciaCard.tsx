"use client";

// DenunciaCard — panel para que el cuidador denuncie en pocos clicks.
//
// Decisiones de UX:
//   - El texto de denuncia se muestra colapsado por default (<details>) para
//     no abrumar al cuidador con un párrafo largo antes de la acción.
//   - Botón principal "Copiar texto" con feedback de 2s — patrón conocido y
//     cero fricción.
//   - Links a portales oficiales como botones secundarios; cada uno abre en
//     pestaña nueva con rel="noopener noreferrer" para no exponer la sesión.
//   - Pie con la ley principal citada + link a BCN para que el cuidador
//     pueda verificar el sustento legal de la denuncia.
//
// Texto de denuncia: lo prepara el orquestador deterministamente (sin LLM
// extra), por lo que ya viene en lenguaje 65+ y sin jerga.

import { useCallback, useEffect, useRef, useState } from "react";
import type { DenunciaPayload } from "../lib/api/audio-process.types";
import { ClipboardIcon } from "./icons";

type Props = {
  denuncia: DenunciaPayload;
};

export function DenunciaCard({ denuncia }: Props) {
  const [copied, setCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleCopy = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(denuncia.texto_denuncia);
      setCopied(true);
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setCopied(false);
        timeoutRef.current = null;
      }, 2000);
    } catch {
      // Fallback silencioso: si el navegador rechaza clipboard, el cuidador
      // todavía puede seleccionar el texto manualmente desde el <details>.
      setCopied(false);
    }
  }, [denuncia.texto_denuncia]);

  return (
    <section
      aria-labelledby="denuncia-heading"
      className="surface-card overflow-hidden flex flex-col"
      style={{
        borderColor: "var(--color-brand)",
        borderWidth: "2px",
      }}
    >
      <div
        className="verdict-stripe"
        style={{ background: "var(--color-brand)" }}
        aria-hidden="true"
      />
      <div className="p-5 sm:p-6 flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2
            id="denuncia-heading"
            className="font-display text-2xl font-bold leading-tight text-[color:var(--color-text)]"
          >
            Plan de denuncia listo
          </h2>
          <p className="text-base text-[color:var(--color-text-muted)] leading-relaxed">
            Vigía preparó un texto que puedes copiar y pegar en el portal
            oficial.
          </p>
        </header>

        <details className="rounded border border-[var(--color-border)] bg-[var(--color-surface-2)]">
          <summary className="cursor-pointer p-3 font-semibold text-[color:var(--color-text)]">
            Ver texto de denuncia
          </summary>
          <pre
            className="m-0 p-3 pt-0 text-sm text-[color:var(--color-text)] whitespace-pre-wrap font-sans leading-relaxed"
            lang="es-CL"
          >
            {denuncia.texto_denuncia}
          </pre>
        </details>

        <div className="flex flex-row flex-wrap gap-3">
          <button
            type="button"
            onClick={handleCopy}
            className="btn-primary"
            aria-label="Copiar el texto de denuncia al portapapeles"
          >
            <ClipboardIcon className="w-5 h-5" />
            <span>{copied ? "Copiado" : "Copiar texto"}</span>
          </button>
          {denuncia.links_denuncia.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
            >
              <span>{link.label}</span>
            </a>
          ))}
        </div>

        <p className="text-xs text-[color:var(--color-text-subtle)] leading-relaxed">
          Cita usada: Ley {denuncia.ley_principal.numero} —{" "}
          <a
            href={denuncia.ley_principal.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-[color:var(--color-brand)] break-all"
          >
            {denuncia.ley_principal.nombre_corto}
          </a>
        </p>
      </div>
    </section>
  );
}
