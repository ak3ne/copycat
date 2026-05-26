import { existsSync, mkdirSync, copyFileSync, renameSync, readdirSync, readFileSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { HOME, CLAUDE_DIR, isMac } from "./platform.js";
import { loadConfig } from "./config.js";

export async function cmdRestore(opts) {
  const cfg = loadConfig(opts);
  const src = opts.dest || cfg.snapshotDir;
  if (!src || !existsSync(src)) {
    throw new Error(`snapshot not found at ${src}\nMake sure your cloud folder has finished syncing, or pass --dest <path>.`);
  }

  const yes = !!opts.yes;
  const ts = new Date().toISOString().replace(/[:.]/g, "-");

  console.log(`copycat restore ${yes ? "(applying)" : "(DRY RUN)"} ← ${src}`);

  // Read manifest if present
  const manifestPath = path.join(src, "MANIFEST.json");
  if (existsSync(manifestPath)) {
    const m = JSON.parse(readFileSync(manifestPath, "utf8"));
    console.log(`  source: ${m.sourceHost} (${m.sourcePlatform})  taken: ${m.timestamp}`);
  }

  const claudeBrain = path.join(src, "claude-brain.tar.gz");
  const dotfilesTar = path.join(src, "dotfiles.tar.gz");
  const dotClaude = path.join(src, "dot-claude.json");
  const memoryDir = path.join(src, "memory");
  const laDir = path.join(src, "launchagents");

  // Preflight: report what would happen
  console.log("\nwould restore:");
  if (existsSync(claudeBrain))  console.log(`  → ~/.claude/   (from claude-brain.tar.gz)`);
  if (existsSync(memoryDir))    console.log(`  → ~/.claude/projects/<slug>/memory/   (from memory/*.tar.gz)`);
  if (existsSync(dotfilesTar))  console.log(`  → ~/   (dotfiles)`);
  if (existsSync(dotClaude))    console.log(`  → ~/.claude.json   (MCP config)`);
  if (existsSync(laDir) && isMac())
    console.log(`  → ~/Library/LaunchAgents/com.copycat.*.plist`);

  if (!yes) {
    console.log("\nDry-run only. Add --yes to apply.");
    return;
  }

  // Apply ----------------------------------------------------------------
  // 1. Claude brain — safety-save any pre-existing ~/.claude
  if (existsSync(claudeBrain)) {
    if (existsSync(CLAUDE_DIR) && readdirSync(CLAUDE_DIR).length > 0) {
      const backup = `${CLAUDE_DIR}.pre-copycat-${ts}`;
      renameSync(CLAUDE_DIR, backup);
      console.log(`  safety-saved existing ~/.claude → ${backup}`);
    }
    mkdirSync(CLAUDE_DIR, { recursive: true });
    runTar(["-xzf", claudeBrain, "-C", CLAUDE_DIR]);
    console.log("  ✓ extracted claude-brain.tar.gz");
  }

  // 2. Memory — re-extract each project memory archive into its slug folder
  if (existsSync(memoryDir)) {
    const indexPath = path.join(memoryDir, "INDEX.json");
    if (existsSync(indexPath)) {
      const idx = JSON.parse(readFileSync(indexPath, "utf8"));
      const projectsRoot = path.join(CLAUDE_DIR, "projects");
      mkdirSync(projectsRoot, { recursive: true });
      for (const { project, archive } of idx) {
        const projDir = path.join(projectsRoot, project);
        mkdirSync(projDir, { recursive: true });
        // The archive contains a top-level "memory/" folder; extract into projDir
        runTar(["-xzf", path.join(src, archive), "-C", projDir]);
      }
      console.log(`  ✓ restored memory for ${idx.length} project${idx.length === 1 ? "" : "s"}`);
    }
  }

  // 3. Dotfiles — back up existing ones before overwriting
  if (existsSync(dotfilesTar)) {
    // List archive members so we know which to back up
    const list = spawnSync("tar", ["-tzf", dotfilesTar]).stdout?.toString().trim().split("\n") ?? [];
    for (const name of list) {
      const dst = path.join(HOME, name);
      if (existsSync(dst)) {
        copyFileSync(dst, `${dst}.pre-copycat-${ts}`);
      }
    }
    runTar(["-xzf", dotfilesTar, "-C", HOME]);
    console.log("  ✓ extracted dotfiles");
  }

  // 4. ~/.claude.json
  if (existsSync(dotClaude)) {
    const dst = path.join(HOME, ".claude.json");
    if (existsSync(dst)) copyFileSync(dst, `${dst}.pre-copycat-${ts}`);
    copyFileSync(dotClaude, dst);
    console.log("  ✓ restored ~/.claude.json");
  }

  // 5. LaunchAgents
  if (isMac() && existsSync(laDir)) {
    const laTarget = path.join(HOME, "Library/LaunchAgents");
    mkdirSync(laTarget, { recursive: true });
    for (const plist of readdirSync(laDir)) {
      const full = path.join(laDir, plist);
      copyFileSync(full, path.join(laTarget, plist));
      const label = path.basename(plist, ".plist");
      spawnSync("launchctl", ["bootout", `gui/${process.getuid()}/${label}`]);
      const r = spawnSync("launchctl", ["bootstrap", `gui/${process.getuid()}`, path.join(laTarget, plist)]);
      console.log(`  ✓ loaded LaunchAgent ${label}${r.status === 0 ? "" : " (warning: bootstrap exit " + r.status + ")"}`);
    }
  }

  console.log("\nrestore complete. Next manual steps:");
  console.log("  1. claude /login                  # sign back into Claude Code");
  console.log("  2. restore ~/.ssh/ (AirDrop / Migration Assistant)");
  console.log("  3. clone code projects to ~/Projects/  (git clone <your-remote>)");
  console.log("  4. set API keys / env vars in ~/.zshrc or per-project .env files");
}

function runTar(args) {
  const r = spawnSync("tar", args, { stdio: ["ignore", "ignore", "pipe"] });
  if (r.status !== 0) {
    const stderr = r.stderr?.toString() ?? "";
    throw new Error(`tar failed (exit ${r.status}): ${stderr.trim() || "no output"}`);
  }
}
