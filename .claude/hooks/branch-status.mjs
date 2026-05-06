#!/usr/bin/env node
// Hook UserPromptSubmit (A) — inyecta branch + dirty status al system prompt para que Claude
// proactivamente sugiera crear feat/<scope> cuando corresponda.
// Activación: settings.json hooks.UserPromptSubmit -> "node .claude/hooks/branch-status.mjs"

import { execSync } from "node:child_process";

const PROTECTED = new Set(["main", "develop", "master"]);
const DOC_PATH_RX = /^(docs\/|RESUMEN\/|README\.md$|\.claude\/|\.gitignore$|LICENSE$|.*\.md$)/;

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

const branch = safe("git rev-parse --abbrev-ref HEAD");
if (!branch) process.exit(0);

const status = safe("git status --porcelain");
const dirty = status
  ? status.split("\n").map(l => l.slice(3).trim()).filter(Boolean)
  : [];
const dirtyCode = dirty.filter(f => !DOC_PATH_RX.test(f));

let msg = `Estado git: branch \`${branch}\``;
if (dirty.length) {
  msg += `, ${dirty.length} archivos modificados`;
  if (dirtyCode.length) msg += ` (${dirtyCode.length} de código de aplicación)`;
  msg += ".";
} else {
  msg += ", working tree limpio.";
}

if (PROTECTED.has(branch) && dirtyCode.length) {
  msg += ` ⚠️ Estás en branch protegida con código de aplicación modificado. Antes del próximo edit o commit de código, sugerí a Marco crear feature branch: \`git switch -c feat/<scope>\`. Docs (\`docs/\`, \`.claude/\`, \`README.md\`) sí pueden ir directo en ${branch}.`;
} else if (PROTECTED.has(branch)) {
  msg += ` Estás en \`${branch}\`. Si vas a tocar código de aplicación (\`apps/\`, \`packages/\`, \`prompts/\`, \`*.ts\`), creá \`feat/<scope>\` antes.`;
}

const out = {
  hookSpecificOutput: {
    hookEventName: "UserPromptSubmit",
    additionalContext: msg,
  },
};

process.stdout.write(JSON.stringify(out));
process.exit(0);
