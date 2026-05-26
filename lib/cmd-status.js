import { existsSync, readdirSync, statSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { loadConfig, configPath } from "./config.js";
import { isMac } from "./platform.js";

export async function cmdStatus(opts) {
  const p = configPath(opts);
  if (!existsSync(p)) {
    console.log(`no config at ${p}\nrun: copycat init`);
    return;
  }
  const cfg = loadConfig(opts);
  console.log(`config:        ${p}`);
  console.log(`snapshot dir:  ${cfg.snapshotDir}`);
  console.log(`includes:      ${(cfg.include || []).length} entries`);
  console.log(`include-secrets: ${cfg.includeSecrets ? "yes" : "no"}`);

  if (existsSync(cfg.snapshotDir)) {
    const files = readdirSync(cfg.snapshotDir)
      .filter((f) => statSync(path.join(cfg.snapshotDir, f)).isFile());
    console.log(`\nsnapshot files (${files.length}):`);
    for (const f of files) {
      const s = statSync(path.join(cfg.snapshotDir, f));
      console.log(`  ${f.padEnd(28)} ${human(s.size).padStart(8)}   ${s.mtime.toISOString()}`);
    }
    const manifestPath = path.join(cfg.snapshotDir, "MANIFEST.json");
    if (existsSync(manifestPath)) {
      const m = JSON.parse(readFileSync(manifestPath, "utf8"));
      console.log(`\nlatest snapshot: ${m.timestamp}  from ${m.sourceHost} (${m.sourcePlatform})`);
    }
  } else {
    console.log(`\nsnapshot dir does not exist yet — run: copycat snapshot`);
  }

  if (isMac()) {
    const r = spawnSync("launchctl", ["print", `gui/${process.getuid()}/com.copycat.snapshot`]);
    const out = (r.stdout?.toString() || "") + (r.stderr?.toString() || "");
    if (r.status === 0) {
      const stateLine = out.split("\n").find((l) => l.includes("state ="));
      console.log(`\nLaunchAgent:   loaded${stateLine ? "  " + stateLine.trim() : ""}`);
    } else {
      console.log(`\nLaunchAgent:   not installed (run: copycat schedule)`);
    }
  }
}

function human(bytes) {
  const u = ["B", "K", "M", "G"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)}${u[i]}`;
}
