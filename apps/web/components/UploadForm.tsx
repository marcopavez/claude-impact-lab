"use client";

// UploadForm — el corazón de la PWA: drag-drop + grabación en vivo con
// micrófono + reproductor de pre-validación + checkbox consentimiento +
// fields opcionales + submit a /api/audio/process.
//
// Validación client-side (pre-flight, no reemplaza la del servidor):
//   - Tamaño: AUDIO_PROCESS_LIMITS.maxFileBytes
//   - MIME: AUDIO_PROCESS_LIMITS.acceptedMimeTypes
//   - Consent obligatorio
//   - caller_id si está presente, debe matchear E.164 chileno
//
// Grabación con micrófono: usa getUserMedia + MediaRecorder. La grabación
// queda como `File` con MIME audio/webm (Chrome/Edge/Firefox) o audio/mp4
// (Safari) y se enchufa al mismo flujo que la subida — el endpoint acepta
// ambos. Auto-stop a los 90s para no exceder la latencia objetivo (J3.3).
//
// Mock toggle: cuando NEXT_PUBLIC_MOCK_AUDIO_PROCESS === "1" usamos
// mockAudioProcessResponse() en lugar del fetch real. Esto se quita
// borrando las dos ramas marcadas con `// MOCK:` cuando el endpoint
// esté listo.

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import type {
  AudioProcessError,
  AudioProcessResponse,
  AudioProcessSuccess,
  NotificationGenerateResponse,
} from "../lib/api/audio-process.types";
import {
  AUDIO_PROCESS_LIMITS,
  ERROR_MESSAGES_ES,
} from "../lib/api/audio-process.types";
import {
  SAMPLE_AUDIOS,
  SAMPLE_OUTCOME_LABEL_ES,
  sampleAudioUrl,
  type SampleAudio,
} from "../data/sample-audios";
import { LoadingState } from "./LoadingState";
import { VerdictPanel } from "./VerdictPanel";
import { ErrorState } from "./ErrorState";
import { MicIcon, CloseIcon, SparkleIcon } from "./icons";
// MOCK: import del mock — se borra cuando el endpoint real esté en main.
import {
  mockAudioProcessResponse,
  type MockScenario,
} from "../lib/api/audio-process.mock";

type FormStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | {
      kind: "success";
      result: AudioProcessSuccess;
      /**
       * Two-phase: cuando el primer response no trae caregiver_message (no fue
       * early-exit), esperamos el segundo endpoint /api/notification/generate.
       * El VerdictPanel renderiza el verdict y muestra spinner en el slot de
       * "plan accionable" hasta que la segunda llamada complete.
       */
      caregiverPending: boolean;
    }
  | { kind: "error"; error: AudioProcessError };

type RecordingState =
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "recording"; startedAt: number; durationMs: number };

// Acepta E.164 internacional con foco chileno; permite rangos generales por
// si el cuidador anota un fijo o número extranjero.
const E164_RE = /^\+[1-9]\d{6,14}$/;

/** Cap defensivo: la cascada apunta a <30s E2E; 90s de audio + Scribe ya estresa J3.3. */
const MAX_RECORDING_MS = 90_000;

/** Candidatos por preferencia. Chrome/Edge/Firefox → webm; Safari → mp4. */
const MIC_MIME_CANDIDATES = [
  "audio/webm",
  "audio/mp4",
  "audio/ogg",
] as const;

function pickSupportedMicMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const m of MIC_MIME_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(m)) return m;
    } catch {
      // Ignorar: navegadores antiguos pueden lanzar al consultar tipos.
    }
  }
  return null;
}

function extensionForMime(mime: string): string {
  if (mime.startsWith("audio/mp4")) return "m4a";
  if (mime.startsWith("audio/ogg")) return "ogg";
  if (mime.startsWith("audio/wav") || mime.startsWith("audio/x-wav")) return "wav";
  return "webm";
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

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

  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [callerId, setCallerId] = useState("");
  const [protectedName, setProtectedName] = useState("");
  const [status, setStatus] = useState<FormStatus>({ kind: "idle" });
  const [clientError, setClientError] = useState<ClientPreflightError | null>(
    null,
  );

  // Grabación con micrófono — mantenemos refs para los recursos imperativos
  // (MediaRecorder, MediaStream, timers) y estado React para la UI.
  const [recordingState, setRecordingState] = useState<RecordingState>({
    kind: "idle",
  });
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const autoStopTimerRef = useRef<number | null>(null);

  // Cargando un sample: id en curso para mostrar spinner solo en ese botón.
  // null cuando no hay carga activa.
  const [loadingSampleId, setLoadingSampleId] = useState<string | null>(null);
  const [sampleError, setSampleError] = useState<string | null>(null);

  // MOCK: lectura del flag a nivel render — se borra junto al import.
  const useMock = process.env.NEXT_PUBLIC_MOCK_AUDIO_PROCESS === "1";

  // Object URL del audio para el reproductor de pre-validación.
  // useMemo + cleanup para evitar memory leaks al cambiar de archivo.
  const audioUrl = useMemo(() => {
    if (!file) return null;
    return URL.createObjectURL(file);
  }, [file]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const reset = useCallback(() => {
    setFile(null);
    setConsent(false);
    setCallerId("");
    setProtectedName("");
    setStatus({ kind: "idle" });
    setClientError(null);
  }, []);

  const clearFile = useCallback(() => {
    setFile(null);
    setClientError(null);
  }, []);

  // Libera tracks del mic + timers. Idempotente: la llamamos en stop, en
  // error y en unmount.
  const releaseMicResources = useCallback(() => {
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        try {
          track.stop();
        } catch {
          // Ignorar: la pista puede ya estar detenida.
        }
      }
      mediaStreamRef.current = null;
    }
    if (recordingTimerRef.current !== null) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (autoStopTimerRef.current !== null) {
      window.clearTimeout(autoStopTimerRef.current);
      autoStopTimerRef.current = null;
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setRecordingError(
        "Tu navegador no permite grabar audio. Prueba subiendo un archivo.",
      );
      return;
    }
    if (typeof MediaRecorder === "undefined") {
      setRecordingError(
        "Tu navegador no soporta grabación de audio. Prueba subiendo un archivo.",
      );
      return;
    }

    setRecordingError(null);
    setClientError(null);
    setRecordingState({ kind: "requesting" });

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      setRecordingState({ kind: "idle" });
      if (err instanceof DOMException) {
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError" ||
          err.name === "SecurityError"
        ) {
          setRecordingError(
            "Diste “no” al permiso del micrófono. Habilítalo desde la barra del navegador y vuelve a intentarlo.",
          );
          return;
        }
        if (
          err.name === "NotFoundError" ||
          err.name === "DevicesNotFoundError"
        ) {
          setRecordingError("No detectamos un micrófono en este dispositivo.");
          return;
        }
      }
      setRecordingError(
        "No pudimos acceder al micrófono. Sube un archivo en su lugar.",
      );
      return;
    }

    mediaStreamRef.current = stream;
    recordedChunksRef.current = [];

    const preferredMime = pickSupportedMicMime();
    let recorder: MediaRecorder;
    try {
      recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);
    } catch {
      releaseMicResources();
      setRecordingState({ kind: "idle" });
      setRecordingError(
        "Tu navegador no pudo iniciar la grabación. Prueba subiendo un archivo.",
      );
      return;
    }
    mediaRecorderRef.current = recorder;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    });

    recorder.addEventListener("stop", () => {
      const reportedMime =
        recorder.mimeType || preferredMime || "audio/webm";
      // Algunos navegadores reportan "audio/webm;codecs=opus" — cortamos en ;.
      const baseMime = reportedMime.split(";")[0]?.trim() || "audio/webm";
      const mimeForFile = (
        AUDIO_PROCESS_LIMITS.acceptedMimeTypes as readonly string[]
      ).includes(baseMime)
        ? baseMime
        : "audio/webm";
      const blob = new Blob(recordedChunksRef.current, { type: mimeForFile });
      recordedChunksRef.current = [];

      releaseMicResources();
      setRecordingState({ kind: "idle" });

      if (blob.size === 0) {
        setRecordingError(
          "No se grabó audio. Acerca el micrófono y vuelve a intentarlo.",
        );
        return;
      }
      if (blob.size > AUDIO_PROCESS_LIMITS.maxFileBytes) {
        setRecordingError(
          "La grabación supera los 10 MB. Intenta una grabación más corta.",
        );
        return;
      }

      const ts = new Date()
        .toISOString()
        .replace(/[:]/g, "-")
        .replace(/\..+$/, "")
        .replace(/T/, "_");
      const recordedFile = new File(
        [blob],
        `grabacion-vigia-${ts}.${extensionForMime(mimeForFile)}`,
        { type: mimeForFile },
      );

      setFile(recordedFile);
      setClientError(null);
    });

    recorder.addEventListener("error", () => {
      releaseMicResources();
      setRecordingState({ kind: "idle" });
      setRecordingError(
        "La grabación falló a mitad de camino. Reintenta o sube un archivo.",
      );
    });

    try {
      recorder.start();
    } catch {
      releaseMicResources();
      setRecordingState({ kind: "idle" });
      setRecordingError(
        "No pudimos iniciar la grabación. Reintenta o sube un archivo.",
      );
      return;
    }

    const startedAt = Date.now();
    setRecordingState({ kind: "recording", startedAt, durationMs: 0 });

    recordingTimerRef.current = window.setInterval(() => {
      setRecordingState((prev) =>
        prev.kind === "recording"
          ? { ...prev, durationMs: Date.now() - prev.startedAt }
          : prev,
      );
    }, 250);

    autoStopTimerRef.current = window.setTimeout(() => {
      const r = mediaRecorderRef.current;
      if (r && r.state === "recording") {
        try {
          r.stop();
        } catch {
          // El handler de stop ya hace cleanup.
        }
      }
    }, MAX_RECORDING_MS);
  }, [releaseMicResources]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      try {
        recorder.stop();
      } catch {
        releaseMicResources();
        setRecordingState({ kind: "idle" });
      }
    }
  }, [releaseMicResources]);

  // Carga un audio de muestra desde public/demo-audios/<id>.mp3 y lo deja
  // en el state como si el cuidador lo hubiera subido. Acelera el demo en
  // vivo y educa al usuario que no tiene audio propio. Autollena el caller_id
  // sugerido para que el sample dispare el camino canónico del firewall.
  const loadSample = useCallback(async (sample: SampleAudio) => {
    if (loadingSampleId !== null) return;
    setSampleError(null);
    setRecordingError(null);
    setClientError(null);
    setLoadingSampleId(sample.id);
    try {
      const res = await fetch(sampleAudioUrl(sample.id));
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const blob = await res.blob();
      if (blob.size === 0) {
        throw new Error("Archivo vacío");
      }
      const sampleFile = new File([blob], `${sample.id}.mp3`, {
        type: sample.mime,
      });
      setFile(sampleFile);
      setCallerId(sample.suggested_caller_id);
    } catch (err) {
      setSampleError(
        err instanceof Error
          ? `No pudimos cargar el audio de muestra: ${err.message}.`
          : "No pudimos cargar el audio de muestra.",
      );
    } finally {
      setLoadingSampleId(null);
    }
  }, [loadingSampleId]);

  // Cleanup al desmontar: detener recorder + liberar tracks + cancelar timers.
  useEffect(() => {
    return () => {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        try {
          recorder.stop();
        } catch {
          // Ignorar.
        }
      }
      releaseMicResources();
    };
  }, [releaseMicResources]);

  const isRecording = recordingState.kind === "recording";
  const isRequestingMic = recordingState.kind === "requesting";
  const recordingDurationMs =
    recordingState.kind === "recording" ? recordingState.durationMs : 0;

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
        // El mock ya trae caregiver_message lleno → no hay segundo fetch pendiente.
        setStatus({ kind: "success", result, caregiverPending: false });
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

        const json = (await res.json()) as AudioProcessResponse;

        if (!json.ok) {
          setStatus({ kind: "error", error: json });
          return;
        }

        // Two-phase: si el primer response YA trae caregiver_message (early-exit
        // del firewall, donde el plan es determinístico), no disparamos segundo
        // fetch. En el caso normal de cascada Claude, mostramos el verdict
        // inmediatamente y disparamos /api/notification/generate en background.
        const needsSecondPhase = !json.caregiver_message;
        setStatus({
          kind: "success",
          result: json,
          caregiverPending: needsSecondPhase,
        });

        if (needsSecondPhase) {
          void (async () => {
            try {
              const notifRes = await fetch("/api/notification/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  audio_id: json.audio_id,
                  protected_name:
                    protectedName.trim() ||
                    AUDIO_PROCESS_LIMITS.defaultProtectedName,
                  triage_decision: json.decision,
                  identity_decision: json.identity_check,
                  vishing_decision: json.vishing_analysis,
                  regulatory_decision: json.regulatory,
                }),
              });
              const notifJson =
                (await notifRes.json()) as NotificationGenerateResponse;

              setStatus((prev) => {
                if (prev.kind !== "success") return prev;
                if (!notifJson.ok) {
                  // Falla del segundo phase: el verdict ya está visible, así que
                  // dejamos pendingCaregiver=false sin caregiver_message. El VerdictPanel
                  // muestra fallback "plan accionable no disponible".
                  return { ...prev, caregiverPending: false };
                }
                return {
                  ...prev,
                  caregiverPending: false,
                  result: {
                    ...prev.result,
                    caregiver_message: notifJson.caregiver_message,
                    models_used: [
                      ...prev.result.models_used,
                      ...notifJson.models_used,
                    ],
                    tools_used: [
                      ...prev.result.tools_used,
                      ...notifJson.tools_used,
                    ],
                    cascade_statuses: {
                      ...prev.result.cascade_statuses,
                      notifier: notifJson.status,
                    },
                    latency_ms: {
                      ...prev.result.latency_ms,
                      notifier_ms: notifJson.latency_ms,
                    },
                  },
                };
              });
            } catch {
              setStatus((prev) =>
                prev.kind === "success"
                  ? { ...prev, caregiverPending: false }
                  : prev,
              );
            }
          })();
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
    return (
      <VerdictPanel
        result={status.result}
        onReset={reset}
        caregiverPending={status.caregiverPending}
      />
    );
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
          Prueba Vigía con un audio
        </h2>
        <p className="text-base text-[color:var(--color-text-muted)]">
          Elige uno de los tres ejemplos para ver cómo Vigía responde a cada
          tipo de llamada, o graba uno con el micrófono de este dispositivo.
        </p>
      </div>

      {/* ================== Audio a analizar ================== */}
      <fieldset className="border-0 p-0 m-0">
        <legend className="label-strong">Audio a analizar</legend>

        {/* ==== Audios de muestra — opción principal para demo en vivo ==== */}
        <div className="mt-2 flex flex-col gap-3">
          <p
            id={`${formId}-samples-help`}
            className="text-sm text-[color:var(--color-text-subtle)]"
          >
            Toca un ejemplo y luego &ldquo;Analizar audio&rdquo;.
          </p>
          <ul
            className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            aria-describedby={`${formId}-samples-help`}
          >
            {SAMPLE_AUDIOS.map((sample) => {
              const isLoading = loadingSampleId === sample.id;
              const isDisabled =
                isRecording ||
                isRequestingMic ||
                (loadingSampleId !== null && !isLoading);
              return (
                <li key={sample.id}>
                  <button
                    type="button"
                    onClick={() => void loadSample(sample)}
                    disabled={isDisabled}
                    className="w-full h-full text-left p-3 rounded border-2 border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] hover:border-[color:var(--color-brand)] focus:outline-none focus:border-[color:var(--color-brand)] focus:ring-2 focus:ring-[color:var(--color-brand)]/30 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex flex-col gap-1.5"
                    aria-label={`Cargar audio de ejemplo: ${sample.label}. ${sample.description}`}
                  >
                    <span className="flex items-center gap-2">
                      <SparkleIcon className="w-4 h-4 text-[color:var(--color-brand)]" />
                      <span className="font-semibold text-[color:var(--color-text)]">
                        {sample.label}
                      </span>
                      {isLoading ? (
                        <span
                          className="ml-auto text-xs text-[color:var(--color-text-subtle)]"
                          aria-live="polite"
                        >
                          cargando…
                        </span>
                      ) : null}
                    </span>
                    <span className="text-sm text-[color:var(--color-text-muted)] leading-snug">
                      {sample.description}
                    </span>
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-[color:var(--color-text-subtle)]">
                      {SAMPLE_OUTCOME_LABEL_ES[sample.expected_outcome]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {sampleError ? (
            <p
              role="alert"
              className="rounded-md border-l-4 border-[color:var(--color-danger)] bg-[var(--color-danger-bg)] px-4 py-3 text-[color:var(--color-danger)] font-semibold"
            >
              {sampleError}
            </p>
          ) : null}
        </div>

        {/* ==== Grabación con micrófono — alternativa secundaria ==== */}
        <div className="mt-5 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="h-px flex-1 bg-[var(--color-border)]"
            />
            <span className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-text-subtle)]">
              o graba uno propio
            </span>
            <span
              aria-hidden="true"
              className="h-px flex-1 bg-[var(--color-border)]"
            />
          </div>

          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={isRequestingMic}
              className="btn-secondary"
              aria-label="Grabar audio en vivo desde el micrófono del dispositivo"
            >
              <MicIcon className="w-5 h-5" aria-hidden="true" />
              <span>
                {isRequestingMic
                  ? "Pidiendo permiso del micrófono..."
                  : file
                    ? "Grabar otro audio con el micrófono"
                    : "Grabar con el micrófono"}
              </span>
            </button>
          ) : (
            <div
              role="status"
              aria-live="polite"
              className="rounded-md border-2 border-[color:var(--color-danger)] bg-[var(--color-danger-bg)] p-4 flex flex-col gap-3"
            >
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="inline-block w-3.5 h-3.5 rounded-full bg-[color:var(--color-danger)] motion-safe:animate-pulse"
                />
                <span className="font-semibold text-[color:var(--color-danger)]">
                  Grabando
                </span>
                <span
                  className="ml-auto font-mono text-lg tabular-nums text-[color:var(--color-text)]"
                  aria-label={`Duración ${formatDuration(recordingDurationMs)}`}
                >
                  {formatDuration(recordingDurationMs)}
                </span>
              </div>
              <p className="text-sm text-[color:var(--color-text-muted)]">
                Habla cerca del micrófono. La grabación se detiene sola al{" "}
                {Math.round(MAX_RECORDING_MS / 1000)}s.
              </p>
              <button
                type="button"
                onClick={stopRecording}
                className="btn-primary self-start"
                aria-label="Detener la grabación y usar el audio capturado"
              >
                <span>Detener grabación</span>
              </button>
            </div>
          )}

          {recordingError ? (
            <p
              role="alert"
              className="rounded-md border-l-4 border-[color:var(--color-danger)] bg-[var(--color-danger-bg)] px-4 py-3 text-[color:var(--color-danger)] font-semibold"
            >
              {recordingError}
            </p>
          ) : null}
        </div>

        {/* Reproductor de pre-validación: el cuidador escucha el audio
         * antes de mandarlo, confirma que es el correcto. Botón quitar
         * por si subió el equivocado. */}
        {file && audioUrl ? (
          <div
            className="mt-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 flex flex-col gap-3"
            role="group"
            aria-label="Reproductor de pre-validación del audio"
          >
            <p className="text-sm font-semibold text-[color:var(--color-text-muted)]">
              Escucha el audio antes de enviarlo:
            </p>
            <audio
              src={audioUrl}
              controls
              preload="metadata"
              className="w-full"
              aria-label={`Reproducir ${file.name} antes de enviarlo a Vigía`}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={clearFile}
                className="btn-ghost"
                aria-label="Quitar este audio y elegir otro"
              >
                <CloseIcon className="w-4 h-4" />
                <span>Quitar audio</span>
              </button>
            </div>
          </div>
        ) : null}
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
            Confirmo que el llamante fue avisado de esta grabación, o que la
            grabación se obtuvo de manera legal en Chile.
          </span>
        </label>
        <details className="mt-3 ml-9">
          <summary className="cursor-pointer text-sm text-[color:var(--color-brand)] font-semibold">
            ¿Por qué pedimos esto?
          </summary>
          <p
            id={`${formId}-consent-detail`}
            className="mt-2 text-sm text-[color:var(--color-text-muted)] leading-relaxed"
          >
            Sin esta confirmación no podemos analizar el audio. Vigía no guarda
            el archivo: se procesa y se descarta de inmediato. La regla de
            "consentimiento de una sola parte" (one-party-consent) permite que
            grabes una llamada en la que tú participas.
          </p>
        </details>
      </fieldset>

      {/* ================== Campos opcionales ================== */}
      <details className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
        <summary className="cursor-pointer font-semibold text-[color:var(--color-text)] text-base">
          Datos opcionales (mejoran el análisis)
        </summary>
        <div className="mt-4 flex flex-col gap-4">
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
              <span className="font-mono"> +56912345678</span>). Si no lo
              sabes, déjalo vacío.
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
              Solo el primer nombre, nunca apellido ni dirección. Si lo dejas
              vacío, usamos &quot;el adulto mayor&quot;.
            </p>
          </div>
        </div>
      </details>

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
          disabled={isRecording || isRequestingMic}
          aria-label={
            isRecording
              ? "Detén la grabación antes de enviar"
              : "Enviar el audio para que Vigía lo analice"
          }
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
