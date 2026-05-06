/**
 * Lista las voces de ElevenLabs filtradas por idioma español o acento latam,
 * para que Marco elija voice_ids antes de correr el render.
 *
 * Uso (desde apps/web/):
 *   npm run voices:list
 *
 * Tip: pasá un argumento para acotar la búsqueda por nombre/descripción:
 *   npm run voices:list -- chilean
 *   npm run voices:list -- mauro
 */

import { listSpanishVoices } from "../lib/clients/elevenlabs";

if (!process.env.ELEVENLABS_API_KEY) {
  console.error("✗ ERROR: ELEVENLABS_API_KEY no está definida en el entorno.");
  console.error("  Configurá apps/web/.env.local y volvé a correr.");
  process.exit(1);
}

const filter = (process.argv[2] ?? "").trim().toLowerCase();

const voices = await listSpanishVoices();

const filtered = filter
  ? voices.filter((v) => {
      const blob = [
        v.name,
        v.description ?? "",
        Object.values(v.labels).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(filter);
    })
  : voices;

if (filtered.length === 0) {
  console.log(
    filter
      ? `Sin coincidencias para "${filter}". Probá sin filtro o con otro término.`
      : "No se encontraron voces marcadas como español/latam en tu cuenta.",
  );
  console.log(
    "Tip: revisá la voice library pública en https://elevenlabs.io/app/voice-library",
  );
  process.exit(0);
}

console.log(
  `\n✓ ${filtered.length} voz/voces ${filter ? `match "${filter}"` : "español/latam"} disponibles:\n`,
);

for (const v of filtered) {
  const labelStr = Object.entries(v.labels)
    .map(([k, val]) => `${k}=${val}`)
    .join(", ");
  console.log(`─ ${v.name}`);
  console.log(`  voice_id    : ${v.voiceId}`);
  if (v.category) console.log(`  category    : ${v.category}`);
  if (labelStr) console.log(`  labels      : ${labelStr}`);
  if (v.description) {
    const short = v.description.length > 120
      ? v.description.slice(0, 117) + "..."
      : v.description;
    console.log(`  description : ${short}`);
  }
  if (v.previewUrl) console.log(`  preview     : ${v.previewUrl}`);
  console.log();
}

console.log(
  "Para usar una voz: copiá su voice_id y reemplazá el placeholder en apps/web/data/scripts/scams.json",
);
