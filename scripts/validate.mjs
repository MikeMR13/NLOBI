import fs from "node:fs";
import { spawnSync } from "node:child_process";

const mustExist = [
  "src/index.html",
  "src/styles.css",
  "src/app.js",
  "public/manifest.webmanifest",
  "public/sw.js",
  "vercel.json",
];

for (const file of mustExist) {
  if (!fs.existsSync(file)) throw new Error(`Falta ${file}`);
}

for (const file of ["src/app.js", "public/sw.js", "scripts/build.mjs", "scripts/generate-config.mjs", "scripts/validate.mjs"]) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

JSON.parse(fs.readFileSync("public/manifest.webmanifest", "utf8"));
JSON.parse(fs.readFileSync("vercel.json", "utf8"));
JSON.parse(fs.readFileSync("package.json", "utf8"));

const html = fs.readFileSync("src/index.html", "utf8");
for (const marker of [
  "/assets/styles.css",
  "/runtime-config.js",
  "/assets/app.js",
  "NLOBI_BETA19_ARCHITECTURE",
]) {
  if (!html.includes(marker)) throw new Error(`Index no contiene ${marker}`);
}

const app = fs.readFileSync("src/app.js", "utf8");
if (app.includes("const KEY='") || app.includes("const URL='https://")) {
  throw new Error("La configuración runtime sigue incrustada en app.js.");
}

console.log("Validation OK");