import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "assets"), { recursive: true });

fs.copyFileSync(path.join(root, "src", "index.html"), path.join(dist, "index.html"));
fs.copyFileSync(path.join(root, "src", "styles.css"), path.join(dist, "assets", "styles.css"));
fs.copyFileSync(path.join(root, "src", "app.js"), path.join(dist, "assets", "app.js"));

for (const file of ["manifest.webmanifest", "sw.js", "icon-192.png", "icon-512.png"]) {
  fs.copyFileSync(path.join(root, "public", file), path.join(dist, file));
}

const config = spawnSync(process.execPath, [path.join(root, "scripts", "generate-config.mjs"), dist], {
  stdio: "inherit",
  env: process.env,
});
if (config.status !== 0) process.exit(config.status ?? 1);

console.log(`Built NLOBI into ${dist}`);