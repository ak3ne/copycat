import { existsSync, readdirSync, statSync } from "node:fs";
import { homedir, platform } from "node:os";
import path from "node:path";

export const HOME = homedir();
export const PLATFORM = platform(); // 'darwin' | 'linux' | 'win32' | ...

export function isMac() { return PLATFORM === "darwin"; }
export function isLinux() { return PLATFORM === "linux"; }

/** Standard Claude Code config dir. */
export const CLAUDE_DIR = path.join(HOME, ".claude");

/** Default config path for copycat. */
export const COPYCAT_DIR = path.join(HOME, ".copycat");
export const DEFAULT_CONFIG = path.join(COPYCAT_DIR, "config.json");

/**
 * Auto-detect cloud-synced folder locations.
 * Returns a list of { kind, label, path } for cloud roots we recognise.
 */
export function detectCloudFolders() {
  const found = [];

  // macOS: iCloud Drive
  if (isMac()) {
    const icloud = path.join(HOME, "Library/Mobile Documents/com~apple~CloudDocs");
    if (existsSync(icloud)) {
      found.push({ kind: "icloud", label: "iCloud Drive", path: icloud });
    }
    // macOS CloudStorage providers (Dropbox, Google Drive, OneDrive, Box, etc.)
    const cs = path.join(HOME, "Library/CloudStorage");
    if (existsSync(cs)) {
      try {
        for (const entry of readdirSync(cs)) {
          // Skip hidden files (.DS_Store etc.) and timestamped conflict copies
          if (entry.startsWith(".")) continue;
          if (/\(\d{4}-\d{2}-\d{2}/.test(entry)) continue;
          // Skip alt iCloud locations — the canonical one is already added above
          if (/^iCloud/i.test(entry)) continue;
          const full = path.join(cs, entry);
          try { if (!statSync(full).isDirectory()) continue; } catch { continue; }
          let kind = "cloud";
          if (/^Dropbox/i.test(entry)) kind = "dropbox";
          else if (/^GoogleDrive/i.test(entry)) kind = "googledrive";
          else if (/^OneDrive/i.test(entry)) kind = "onedrive";
          else if (/^Box/i.test(entry)) kind = "box";
          found.push({ kind, label: entry, path: full });
        }
      } catch { /* ignore */ }
    }
    // Classic Dropbox location (older installs)
    const oldDropbox = path.join(HOME, "Dropbox");
    if (existsSync(oldDropbox) && !found.some(f => f.path === oldDropbox)) {
      found.push({ kind: "dropbox", label: "Dropbox (legacy ~/Dropbox)", path: oldDropbox });
    }
  }

  // Linux: Dropbox, Nextcloud, Insync (Google Drive), rclone mounts
  if (isLinux()) {
    for (const [kind, rel] of [
      ["dropbox", "Dropbox"],
      ["nextcloud", "Nextcloud"],
      ["googledrive", "Google Drive"],
      ["googledrive", "InsyncDrive"],
      ["onedrive", "OneDrive"],
    ]) {
      const full = path.join(HOME, rel);
      if (existsSync(full)) found.push({ kind, label: rel, path: full });
    }
  }

  return found;
}

/**
 * The default include list — Claude Code config files that travel well.
 * These are RELATIVE to $HOME. Missing entries are silently skipped at snapshot time.
 */
export const DEFAULT_INCLUDE = [
  ".claude/agents",
  ".claude/.agents",
  ".claude/commands",
  ".claude/skills",
  ".claude/rules",
  ".claude/hooks",
  ".claude/scripts",
  ".claude/mcp-configs",
  ".claude/settings.json",
  ".claude/settings.local.json",
  ".claude/plugin.json",
  ".claude/marketplace.json",
  ".claude/AGENTS.md",
  ".claude/CLAUDE.md",
];

/**
 * Excluded by default — caches, telemetry, plugin downloads, project session logs.
 * (We snapshot memory separately because it's nested under project slugs.)
 */
export const DEFAULT_EXCLUDE = [
  ".claude/cache",
  ".claude/file-history",
  ".claude/image-cache",
  ".claude/paste-cache",
  ".claude/plugins",
  ".claude/projects",
  ".claude/session-env",
  ".claude/sessions",
  ".claude/shell-snapshots",
  ".claude/tasks",
  ".claude/telemetry",
  ".claude/backups",
  ".claude/downloads",
  ".claude/debug",
  ".claude/ide",
];
