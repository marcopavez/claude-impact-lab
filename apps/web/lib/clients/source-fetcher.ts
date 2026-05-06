// Source fetcher for the citation validator (SEGURIDAD §7).
// Hace HTTP GET sobre la URL oficial citada, devuelve el body plain text con HTML
// strippeado. Egress allow-list (V4/V15 del threat model): bloqueamos hosts fuera
// de la whitelist conocida ANTES de hacer fetch.

import type { SourceFetcher } from "../validators/citation";

const ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  "fintech.benditaia.cl",
  "www.bcn.cl",
  "bcn.cl",
  "www.cmfchile.cl",
  "cmfchile.cl",
  "www.csirt.gob.cl",
  "csirt.gob.cl",
  "www.sii.cl",
  "sii.cl",
  "www.sernac.cl",
  "sernac.cl",
  "www.pdichile.cl",
  "pdichile.cl",
  "www.subtel.gob.cl",
  "subtel.gob.cl",
]);

const FETCH_TIMEOUT_MS = 10_000;
const USER_AGENT = "Vigia/0.1 (+https://github.com/marcopavez/claude-impact-lab) Chilean civic AI safety MVP";

function stripHtmlToText(html: string): string {
  // 1. Quita scripts/styles enteros (incluyendo contenido).
  const noScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  // 2. Quita tags HTML.
  const noTags = noScripts.replace(/<[^>]+>/g, " ");
  // 3. Decodifica entidades comunes (mínimo viable; los datasets oficiales son ASCII+latín-1).
  const decoded = noTags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ");
  // 4. Colapsa whitespace.
  return decoded.replace(/\s+/g, " ").trim();
}

/**
 * SourceFetcher con egress allow-list + timeout 10s + HTML strip.
 * Usado por el orquestador del endpoint /api/audio/process cuando invoca al
 * Regulatory Translator. No se usa para datos de la persona protegida.
 */
export const httpSourceFetcher: SourceFetcher = async (url: string) => {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(`URL inválida: ${url}`);
  }

  if (parsed.protocol !== "https:") {
    throw new Error(`Protocolo no permitido (${parsed.protocol}): ${url}`);
  }
  if (!ALLOWED_HOSTS.has(parsed.host)) {
    throw new Error(`Host fuera de la allow-list: ${parsed.host}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
      },
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error(
      `Fetch ${url} falló con status ${response.status} ${response.statusText}`,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  const body = await response.text();

  // Si es HTML, strippeamos a texto plano para que el citation validator
  // (substring + Levenshtein) no se confunda con tags. Si no es HTML, asumimos
  // que ya es texto plano.
  if (contentType.includes("html")) {
    return stripHtmlToText(body);
  }
  return body;
};
