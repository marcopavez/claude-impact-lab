/**
 * Smoke test: PII redactor determinista.
 *
 * Uso (desde apps/web/):
 *   node --import tsx --test scripts/smoke-pii.ts
 *
 * Sin red, sin API keys.
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, redact, redactString } from "../lib/validators/pii";

test("RUT con DV correcto se redacta", () => {
  const out = redactString("Mi RUT es 11.111.111-1 y soy yo.");
  assert.equal(out, "Mi RUT es <RUT_REDACTED> y soy yo.");
});

test("RUT con K mayúscula y minúscula (DV módulo 11 = 10)", () => {
  // 8.765.432: módulo-11 da DV=10 que se representa como K.
  const a = redactString("8.765.432-K");
  const b = redactString("8.765.432-k");
  assert.equal(a, "<RUT_REDACTED>");
  assert.equal(b, "<RUT_REDACTED>");
});

test("RUT con DV incorrecto NO se redacta (evita FP)", () => {
  // 11.111.111-2 tiene DV inválido — debe pasar como texto crudo.
  const out = redactString("número 11.111.111-2 es ruido.");
  assert.match(out, /11\.111\.111-2/);
});

test("móvil chileno con +56 9 con espacios", () => {
  const out = redactString("Llamame al +56 9 1234 5678 cuando puedas.");
  assert.equal(out, "Llamame al <PHONE_REDACTED> cuando puedas.");
});

test("móvil chileno sin separadores", () => {
  const out = redactString("Mi número es +56912345678.");
  assert.equal(out, "Mi número es <PHONE_REDACTED>.");
});

test("tarjeta válida Luhn se redacta", () => {
  // 4111 1111 1111 1111 es número de prueba Visa con Luhn válido.
  const out = redactString("Mi tarjeta 4111 1111 1111 1111 venció.");
  assert.equal(out, "Mi tarjeta <CARD_REDACTED> venció.");
});

test("16 dígitos con Luhn inválido NO se redacta como tarjeta", () => {
  const out = redactString("código 1234 5678 9012 3456");
  assert.match(out, /1234 5678 9012 3456/);
});

test("IBAN español válido se redacta", () => {
  // ES91 2100 0418 4502 0005 1332 — IBAN ejemplo público con mod-97 OK.
  const out = redactString("IBAN destino: ES9121000418450200051332.");
  assert.equal(out, "IBAN destino: <IBAN_REDACTED>.");
});

test("cuenta con disparador léxico se redacta", () => {
  const out = redactString("Cuenta vista 1234567890123 a tu nombre.");
  assert.match(out, /<ACCOUNT_REDACTED>/);
});

test("número largo SIN contexto léxico no se redacta como cuenta", () => {
  const out = redactString("código de tracking 1234567890123 enviado.");
  assert.match(out, /1234567890123/);
});

test("zero-width chars (V14) se eliminan en NFKC strip", () => {
  // Inserta U+200B entre dígitos del RUT — sin strip pasaría sin redactar.
  const sneaky = "RUT 11​.111​.111-1";
  const n = normalize(sneaky);
  assert.equal(n, "RUT 11.111.111-1");
  const out = redactString(sneaky);
  assert.equal(out, "RUT <RUT_REDACTED>");
});

test("RTL override (V14) se elimina", () => {
  const sneaky = "Mi RUT es ‮11.111.111-1‬.";
  const out = redactString(sneaky);
  assert.match(out, /<RUT_REDACTED>/);
});

test("múltiples PII en una frase se redactan todas sin solapamiento", () => {
  const txt =
    "Soy 11.111.111-1, mi celu es +56 9 1234 5678, transferí a cuenta corriente 9876543210123.";
  const r = redact(txt);
  assert.match(r.redacted, /<RUT_REDACTED>/);
  assert.match(r.redacted, /<PHONE_REDACTED>/);
  assert.match(r.redacted, /<ACCOUNT_REDACTED>/);
  assert.equal(r.hits.length, 3);
});

test("hits exponen kind/start/end coherentes con la cadena normalizada", () => {
  const r = redact("11.111.111-1");
  assert.equal(r.hits.length, 1);
  assert.equal(r.hits[0].kind, "RUT");
  assert.equal(r.hits[0].start, 0);
  assert.equal(r.hits[0].end, r.normalized.length);
});

test("idempotencia: re-redactar texto ya redactado es no-op", () => {
  const once = redactString("RUT 11.111.111-1 ahora");
  const twice = redactString(once);
  assert.equal(once, twice);
});
