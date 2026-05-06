/**
 * Smoke test: verifica que el SDK de Anthropic está configurado y responde.
 *
 * Uso (desde apps/web/):
 *   node --env-file=.env.local --import tsx scripts/smoke-anthropic.ts
 *
 * Requiere: ANTHROPIC_API_KEY en apps/web/.env.local
 */

import Anthropic from "@anthropic-ai/sdk";

if (!process.env.ANTHROPIC_API_KEY) {
  console.error("✗ ERROR: ANTHROPIC_API_KEY no está definida en el entorno.");
  console.error("  Configurá apps/web/.env.local con tu API key y volvé a correr.");
  process.exit(1);
}

const client = new Anthropic();

const message = await client.messages.create({
  model: "claude-sonnet-4-6",
  max_tokens: 50,
  messages: [{ role: "user", content: "Decime 'pong' y nada más." }],
});

const text =
  message.content[0]?.type === "text" ? message.content[0].text : "<sin texto>";

console.log("✓ Conexión Anthropic OK");
console.log("  Modelo   :", message.model);
console.log("  Stop     :", message.stop_reason);
console.log("  Respuesta:", text.trim());
console.log(
  "  Tokens   : in =",
  message.usage.input_tokens,
  "· out =",
  message.usage.output_tokens,
);
