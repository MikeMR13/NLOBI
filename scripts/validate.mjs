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
for (const requiredFn of ["function render(){","function detailView(){","function publicGroupView(){","function readerView(){","function htmlNodesToBlocks(","function pdfTextLines(","function revisionHistoryPanel(){","function revisionPreviewPanel(){","async function cleanupOrphanMedia(){","async function storageSelfTest(){"]) { if (!app.includes(requiredFn)) throw new Error(`Falta función crítica: ${requiredFn}`); }

if (app.includes("const KEY='") || app.includes("const URL='https://")) {
  throw new Error("La configuración runtime sigue incrustada en app.js.");
}

console.log("Validation OK");
if (/(^|[^$])\$\('\[data-[^']+'\)\.forEach/m.test(app)) throw new Error("Selector simple usado con forEach; usa $() para NodeList.");

// Accessibility pass 1 invariants
if (!app.includes("function enhanceAccessibility(){")) throw new Error("Accessibility pass 1: falta gestión de foco/landmarks.");
if (!app.includes('aria-current="page"')) throw new Error("Accessibility pass 1: falta aria-current en navegación.");
if (!app.includes('class="spoiler spoilerButton"')) throw new Error("Accessibility pass 1: spoilers no son operables semánticamente.");
if (!html.includes('id="routeAnnouncer"')) throw new Error("Accessibility pass 1: falta anunciador de rutas.");

// Accessibility pass 2 invariants
for (const required of [
  'aria-labelledby="chapterTitle"',
  'aria-label="Navegación entre capítulos"',
  'id="readerLineHeight"',
  'id="readerFontFamily"',
  'id="readerParagraphSpace"',
  'function resetReaderPrefs(){',
  '<ruby>',
  '<rp>(',
  'Ilustración del capítulo'
]) {
  if (!app.includes(required)) throw new Error(`Accessibility pass 2: falta ${required}`);
}
