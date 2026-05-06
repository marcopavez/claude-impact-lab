/**
 * Renderiza los scripts de scams.json a archivos mp3 con ElevenLabs TTS.
 * Output: apps/web/public/demo-audios/<id>.mp3
 *
 * Uso (desde apps/web/):
 *   npm run render:scams           # solo los 3 default (canónicos PLAN.md N19)
 *   npm run render:scams -- --all  # incluye los extras (oracle, voice-clone)
 *   npm run render:scams -- --id cuento-del-tio   # uno específico
 *   npm run render:scams -- --force                # re-renderiza aunque exista
 *
 * Activa sub-check B3 (primer call API en ventana). Solo correr ≥ 6-may 00:00.
 */

import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import {
  generateAudio,
  type GenerateAudioOptions,
  type TtsModelId,
} from "../lib/clients/elevenlabs";

type ScriptEntry = {
  id: string;
  default: boolean;
  golden_set_ref: string;
  expected_action: string;
  severity: string;
  voice: { id: string; hint: string };
  voice_settings?: GenerateAudioOptions["voiceSettings"];
  text: string;
  rationale: string;
};

type ScamsConfig = {
  model: TtsModelId;
  output_format: string;
  language_code: string;
  scripts: ScriptEntry[];
};

const ROOT = path.resolve(import.meta.dirname, "..");
const CONFIG_PATH = path.join(ROOT, "data", "scripts", "scams.json");
const OUTPUT_DIR = path.join(ROOT, "public", "demo-audios");

if (!process.env.ELEVENLABS_API_KEY) {
  console.error("✗ ERROR: ELEVENLABS_API_KEY no está definida en el entorno.");
  console.error("  Configurá apps/web/.env.local y volvé a correr.");
  process.exit(1);
}

const args = process.argv.slice(2);
const renderAll = args.includes("--all");
const force = args.includes("--force");
const idArgIdx = args.indexOf("--id");
const onlyId = idArgIdx >= 0 ? args[idArgIdx + 1] : undefined;

const raw = await readFile(CONFIG_PATH, "utf-8");
const config = JSON.parse(raw) as ScamsConfig;

await mkdir(OUTPUT_DIR, { recursive: true });

let toRender = config.scripts.filter((s) => renderAll || s.default);
if (onlyId) toRender = toRender.filter((s) => s.id === onlyId);

if (toRender.length === 0) {
  console.error(
    `✗ No hay scripts para renderizar (filtro: --all=${renderAll}, --id=${onlyId ?? "n/a"}).`,
  );
  process.exit(1);
}

console.log(
  `\nVigía · ElevenLabs render · ${toRender.length} script(s) · model=${config.model}\n`,
);

let totalChars = 0;
let rendered = 0;
let skipped = 0;
let failed = 0;
const startedAt = Date.now();

for (const script of toRender) {
  const outPath = path.join(OUTPUT_DIR, `${script.id}.mp3`);
  const exists = await stat(outPath).then(
    () => true,
    () => false,
  );

  console.log(`─ [${script.severity}] ${script.id} (${script.text.length} chars)`);
  console.log(`  hint     : ${script.voice.hint}`);
  console.log(`  voice_id : ${script.voice.id}`);

  if (exists && !force) {
    console.log(`  ↷ skip (ya existe en ${path.relative(ROOT, outPath)}; usá --force para regenerar)\n`);
    skipped++;
    continue;
  }

  try {
    const t0 = Date.now();
    const audio = await generateAudio(script.text, script.voice.id, {
      modelId: config.model,
      outputFormat: config.output_format,
      languageCode: config.language_code,
      voiceSettings: script.voice_settings,
    });
    await writeFile(outPath, audio);
    const ms = Date.now() - t0;
    const kb = (audio.length / 1024).toFixed(1);
    console.log(`  ✓ ${path.relative(ROOT, outPath)} · ${kb} KB · ${ms} ms\n`);
    totalChars += script.text.length;
    rendered++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗ ERROR: ${msg}\n`);
    failed++;
  }
}

const totalSec = ((Date.now() - startedAt) / 1000).toFixed(1);
console.log(
  `\nResumen: ${rendered} renderizado(s) · ${skipped} saltado(s) · ${failed} fallo(s) · ${totalChars} chars · ${totalSec}s`,
);
console.log(`Output: ${path.relative(ROOT, OUTPUT_DIR)}/`);

if (failed > 0) process.exit(1);
