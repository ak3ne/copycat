import { existsSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import path from "node:path";
import { detectCloudFolders, COPYCAT_DIR, HOME } from "./platform.js";
import { configPath, defaultConfig, saveConfig } from "./config.js";

export async function cmdInit(opts) {
  const cfgPath = configPath(opts);
  if (existsSync(cfgPath)) {
    console.log(`config already exists at ${cfgPath}`);
    console.log(`re-run with: rm ${cfgPath} && copycat init   (or edit the file directly)`);
    return;
  }

  console.log("copycat init — picking where to store snapshots\n");
  const found = detectCloudFolders();
  let candidates = found.map((f, i) => ({ ...f, n: i + 1 }));
  const localDefault = path.join(COPYCAT_DIR, "snapshots");
  candidates.push({ n: candidates.length + 1, kind: "local", label: "Local only (no cloud)", path: localDefault });
  candidates.push({ n: candidates.length + 1, kind: "custom", label: "Enter a custom path", path: null });

  for (const c of candidates) {
    const tail = c.path ? `→ ${c.path}/copycat-snapshot/` : "(you'll be prompted)";
    console.log(`  ${c.n}. ${c.label}  ${tail}`);
  }

  const rl = createInterface({ input, output });
  const pick = (await rl.question(`\nChoice [1-${candidates.length}] (default 1): `)).trim() || "1";
  let chosen = candidates[parseInt(pick, 10) - 1];
  if (!chosen) throw new Error("invalid selection");

  let dest;
  if (chosen.kind === "custom") {
    const raw = (await rl.question("Path (absolute): ")).trim();
    if (!raw) throw new Error("path required");
    dest = path.resolve(raw.replace(/^~/, HOME));
  } else {
    dest = path.join(chosen.path, "copycat-snapshot");
  }
  rl.close();

  mkdirSync(dest, { recursive: true });

  const cfg = defaultConfig(dest);
  saveConfig(cfg, opts);

  console.log(`\n✓ snapshot destination: ${dest}`);
  console.log(`✓ config saved: ${cfgPath}`);
  console.log("\nNext:");
  console.log("  copycat snapshot     # make your first snapshot");
  console.log("  copycat schedule     # set up automatic biweekly snapshots");
}
