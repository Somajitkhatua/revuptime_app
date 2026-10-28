const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const folders = [
  "app", "assets", "components", "constants", "data", "hooks", "providers",
  "services", "types", "utils",
];
const files = [
  "app.json", "eas.json", "package.json", "package-lock.json", "tsconfig.json",
  "expo-env.d.ts", "metro.config.cjs", ".easignore", ".gitignore",
];

async function main() {
  const version = JSON.parse(await fs.readFile(path.join(root, "app.json"), "utf8")).expo.version;
  // Keep the upload source outside both the workspace and EAS's own temp tree.
  // Copy mobile sources only: no local environment files or provider secrets.
  const staging = await fs.mkdtemp(path.join(os.tmpdir(), `revuptime-${version}-`));
  for (const entry of [...folders, ...files]) {
    await fs.cp(path.join(root, entry), path.join(staging, entry), { recursive: true });
  }
  // Local config resolution needs installed dependencies; the junction is
  // excluded by .easignore and dependencies are installed afresh by EAS Build.
  await fs.symlink(path.join(root, "node_modules"), path.join(staging, "node_modules"), "junction");
  const hashes = {};
  async function record(directory, prefix = "") {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules") continue;
      const relative = `${prefix}${entry.name}`;
      const source = path.join(directory, entry.name);
      if (entry.isDirectory()) await record(source, `${relative}/`);
      else if (entry.isFile()) {
        const original = await fs.readFile(path.join(root, relative));
        const staged = await fs.readFile(source);
        if (!original.equals(staged)) throw new Error(`Staging differs: ${relative}`);
        hashes[relative] = crypto.createHash("sha256").update(staged).digest("hex");
      }
    }
  }
  await record(staging);
  await fs.mkdir(path.join(root, "output"), { recursive: true });
  await fs.writeFile(path.join(root, "output", `release-${version}-staging.json`), JSON.stringify({
    version, staging, createdAt: new Date().toISOString(), fileCount: Object.keys(hashes).length, hashes,
  }, null, 2));
  console.log(JSON.stringify({ staging, fileCount: Object.keys(hashes).length }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
