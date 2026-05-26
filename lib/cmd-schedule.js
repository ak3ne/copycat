import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { HOME, isMac, isLinux } from "./platform.js";
import { loadConfig } from "./config.js";

const LABEL = "com.copycat.snapshot";

export async function cmdSchedule(opts) {
  loadConfig(opts); // throws helpful error if not configured
  const interval = opts.interval || "biweekly";

  if (isMac()) {
    installMacLaunchAgent(interval);
  } else if (isLinux()) {
    printLinuxInstructions(interval);
  } else {
    throw new Error(`copycat schedule is not yet supported on ${process.platform}`);
  }
}

function installMacLaunchAgent(interval) {
  const calendars = scheduleCalendars(interval);
  const npxPath = process.execPath; // node binary
  // Resolve where copycat lives (this file: lib/cmd-schedule.js → ../bin/copycat.js)
  const cliPath = path.resolve(new URL("../bin/copycat.js", import.meta.url).pathname);

  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${LABEL}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${npxPath}</string>
        <string>${cliPath}</string>
        <string>snapshot</string>
    </array>
    <key>StartCalendarIntervals</key>
    <array>
${calendars.map(c => `        <dict>
            <key>Day</key><integer>${c.day}</integer>
            <key>Hour</key><integer>${c.hour}</integer>
            <key>Minute</key><integer>${c.minute}</integer>
        </dict>`).join("\n")}
    </array>
    <key>RunAtLoad</key>
    <false/>
    <key>StandardOutPath</key>
    <string>${HOME}/.copycat/snapshot.log</string>
    <key>StandardErrorPath</key>
    <string>${HOME}/.copycat/snapshot.log</string>
</dict>
</plist>
`;

  mkdirSync(path.join(HOME, ".copycat"), { recursive: true });
  const plistPath = path.join(HOME, "Library/LaunchAgents", `${LABEL}.plist`);
  writeFileSync(plistPath, plist);

  // Reload
  spawnSync("launchctl", ["bootout", `gui/${process.getuid()}/${LABEL}`]);
  const r = spawnSync("launchctl", ["bootstrap", `gui/${process.getuid()}`, plistPath]);
  if (r.status !== 0) {
    throw new Error(`launchctl bootstrap failed (exit ${r.status}): ${r.stderr?.toString().trim()}`);
  }
  console.log(`✓ installed LaunchAgent ${LABEL}`);
  console.log(`  plist: ${plistPath}`);
  console.log(`  schedule: ${describeSchedule(interval, calendars)}`);
  console.log(`  log: ~/.copycat/snapshot.log`);
}

function scheduleCalendars(interval) {
  switch (interval) {
    case "weekly":   return [{ day: 1, hour: 22, minute: 0 }, { day: 8,  hour: 22, minute: 0 }, { day: 15, hour: 22, minute: 0 }, { day: 22, hour: 22, minute: 0 }];
    case "biweekly": return [{ day: 1, hour: 22, minute: 0 }, { day: 15, hour: 22, minute: 0 }];
    case "monthly":  return [{ day: 1, hour: 22, minute: 0 }];
    default: throw new Error(`unknown interval: ${interval}. Try: weekly | biweekly | monthly`);
  }
}

function describeSchedule(interval, calendars) {
  return `${interval} (${calendars.map(c => `day ${c.day} @ ${String(c.hour).padStart(2,"0")}:${String(c.minute).padStart(2,"0")}`).join(", ")})`;
}

function printLinuxInstructions(interval) {
  console.log("copycat schedule on Linux: install a user systemd timer.\n");
  console.log("1. Create the service unit at ~/.config/systemd/user/copycat-snapshot.service:");
  console.log("");
  console.log("    [Unit]");
  console.log("    Description=copycat snapshot");
  console.log("    [Service]");
  console.log(`    ExecStart=${process.execPath} ${path.resolve(new URL("../bin/copycat.js", import.meta.url).pathname)} snapshot`);
  console.log("");
  console.log(`2. Create the timer at ~/.config/systemd/user/copycat-snapshot.timer (interval: ${interval}):`);
  console.log("");
  console.log("    [Unit]");
  console.log("    Description=copycat snapshot timer");
  console.log("    [Timer]");
  console.log(`    OnCalendar=${linuxOnCalendar(interval)}`);
  console.log("    Persistent=true");
  console.log("    [Install]");
  console.log("    WantedBy=timers.target");
  console.log("");
  console.log("3. Enable: systemctl --user daemon-reload && systemctl --user enable --now copycat-snapshot.timer");
}

function linuxOnCalendar(interval) {
  switch (interval) {
    case "weekly":   return "Mon 22:00";
    case "biweekly": return "*-*-01,15 22:00:00";
    case "monthly":  return "*-*-01 22:00:00";
    default: throw new Error(`unknown interval: ${interval}`);
  }
}
