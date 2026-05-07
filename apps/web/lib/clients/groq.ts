// Groq Cloud — STT con Whisper Large v3 Turbo.
//
// Decisión N21 (2026-05-07): reemplazo ElevenLabs Scribe v1 por Groq +
// Whisper Large v3 Turbo. Misma categoría I/O sensorial (no LLM de
// razonamiento → no toca la regla "Claude motor principal"). Razón:
// Scribe v1 entrega 5-15s para audios <60s; Groq entrega <1s típico
// para el mismo input (la latencia STT dejó de dominar el budget E2E).
// Calidad comparable en es-CL para nuestros 3 audios demo.
//
// API: endpoint OpenAI-compatible en https://api.groq.com/openai/v1/audio/transcriptions
// Modelo: whisper-large-v3-turbo. Language hint: "es" (mejora exactitud).
// Sin SDK externo — fetch + FormData nativos de Node 20.
//
// TTS sigue siendo ElevenLabs (eleven_v3) en lib/clients/elevenlabs.ts.

export type TranscribeAudioOptions = {
  /** ISO 639-1 language hint (default: "es"). */
  languageCode?: string;
};

export type TranscribeAudioResult = {
  text: string;
  languageCode?: string;
  /** Duración del audio en segundos según el modelo. */
  durationSec?: number;
  raw: unknown;
};

const GROQ_TRANSCRIPTIONS_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_STT_MODEL = "whisper-large-v3-turbo";

function getApiKey(): string {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY no está definida. Configurá apps/web/.env.local con tu API key (https://console.groq.com/keys).",
    );
  }
  return apiKey;
}

export async function transcribeAudio(
  input: Buffer | Blob | File,
  options: TranscribeAudioOptions = {},
): Promise<TranscribeAudioResult> {
  const apiKey = getApiKey();

  const blob: Blob =
    input instanceof Blob
      ? input
      : new Blob([new Uint8Array(input)], { type: "audio/mpeg" });

  const filename =
    input instanceof File && input.name ? input.name : "audio.mp3";

  const form = new FormData();
  form.append("file", blob, filename);
  form.append("model", GROQ_STT_MODEL);
  form.append("language", options.languageCode ?? "es");
  // verbose_json devuelve duration + language confirmados por el modelo,
  // útiles para logs/telemetría sin costo extra de latencia.
  form.append("response_format", "verbose_json");

  const res = await fetch(GROQ_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    let detail: string;
    try {
      const body = await res.text();
      detail = body.slice(0, 500);
    } catch {
      detail = res.statusText;
    }
    throw new Error(`Groq STT HTTP ${res.status}: ${detail}`);
  }

  const json = (await res.json()) as Record<string, unknown>;

  return {
    text: typeof json.text === "string" ? json.text : "",
    languageCode:
      typeof json.language === "string" ? json.language : undefined,
    durationSec:
      typeof json.duration === "number" ? json.duration : undefined,
    raw: json,
  };
}
