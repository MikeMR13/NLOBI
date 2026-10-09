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
fs.copyFileSync(path.join(root, "src", "activate-styles.js"), path.join(dist, "assets", "activate-styles.js"));

for (const file of ["manifest.webmanifest", "sw.js", "icon.svg",
  "icon-192.png", "icon-512.png"]) {
  fs.copyFileSync(path.join(root, "public", file), path.join(dist, file));
}

const config = spawnSync(process.execPath, [path.join(root, "scripts", "generate-config.mjs"), dist], {
  stdio: "inherit",
  env: process.env,
});
if (config.status !== 0) process.exit(config.status ?? 1);

console.log(`Built NLOBI into ${dist}`);

/* Build output verification */
const requiredBuiltFiles = [
  "index.html",
  "assets/styles.css",
  "assets/app.js",
  "runtime-config.js",
  "sw.js",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
];
for (const rel of requiredBuiltFiles) {
  const full = path.join(dist, rel);
  if (!fs.existsSync(full)) throw new Error(`Build incompleto: falta dist/${rel}`);
}
const builtSw = fs.readFileSync(path.join(dist, "sw.js"), "utf8");
for (const route of ["/assets/styles.css","/assets/app.js","/runtime-config.js"]) {
  if (!builtSw.includes(route)) throw new Error(`Service Worker no referencia el asset construido: ${route}`);
}
for (const wrong of ["'/styles.css'","'/app.js'"]) {
  if (builtSw.includes(wrong)) throw new Error(`Service Worker referencia una ruta obsoleta: ${wrong}`);
}
console.log("Build output verification OK");
