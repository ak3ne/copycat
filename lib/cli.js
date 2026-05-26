import { cmdInit } from "./cmd-init.js";
import { cmdSnapshot } from "./cmd-snapshot.js";
import { cmdRestore } from "./cmd-restore.js";
import { cmdSchedule } from "./cmd-schedule.js";
import { cmdStatus } from "./cmd-status.js";

const HELP = `copycat — snapshot and restore your Claude Code brain across machines

Usage:
  copycat init                 Detect cloud folders, set up config interactively
  copycat snapshot             Create a snapshot using current config
  copycat restore              Preflight (dry-run). Add --yes to actually restore.
  copycat schedule             Install auto-snapshot schedule (biweekly default)
  copycat status               Show current config, snapshot freshness, schedule
  copycat help                 Show this help

Common flags:
  --config <path>     Use a config file at a custom path (default ~/.copycat/config.json)
  --yes, -y           For 'restore': actually apply (default is dry-run)
  --include-secrets   For 'snapshot' / 'restore': include ~/.claude.json (may contain tokens)
  --interval <kind>   For 'schedule': biweekly | monthly | weekly  (default biweekly)
  --help, -h          Show command help

Examples:
  npx @copycat/cli init                # first-time setup
  npx @copycat/cli snapshot            # make a snapshot now
  npx @copycat/cli restore             # on a new machine: dry-run check
  npx @copycat/cli restore --yes       # on a new machine: actually restore
  npx @copycat/cli schedule            # install biweekly auto-snapshot

Environment:
  DEBUG=1             Print full stack traces on errors
`;

export async function main(argv) {
  if (argv.length === 0 || argv[0] === "help" || argv[0] === "--help" || argv[0] === "-h") {
    console.log(HELP);
    return;
  }
  const [cmd, ...rest] = argv;
  const opts = parseOpts(rest);

  switch (cmd) {
    case "init":      await cmdInit(opts); break;
    case "snapshot":  await cmdSnapshot(opts); break;
    case "restore":   await cmdRestore(opts); break;
    case "schedule":  await cmdSchedule(opts); break;
    case "status":    await cmdStatus(opts); break;
    default:
      console.error(`copycat: unknown command "${cmd}"\n`);
      console.log(HELP);
      process.exit(2);
  }
}

function parseOpts(rest) {
  const opts = { _: [] };
  for (let i = 0; i < rest.length; i++) {
    const tok = rest[i];
    if (tok === "--yes" || tok === "-y") opts.yes = true;
    else if (tok === "--include-secrets") opts.includeSecrets = true;
    else if (tok === "--config") opts.config = rest[++i];
    else if (tok === "--interval") opts.interval = rest[++i];
    else if (tok === "--dest") opts.dest = rest[++i];
    else if (tok === "--help" || tok === "-h") opts.help = true;
    else opts._.push(tok);
  }
  return opts;
}
