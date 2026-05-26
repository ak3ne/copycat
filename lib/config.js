import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { COPYCAT_DIR, DEFAULT_CONFIG, DEFAULT_INCLUDE, DEFAULT_EXCLUDE } from "./platform.js";

/** Shape of ~/.copycat/config.json */
export const SCHEMA_VERSION = 1;

export function configPath(opts) {
  return opts?.config || DEFAULT_CONFIG;
}

export function loadConfig(opts) {
  const p = configPath(opts);
  if (!existsSync(p)) {
    throw new Error(`config not found at ${p}\nRun: copycat init`);
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

export function saveConfig(cfg, opts) {
  const p = configPath(opts);
  mkdirSync(path.dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(cfg, null, 2) + "\n");
}

export function defaultConfig(snapshotDir) {
  return {
    schemaVersion: SCHEMA_VERSION,
    snapshotDir,
    include: [...DEFAULT_INCLUDE],
    exclude: [...DEFAULT_EXCLUDE],
    includeMemory: true,
    includeDotfiles: true,
    includeLaunchAgents: true,
    includeSecrets: false, // ~/.claude.json may have tokens — opt in via CLI flag
  };
}
