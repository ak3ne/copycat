# copycat

> Snapshot and restore your Claude Code brain across machines — via the cloud folder you already have.

`copycat` packages your Claude Code config, skills, agents, commands, hooks, settings, and per-project memory into a portable snapshot, then restores it on a new machine with a single command. No GitHub PAT, no encryption keys to manage — it uses whatever cloud folder you already have synced (iCloud Drive, Dropbox, Google Drive, OneDrive, or a plain local path).

```bash
# on the source machine
npx @copycat/cli init       # one-time: pick where to store snapshots
npx @copycat/cli snapshot   # make a snapshot
npx @copycat/cli schedule   # optional: install biweekly auto-snapshot

# on the new machine, once the cloud folder has synced
npx @copycat/cli restore         # dry-run preflight
npx @copycat/cli restore --yes   # actually restore
```

## Why this exists

Migrating your Claude Code setup to a new machine usually means manually copying `~/.claude/`, hoping you don't forget your memory directory, re-typing settings, and reinstalling LaunchAgents. The existing alternatives ([claude-code-sync](https://github.com/FelixIsaac/claude-code-sync), [claude-code-backup](https://www.npmjs.com/package/claude-code-backup), etc.) lean on `git` + GitHub as the transport, which means PATs, encrypted blobs, and yet-another-credential to remember.

`copycat` uses a cloud folder you already have. If you're on macOS and signed into iCloud, you're already done — just pick "iCloud Drive" at init time.

## What gets snapshotted

By default (safe to share):

- `~/.claude/{agents,commands,skills,rules,hooks,scripts,mcp-configs}/`
- `~/.claude/{settings.json,settings.local.json,plugin.json,marketplace.json,AGENTS.md,CLAUDE.md}`
- Every project's memory dir (`~/.claude/projects/<slug>/memory/`) — packaged with an INDEX so they restore back to the same slugs
- Standard dotfiles (`.zshrc`, `.gitconfig`, etc.)
- macOS: any LaunchAgent named `com.copycat.*` (e.g. the snapshot scheduler itself)

Opt-in only (with `--include-secrets`):

- `~/.claude.json` — your MCP server config, which may contain auth tokens

Intentionally **excluded** (re-downloaded or local-only):

- `~/.claude/{plugins,cache,projects/*/sessions,telemetry,file-history,image-cache,…}/`
- `~/Projects/` codebases (too large; use git remotes)
- ssh keys, API tokens (security; use AirDrop / Migration Assistant / 1Password)

## Commands

```
copycat init                  Detect cloud folders, pick a snapshot destination
copycat snapshot              Create a snapshot using current config
copycat restore               Preflight (dry-run). Add --yes to apply.
copycat schedule              Install auto-snapshot schedule (biweekly default)
copycat status                Show current config + snapshot freshness + schedule
```

### Flags

- `--yes` / `-y` — for `restore`: actually apply (default is dry-run)
- `--include-secrets` — include `~/.claude.json` (may contain MCP auth tokens)
- `--interval <kind>` — for `schedule`: `weekly` | `biweekly` (default) | `monthly`
- `--config <path>` — use a config file at a non-default path
- `--dest <path>` — for `restore`: load snapshot from a path different than configured

## Platform support

| OS | Snapshot | Restore | Schedule |
|---|---|---|---|
| macOS | ✅ | ✅ | ✅ (LaunchAgent) |
| Linux | ✅ | ✅ | manual systemd timer (instructions printed) |
| Windows | not yet | not yet | not yet |

## Configuration

`copycat init` writes `~/.copycat/config.json`:

```json
{
  "schemaVersion": 1,
  "snapshotDir": "<your-cloud-folder>/copycat-snapshot",
  "include": [".claude/agents", ".claude/.agents", ".claude/commands", "..."],
  "exclude": [".claude/plugins", ".claude/cache", "..."],
  "includeMemory": true,
  "includeDotfiles": true,
  "includeLaunchAgents": true,
  "includeSecrets": false
}
```

`snapshotDir` is the absolute path where bundles live. Examples by OS / provider:

- macOS + iCloud — `~/Library/Mobile Documents/com~apple~CloudDocs/copycat-snapshot`
- macOS + Dropbox — `~/Library/CloudStorage/Dropbox/copycat-snapshot`
- macOS + Google Drive — `~/Library/CloudStorage/GoogleDrive-<account>/copycat-snapshot`
- Linux + Dropbox — `~/Dropbox/copycat-snapshot`
- Linux + Nextcloud — `~/Nextcloud/copycat-snapshot`
- Anywhere, no cloud — `~/.copycat/snapshots` (then move the bundle yourself)

Edit it freely. Run `copycat status` to see what's in scope.

## Security notes

- The snapshot is plaintext. It lives in your cloud folder, which is already private to you. If you don't trust the storage layer (shared family iCloud? Dropbox folder shared with a team?), don't use that as your destination.
- `~/.claude.json` is excluded by default because it can contain MCP auth tokens. Opt in deliberately.
- Existing files on the destination machine are **safety-saved** before being overwritten — look for `*.pre-copycat-<timestamp>` files if you need to roll back.

## How does it compare?

| Tool | Transport | Encryption | Auto-schedule | Setup friction |
|---|---|---|---|---|
| copycat | Any cloud folder | None (relies on storage privacy) | ✅ macOS LaunchAgent | Low |
| [claude-code-sync](https://github.com/FelixIsaac/claude-code-sync) | Git + GitHub | age encryption | No | Medium (GitHub PAT + key) |
| [claude-code-backup](https://www.npmjs.com/package/claude-code-backup) | Git + GitHub | None (relies on repo privacy) | Manual | Medium |
| [claude-code-migrate](https://www.npmjs.com/package/claude-code-migrate) | SSH or local | None | No | Medium |
| Migration Assistant | macOS-native | Apple ID | N/A | High (brings everything, takes hours) |

`copycat` is the right choice if you want zero-credential setup and you already have a cloud folder synced.

## Contributing

Issues and PRs welcome. The package has no runtime dependencies (Node 18+ built-ins only).

## License

MIT
