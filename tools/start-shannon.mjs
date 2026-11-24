#!/usr/bin/env node
// ==================================================
// SHANNON BRIDGE LAUNCHER
// ==================================================
// Loads configuration, then starts the bridge. The bridge reads its environment
// when it is imported, so this has to set process.env first and import after.
//
//   node tools/start-shannon.mjs
//
// Reads, in order (first value wins):
//   .env.shannon   model key + port          (gitignored)
//   .env.stack     SHANNON_BRIDGE_TOKEN      (gitignored)
//
// The token must match what sim-app sees, or the app's proxy calls get a 401
// from the bridge.
// ==================================================

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadEnvFile(file) {
  const full = path.join(root, file);

  if (!existsSync(full)) {
    return false;
  }

  for (const line of readFileSync(full, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);

    if (!match) {
      continue;
    }

    const name = match[1];
    let value = match[2].trim();

    // Strip one layer of matching quotes, as dotenv would.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // First file wins, so .env.shannon overrides .env.stack for shared names.
    if (!(name in process.env)) {
      process.env[name] = value;
    }
  }

  return true;
}

const loaded = [
  loadEnvFile(".env.shannon") ? ".env.shannon" : null,
  loadEnvFile(".env.stack") ? ".env.stack" : null
].filter(Boolean);

if (!process.env.SHANNON_AI_API_KEY) {
  console.error("[launcher] SHANNON_AI_API_KEY is missing.");
  console.error("           Put it in .env.shannon next to this repository.");
  process.exit(1);
}

if (!process.env.SHANNON_BRIDGE_TOKEN) {
  console.error("[launcher] SHANNON_BRIDGE_TOKEN is missing.");
  console.error("           It must be the same value sim-app receives.");
  process.exit(1);
}

console.log(`[launcher] config from: ${loaded.join(", ") || "none"}`);

// Import after the environment is set - the bridge reads it at module load.
await import("./shannon-bridge.mjs");
