/**
 * One-off: renderiza el script `nieto-happy-path` desde scams.json a MP3.
 * Bypass del npm script porque el setup ESM/CJS local (mix de .ts + Node 24)
 * no resuelve top-level await en el path actual de tsx.
 *
 * Uso (desde apps/web/):
 *   node --env-file=.env.local scripts/render-nieto.mjs
 *
 * Output: apps/web/public/demo-audios/nieto-happy-path.mp3
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONFIG = path.join(ROOT, "data", "scripts", "scams.json");
const OUTDIR = path.join(ROOT, "public", "demo-audios");
const TARGET_ID = "nieto-happy-path";

if (!process.env.ELEVENLABS_API_KEY) {
  console.error("✗ ELEVENLABS_API_KEY no definida (cargá apps/web/.env.local).");
  process.exit(1);
}

const cfg = JSON.parse(await readFile(CONFIG, "utf-8"));
const entry = cfg.scripts.find((s) => s.id === TARGET_ID);
if (!entry) {
  console.error(`✗ No encontré el script id=${TARGET_ID} en scams.json`);
  process.exit(1);
}

await mkdir(OUTDIR, { recursive: true });

console.log(`\nVigía · render one-off · ${TARGET_ID} · model=${cfg.model}`);
console.log(`  voice : ${entry.voice.id} (${entry.voice.hint})`);
console.log(`  chars : ${entry.text.length}`);

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
const t0 = Date.now();

const stream = await client.textToSpeech.convert(entry.voice.id, {
  text: entry.text,
  modelId: cfg.model,
  outputFormat: cfg.output_format,
  languageCode: cfg.language_code,
  voiceSettings: {
    stability: entry.voice_settings.stability,
    similarityBoost: entry.voice_settings.similarity_boost,
    style: entry.voice_settings.style,
    useSpeakerBoost: entry.voice_settings.use_speaker_boost,
  },
});

const chunks = [];
for await (const chunk of stream) chunks.push(chunk);
const buffer = Buffer.concat(chunks);

const outPath = path.join(OUTDIR, `${TARGET_ID}.mp3`);
await writeFile(outPath, buffer);

const ms = Date.now() - t0;
const kb = (buffer.length / 1024).toFixed(1);
console.log(`\n✓ ${path.relative(ROOT, outPath)} · ${kb} KB · ${ms} ms\n`);
