import { existsSync, mkdirSync, copyFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { hostname } from "node:os";
import path from "node:path";
import { HOME, CLAUDE_DIR, isMac } from "./platform.js";
import { loadConfig } from "./config.js";

export async function cmdSnapshot(opts) {
  const cfg = loadConfig(opts);
  const dest = cfg.snapshotDir;
  if (!dest) throw new Error("config.snapshotDir is empty — run: copycat init");
  mkdirSync(dest, { recursive: true });
  mkdirSync(path.join(dest, "launchagents"), { recursive: true });

  console.log(`copycat snapshot → ${dest}`);

  // 1. Claude brain (only entries that actually exist)
  const existingClaude = (cfg.include || []).filter((rel) => {
    const full = path.join(HOME, rel);
    return existsSync(full);
  });
  if (existingClaude.length === 0) {
    console.log("  (no Claude config found at $HOME/.claude — snapshot will be empty)");
  } else {
    runTar([
      "-czf", path.join(dest, "claude-brain.tar.gz"),
      "-C", HOME,
      ...existingClaude,
    ]);
    console.log("  ✓ claude-brain.tar.gz");
  }

  // 2. Memory dirs — every project's memory/ folder under ~/.claude/projects/
  if (cfg.includeMemory) {
    const projDir = path.join(CLAUDE_DIR, "projects");
    const memoryDirs = [];
    if (existsSync(projDir)) {
      for (const project of readdirSync(projDir)) {
        const mem = path.join(projDir, project, "memory");
        if (existsSync(mem) && statSync(mem).isDirectory()) {
          memoryDirs.push({ project, mem });
        }
      }
    }
    if (memoryDirs.length > 0) {
      // tar each as project-name.tar.gz under a memory/ subfolder
      const memOut = path.join(dest, "memory");
      mkdirSync(memOut, { recursive: true });
      for (const { project, mem } of memoryDirs) {
        // Use cd-and-tar pattern to avoid leading-dash issues with project slugs
        runTar([
          "-czf", path.join(memOut, `${project.replace(/^-+/, "")}.tar.gz`),
          "-C", path.dirname(mem),
          path.basename(mem),
        ]);
      }
      // Index file mapping safe filenames back to original project slugs
      const index = memoryDirs.map(({ project, mem }) => ({
        project,
        archive: `memory/${project.replace(/^-+/, "")}.tar.gz`,
      }));
      writeFileSync(path.join(dest, "memory", "INDEX.json"), JSON.stringify(index, null, 2));
      console.log(`  ✓ memory/ (${memoryDirs.length} project memory dir${memoryDirs.length === 1 ? "" : "s"})`);
    } else {
      console.log("  · no memory dirs found at ~/.claude/projects/*/memory/");
    }
  }

  // 3. Dotfiles (best-effort, only those present)
  if (cfg.includeDotfiles) {
    const dotfiles = [".zshrc", ".zshenv", ".zprofile", ".bashrc", ".bash_profile", ".profile", ".gitconfig"];
    const present = dotfiles.filter((f) => existsSync(path.join(HOME, f)));
    if (present.length > 0) {
      runTar(["-czf", path.join(dest, "dotfiles.tar.gz"), "-C", HOME, ...present]);
      console.log(`  ✓ dotfiles.tar.gz (${present.length} files)`);
    }
  }

  // 4. ~/.claude.json (MCP server config) — opt-in via includeSecrets or --include-secrets
  const includeSecrets = opts.includeSecrets ?? cfg.includeSecrets;
  if (includeSecrets) {
    const src = path.join(HOME, ".claude.json");
    if (existsSync(src)) {
      copyFileSync(src, path.join(dest, "dot-claude.json"));
      console.log("  ✓ dot-claude.json (contains MCP config; review on restore)");
    }
  } else if (existsSync(path.join(HOME, ".claude.json"))) {
    console.log("  · skipped ~/.claude.json (may contain tokens; pass --include-secrets to include)");
  }

  // 5. LaunchAgents (macOS only, only those named com.copycat.*)
  if (isMac() && cfg.includeLaunchAgents) {
    const laDir = path.join(HOME, "Library/LaunchAgents");
    if (existsSync(laDir)) {
      const plists = readdirSync(laDir).filter((f) => /^com\.copycat\..*\.plist$/.test(f));
      for (const p of plists) {
        copyFileSync(path.join(laDir, p), path.join(dest, "launchagents", p));
      }
      if (plists.length) console.log(`  ✓ launchagents/ (${plists.length} plist${plists.length === 1 ? "" : "s"})`);
    }
  }

  // 6. MANIFEST
  const manifest = {
    schemaVersion: 1,
    timestamp: new Date().toISOString(),
    sourceHost: hostname(),
    sourcePlatform: process.platform,
    includeSecrets,
    config: { ...cfg, schemaVersion: undefined },
  };
  writeFileSync(path.join(dest, "MANIFEST.json"), JSON.stringify(manifest, null, 2));

  // Human-readable companion
  const sizes = readdirSync(dest)
    .filter((f) => statSync(path.join(dest, f)).isFile())
    .map((f) => `  ${f}\t${humanSize(statSync(path.join(dest, f)).size)}`)
    .join("\n");
  writeFileSync(
    path.join(dest, "MANIFEST.txt"),
    `snapshot timestamp: ${manifest.timestamp}
source machine: ${manifest.sourceHost}
source platform: ${manifest.sourcePlatform}
include-secrets: ${includeSecrets}

files:
${sizes}
`,
  );
  console.log("  ✓ MANIFEST.json + MANIFEST.txt");

  console.log(`\nsnapshot complete: ${dest}`);
}

function runTar(args) {
  const r = spawnSync("tar", args, { stdio: ["ignore", "ignore", "pipe"] });
  if (r.status !== 0) {
    const stderr = r.stderr?.toString() ?? "";
    throw new Error(`tar failed (exit ${r.status}): ${stderr.trim() || "no output"}`);
  }
}

function humanSize(bytes) {
  const units = ["B", "K", "M", "G"];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)}${units[i]}`;
}
