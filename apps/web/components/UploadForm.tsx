"use client";

// UploadForm — el corazón de la PWA: drag-drop + checkbox consentimiento +
// fields opcionales + submit a /api/audio/process.
//
// Validación client-side (pre-flight, no reemplaza la del servidor):
//   - Tamaño: AUDIO_PROCESS_LIMITS.maxFileBytes
//   - MIME: AUDIO_PROCESS_LIMITS.acceptedMimeTypes
//   - Consent obligatorio
//   - caller_id si está presente, debe matchear E.164 chileno
//
// Mock toggle: cuando NEXT_PUBLIC_MOCK_AUDIO_PROCESS === "1" usamos
// mockAudioProcessResponse() en lugar del fetch real. Esto se quita borrando
// las dos ramas marcadas con `// MOCK:` cuando el endpoint esté listo.

import { useCallback, useId, useRef, useState } from "react";
import type {
  AudioProcessError,
  AudioProcessResponse,
  AudioProcessSuccess,
} from "../lib/api/audio-process.types";
import {
  AUDIO_PROCESS_LIMITS,
  ERROR_MESSAGES_ES,
} from "../lib/api/audio-process.types";
import { LoadingState } from "./LoadingState";
import { VerdictPanel } from "./VerdictPanel";
import { ErrorState } from "./ErrorState";
// MOCK: import del mock — se borra cuando el endpoint real esté en main.
import {
  mockAudioProcessResponse,
  type MockScenario,
} from "../lib/api/audio-process.mock";

type FormStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; result: AudioProcessSuccess }
  | { kind: "error"; error: AudioProcessError };

// Acepta E.164 internacional con foco chileno; permite rangos generales por
// si el cuidador anota un fijo o número extranjero.
const E164_RE = /^\+[1-9]\d{6,14}$/;

const ACCEPT_ATTR = AUDIO_PROCESS_LIMITS.acceptedMimeTypes.join(",");

/** Mensaje de error client-side antes de hacer el POST. */
type ClientPreflightError =
  | "NO_FILE"
  | "INVALID_MIME"
  | "FILE_TOO_LARGE"
  | "CONSENT_MISSING"
  | "INVALID_CALLER_ID";

function preflightValidate(args: {
  file: File | null;
  consent: boolean;
  callerId: string;
}): ClientPreflightError | null {
  if (!args.file) return "NO_FILE";
  if (
    !(AUDIO_PROCESS_LIMITS.acceptedMimeTypes as readonly string[]).includes(
      args.file.type,
    )
  ) {
    return "INVALID_MIME";
  }
  if (args.file.size > AUDIO_PROCESS_LIMITS.maxFileBytes) {
    return "FILE_TOO_LARGE";
  }
  if (!args.consent) return "CONSENT_MISSING";
  if (args.callerId.trim().length > 0 && !E164_RE.test(args.callerId.trim())) {
    return "INVALID_CALLER_ID";
  }
  return null;
}

export function UploadForm() {
  const formId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [consent, setConsent] = useState(false);
  const [callerId, setCallerId] = useState("");
  const [protectedName, setProtectedName] = useState("");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });
  const [clientError, setClientError] = useState<ClientPreflightError | null>(
    null,
  );

  // MOCK: lectura del flag a nivel render — se borra junto al import.
  const useMock = process.env.NEXT_PUBLIC_MOCK_AUDIO_PROCESS === "1";

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = files[0];
    setFile(next);
    setClientError(null);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const onDragOver = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setConsent(false);
    setCallerId("");
    setProtectedName("");
    setStatus({ kind: "idle" });
    setClientError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const preflight = preflightValidate({ file, consent, callerId });
      if (preflight) {
        setClientError(preflight);
        return;
      }
      setClientError(null);
      setStatus({ kind: "submitting" });

      // MOCK: rama de desarrollo cuando NEXT_PUBLIC_MOCK_AUDIO_PROCESS=1.
      // Borrar este bloque entero cuando el endpoint real esté listo.
      if (useMock) {
        const scenario = inferScenarioFromName(file?.name ?? "");
        await new Promise((r) => setTimeout(r, 9000));
        const result = mockAudioProcessResponse(scenario);
        setStatus({ kind: "success", result });
        return;
      }

      try {
        const formData = new FormData();
        formData.append("file", file as File);
        formData.append("consent_checked", "true");
        if (callerId.trim()) formData.append("caller_id", callerId.trim());
        if (protectedName.trim()) {
          formData.append("protected_name", protectedName.trim());
        }

        const res = await fetch("/api/audio/process", {
          method: "POST",
          body: formData,
        });

        // El endpoint puede responder JSON tanto en éxito como error;
        // toleramos cualquier status code y miramos el shape.
        const json = (await res.json()) as AudioProcessResponse;

        if (json.ok) {
          setStatus({ kind: "success", result: json });
        } else {
          setStatus({ kind: "error", error: json });
        }
      } catch {
        setStatus({
          kind: "error",
          error: {
            ok: false,
            error: ERROR_MESSAGES_ES.INTERNAL_ERROR,
            code: "INTERNAL_ERROR",
          },
        });
      }
    },
    [file, consent, callerId, protectedName, useMock],
  );

  // ============================================================
  // Render por estado
  // ============================================================

  if (status.kind === "submitting") {
    return <LoadingState />;
  }

  if (status.kind === "success") {
    return <VerdictPanel result={status.result} onReset={reset} />;
  }

  if (status.kind === "error") {
    return <ErrorState error={status.error} onRetry={reset} />;
  }

  // idle
  return (
    <form
      id={formId}
      onSubmit={onSubmit}
      noValidate
      className="surface-card p-6 sm:p-8 flex flex-col gap-6"
      aria-labelledby="upload-heading"
    >
      <div className="flex flex-col gap-2">
        <h2
          id="upload-heading"
          className="text-2xl font-semibold text-[color:var(--color-text)]"
        >
          Subí el audio sospechoso
        </h2>
        <p className="text-base text-[color:var(--color-text-muted)]">
          Vigía analiza la grabación y te dice si la llamada es legítima o si es
          una estafa. Aceptamos archivos MP3, M4A, WAV o WebM, hasta 10 MB.
        </p>
      </div>

      {/* ================== Zona drag-and-drop + file input ================== */}
      <fieldset className="border-0 p-0 m-0">
        <legend className="label-strong">Archivo de audio</legend>

        <label
          htmlFor={`${formId}-file`}
          className="dropzone"
          data-active={dragActive ? "true" : "false"}
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <span className="text-3xl" aria-hidden="true">
            🎙️
          </span>
          {file ? (
            <span className="text-[color:var(--color-text)] font-semibold">
              {file.name}{" "}
              <span className="font-normal text-[color:var(--color-text-subtle)]">
                ({formatBytes(file.size)})
              </span>
            </span>
          ) : (
            <>
              <span className="text-[color:var(--color-text)] font-semibold">
                Arrastrá el audio acá
              </span>
              <span className="text-base text-[color:var(--color-text-muted)]">
                o tocá para elegirlo desde tu teléfono o computador
              </span>
            </>
          )}
          <input
            ref={fileInputRef}
            id={`${formId}-file`}
            type="file"
            accept={ACCEPT_ATTR}
            className="sr-only"
            onChange={(e) => handleFiles(e.target.files)}
            aria-describedby={`${formId}-file-help`}
            required
          />
        </label>
        <p
          id={`${formId}-file-help`}
          className="mt-2 text-sm text-[color:var(--color-text-subtle)]"
        >
          Máximo 10 MB. Los formatos compatibles son MP3, M4A, WAV y WebM.
        </p>
      </fieldset>

      {/* ================== Consentimiento (obligatorio) ================== */}
      <fieldset className="border-2 border-[var(--color-border)] rounded-md p-4">
        <legend className="px-2 font-semibold text-[color:var(--color-text)]">
          Consentimiento legal
        </legend>
        <label
          htmlFor={`${formId}-consent`}
          className="flex items-start gap-3 cursor-pointer text-[color:var(--color-text)]"
        >
          <input
            id={`${formId}-consent`}
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-1.5 w-6 h-6 flex-shrink-0 cursor-pointer"
            aria-required="true"
            aria-describedby={`${formId}-consent-detail`}
            required
          />
          <span className="leading-relaxed">
            Confirmo que el llamante fue notificado de esta grabación, o que
            la grabación se obtuvo bajo la regla de "consentimiento de una sola
            parte" (one-party-consent), permitida por la legislación chilena.
          </span>
        </label>
        <p
          id={`${formId}-consent-detail`}
          className="mt-3 text-sm text-[color:var(--color-text-subtle)] pl-9"
        >
          Sin esta confirmación no podemos analizar el audio. Vigía no guarda
          el archivo: se procesa y se descarta.
        </p>
      </fieldset>

      {/* ================== Campos opcionales ================== */}
      <fieldset className="flex flex-col gap-4 border-0 p-0 m-0">
        <legend className="label-strong">
          Datos opcionales (mejoran el análisis)
        </legend>

        <div>
          <label htmlFor={`${formId}-caller`} className="label-strong">
            Número del llamante
          </label>
          <input
            id={`${formId}-caller`}
            type="tel"
            inputMode="tel"
            placeholder="+56912345678"
            value={callerId}
            onChange={(e) => setCallerId(e.target.value)}
            autoComplete="tel"
            className="w-full px-3 py-3 rounded-md border-2 border-[var(--color-border)] bg-white text-[color:var(--color-text)] text-base focus:border-[color:var(--color-brand)]"
            aria-describedby={`${formId}-caller-help`}
          />
          <p
            id={`${formId}-caller-help`}
            className="mt-1 text-sm text-[color:var(--color-text-subtle)]"
          >
            Formato internacional con el signo + (ejemplo:
            <span className="font-mono"> +56912345678</span>). Si no lo sabés,
            dejalo vacío.
          </p>
        </div>

        <div>
          <label htmlFor={`${formId}-name`} className="label-strong">
            Primer nombre de la persona protegida
          </label>
          <input
            id={`${formId}-name`}
            type="text"
            placeholder="María"
            value={protectedName}
            onChange={(e) => setProtectedName(e.target.value)}
            autoComplete="given-name"
            maxLength={40}
            className="w-full px-3 py-3 rounded-md border-2 border-[var(--color-border)] bg-white text-[color:var(--color-text)] text-base focus:border-[color:var(--color-brand)]"
            aria-describedby={`${formId}-name-help`}
          />
          <p
            id={`${formId}-name-help`}
            className="mt-1 text-sm text-[color:var(--color-text-subtle)]"
          >
            Solo el primer nombre, nunca apellido ni dirección. Si lo dejás
            vacío, usamos "el adulto mayor".
          </p>
        </div>
      </fieldset>

      {/* ================== Errores client-side ================== */}
      {clientError ? (
        <p
          role="alert"
          className="rounded-md border-l-4 border-[color:var(--color-danger)] bg-[var(--color-danger-bg)] px-4 py-3 text-[color:var(--color-danger)] font-semibold"
        >
          {ERROR_MESSAGES_ES[clientError]}
        </p>
      ) : null}

      {/* ================== Submit ================== */}
      <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
        <button
          type="submit"
          className="btn-primary"
          aria-label="Enviar el audio para que Vigía lo analice"
        >
          Analizar audio con Vigía
        </button>
      </div>

      {useMock ? (
        <p
          className="text-xs text-[color:var(--color-text-subtle)] font-mono"
          aria-live="polite"
        >
          modo desarrollo: respuesta simulada (NEXT_PUBLIC_MOCK_AUDIO_PROCESS=1)
        </p>
      ) : null}
    </form>
  );
}

// ============================================================
// Helpers
// ============================================================

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Mock-only: deduce el escenario desde el nombre del archivo para que la demo
 * pueda mostrar 4 veredictos distintos sin tocar UI. Borrar junto al mock.
 */
function inferScenarioFromName(name: string): MockScenario {
  const n = name.toLowerCase();
  if (n.includes("oracle") || n.includes("palabra")) return "oracle";
  if (n.includes("banco") || n.includes("bank")) return "bank";
  if (n.includes("familia") || n.includes("nieta") || n.includes("nieto"))
    return "family";
  return "scam";
}
