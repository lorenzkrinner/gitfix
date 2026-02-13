import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
let ngrokDomain = process.env.NGROK_DOMAIN;

if (!ngrokDomain && existsSync(envPath)) {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^\s*NGROK_DOMAIN\s*=\s*(.+?)\s*$/);
    if (match) {
      ngrokDomain = match[1].replace(/^["']|["']$/g, "").trim();
      break;
    }
  }
}

const args = ["http", "http://localhost:3000"];
if (ngrokDomain) {
  args.push("--domain", ngrokDomain);
}

const proc = spawn("ngrok", args, { stdio: "inherit", shell: true });
proc.on("exit", (code) => process.exit(code ?? 0));
