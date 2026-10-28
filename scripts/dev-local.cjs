const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const children = [];
let stopping = false;

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) child.kill();
}

function start(args) {
  const child = spawn(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 1);
  });
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

async function available(url, check) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    return response.ok && await check(response);
  } catch {
    return false;
  }
}

async function main() {
  const [aiRunning, previewRunning] = await Promise.all([
    available("http://127.0.0.1:8787/health", async response => (await response.json()).status === "ok"),
    available("http://localhost:8082/status", async response => (await response.text()).includes("packager-status:running")),
  ]);
  if (stopping) return;
  if (aiRunning) console.log("Reusing local AI backend at http://127.0.0.1:8787");
  else start([
    "--env-file=.env",
    "--env-file=.env.ai.local",
    "--import", "tsx",
    "scripts/ai-local-server.ts",
  ]);
  if (previewRunning) console.log("Reusing app preview at http://localhost:8082");
  else start([require.resolve("expo/bin/cli"), "start", "--web", "--port", "8082"]);
}
main().catch(error => { console.error(error.message); stop(1); });
