#!/usr/bin/env node
// Hook PreToolUse (B) — bloquea git commit cuando:
//   1. La ventana de build está cerrada y el commit incluye código de aplicación, o
//   2. La branch actual es protegida (main/develop/master) y el commit incluye código.
// Sustento operativo de B3 (ventana sagrada) + gitflow disciplina.
// Activación: settings.json hooks.PreToolUse matcher "Bash" -> "node .claude/hooks/commit-window-guard.mjs"

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const WINDOW_OPEN_ISO = "2026-05-06T00:00:00-04:00";
const PROTECTED_BRANCHES = new Set(["main", "develop", "master"]);
const DOC_PATH_RX = /^(docs\/|RESUMEN\/|README\.md$|\.claude\/|\.gitignore$|LICENSE$|.*\.md$)/;

function readJsonStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8"));
  } catch {
    return null;
  }
}

function isGitCommit(cmd) {
  if (!cmd || typeof cmd !== "string") return false;
  return /\bgit\s+commit\b/.test(cmd);
}

function safe(cmd) {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "";
  }
}

function stagedFiles() {
  const out = safe("git diff --cached --name-only");
  return out ? out.split("\n").map(s => s.trim()).filter(Boolean) : [];
}

function classify(files) {
  const code = [];
  const docs = [];
  for (const f of files) (DOC_PATH_RX.test(f) ? docs : code).push(f);
  return { code, docs };
}

function fmtTimeLeft(ms) {
  if (ms <= 0) return "ventana abierta";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
}

const payload = readJsonStdin();
const toolName = payload?.tool_name ?? payload?.tool?.name ?? "";
const cmd = payload?.tool_input?.command ?? payload?.input?.command ?? "";

if (toolName !== "Bash" || !isGitCommit(cmd)) {
  process.exit(0);
}

const files = stagedFiles();
if (files.length === 0) process.exit(0);

const { code, docs } = classify(files);
if (code.length === 0) process.exit(0);

// Check 1 — ventana de build
const now = Date.now();
const open = Date.parse(WINDOW_OPEN_ISO);

if (now < open) {
  const left = fmtTimeLeft(open - now);
  console.error("");
  console.error("❌ commit-window-guard: ventana cerrada.");
  console.error(`Hora actual:     ${new Date(now).toISOString()}`);
  console.error(`Ventana abre:    ${WINDOW_OPEN_ISO}`);
  console.error(`Tiempo restante: ${left}`);
  console.error("Archivos código en stage:");
  for (const f of code) console.error(`  - ${f}`);
  if (docs.length) {
    console.error("Archivos doc en stage (permitidos):");
    for (const f of docs) console.error(`  - ${f}`);
  }
  console.error("");
  console.error("Acción: unstage los archivos de código (git restore --staged <files>) o esperá la ventana.");
  process.exit(2);
}

// Check 2 — branch protegida
const branch = safe("git rev-parse --abbrev-ref HEAD");
if (PROTECTED_BRANCHES.has(branch)) {
  console.error("");
  console.error(`❌ commit-window-guard: branch protegida (\`${branch}\`).`);
  console.error("Código de aplicación no se commitea directo a main/develop.");
  console.error("Workflow:");
  console.error("  git switch -c feat/<scope>     # creá feature branch");
  console.error("  git commit -m \"feat: ...\"      # commit en feature branch");
  console.error("  # luego PR/merge a develop, y develop -> main en hito");
  console.error("Archivos código en stage:");
  for (const f of code) console.error(`  - ${f}`);
  console.error("");
  console.error("Si querés stashear y crear branch:");
  console.error("  git stash --keep-index && git switch -c feat/<scope>");
  process.exit(2);
}

// Pasa — recordatorio operativo único
console.error(`[commit-window-guard] OK — ventana abierta · branch \`${branch}\` · ${code.length} archivos de código autorizados.`);
console.error(`[commit-window-guard] B3 reminder: si es tu primer commit de código del día, capturá screenshot de la consola Anthropic con ≥3 mensajes timestamped post 2026-05-06.`);
process.exit(0);
