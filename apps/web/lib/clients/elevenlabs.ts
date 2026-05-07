import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

export type TtsModelId = "eleven_v3" | "eleven_multilingual_v2";

export type GenerateAudioOptions = {
  modelId?: TtsModelId;
  outputFormat?: string;
  languageCode?: string;
  voiceSettings?: {
    stability?: number;
    similarity_boost?: number;
    style?: number;
    use_speaker_boost?: boolean;
  };
  seed?: number;
};

let cachedClient: ElevenLabsClient | null = null;

function getClient(): ElevenLabsClient {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY no está definida. Configurá apps/web/.env.local con tu API key.",
    );
  }
  cachedClient = new ElevenLabsClient({ apiKey });
  return cachedClient;
}

async function streamToBuffer(
  stream: ReadableStream<Uint8Array>,
): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as unknown as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function generateAudio(
  text: string,
  voiceId: string,
  options: GenerateAudioOptions = {},
): Promise<Buffer> {
  if (!text || text.trim().length === 0) {
    throw new Error("generateAudio: text vacío.");
  }
  if (!voiceId || voiceId.startsWith("REPLACE_WITH_")) {
    throw new Error(
      `generateAudio: voiceId inválido (${voiceId}). Corré "npm run voices:list" en apps/web/ y reemplazá el placeholder en data/scripts/scams.json.`,
    );
  }

  const client = getClient();
  const stream = await client.textToSpeech.convert(voiceId, {
    text,
    modelId: options.modelId ?? "eleven_v3",
    outputFormat: (options.outputFormat ?? "mp3_44100_128") as never,
    languageCode: options.languageCode ?? "es",
    ...(options.voiceSettings && {
      voiceSettings: {
        stability: options.voiceSettings.stability,
        similarityBoost: options.voiceSettings.similarity_boost,
        style: options.voiceSettings.style,
        useSpeakerBoost: options.voiceSettings.use_speaker_boost,
      },
    }),
    ...(options.seed !== undefined && { seed: options.seed }),
  });

  return streamToBuffer(stream);
}

export type SpanishVoice = {
  voiceId: string;
  name: string;
  category?: string;
  description?: string;
  labels: Record<string, string>;
  previewUrl?: string;
};

export async function listSpanishVoices(): Promise<SpanishVoice[]> {
  const client = getClient();
  const response = await client.voices.getAll({ showLegacy: false });

  const voices = (response as { voices?: unknown[] }).voices ?? [];
  const result: SpanishVoice[] = [];

  for (const v of voices) {
    const voice = v as Record<string, unknown>;
    const labels = (voice.labels ?? {}) as Record<string, string>;
    const description =
      typeof voice.description === "string" ? voice.description : "";
    const language =
      typeof labels.language === "string" ? labels.language.toLowerCase() : "";
    const accent =
      typeof labels.accent === "string" ? labels.accent.toLowerCase() : "";

    const isSpanish =
      language.includes("spanish") ||
      language.includes("español") ||
      language === "es" ||
      accent.includes("latin") ||
      accent.includes("spanish") ||
      accent.includes("chilean") ||
      description.toLowerCase().includes("spanish") ||
      description.toLowerCase().includes("español");

    if (!isSpanish) continue;

    result.push({
      voiceId: typeof voice.voiceId === "string" ? voice.voiceId : "",
      name: typeof voice.name === "string" ? voice.name : "(sin nombre)",
      category: typeof voice.category === "string" ? voice.category : undefined,
      description: description || undefined,
      labels,
      previewUrl:
        typeof voice.previewUrl === "string" ? voice.previewUrl : undefined,
    });
  }

  return result;
}
