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

// Accessibility pass 3 invariants
const css = fs.readFileSync("src/styles.css", "utf8");
for (const required of [
  "--accentText:",
  "/* ACCESSIBILITY PASS 3",
  "@media(max-width:320px)",
  "@media(forced-colors:active)",
  "overflow-x:clip",
  "grid-template-columns:1fr!important"
]) {
  if (!css.includes(required)) throw new Error(`Accessibility pass 3: falta ${required}`);
}

// Accessibility pass 4 invariants
const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");
for (const required of [
  "axe accessibility audit",
  "@axe-core/cli@4.13.0",
  "aria-label=\"Mover ",
  "aria-labelledby=\"blockLabel-",
  "Texto alternativo",
  "Vista previa de la ilustración"
]) {
  const hay = required.includes("axe") || required.includes("@axe") ? workflow.includes(required) : app.includes(required);
  if (!hay) throw new Error(`Accessibility pass 4: falta ${required}`);
}

// Deep links and service worker invariants
const sw = fs.readFileSync("public/sw.js", "utf8");
for (const required of [
  "async function resolveDynamicRoute(",
  "loadPublicGroupData(",
  "loadPublicProfileData(",
  "loadReaderRouteData(",
  "await resolveDynamicRoute(S.view)",
  "window.addEventListener('hashchange',async()=>"
]) {
  if (!app.includes(required)) throw new Error(`Deep links: falta ${required}`);
}
for (const required of [
  "nlobi-shell-v19-6",
  "'/assets/app.js'",
  "'/assets/styles.css'",
  "'/runtime-config.js'",
  "cache:'no-store'",
  "self.skipWaiting()",
  "self.clients.claim()"
]) {
  if (!sw.includes(required)) throw new Error(`Service worker: falta ${required}`);
}

// Session refresh invariants
for (const required of [
  "function persistSession(",
  "async function refreshSession(){",
  "async function ensureFreshSession(){",
  "nlobi_refresh_token",
  "grant_type=refresh_token"
]) {
  if (!app.includes(required)) throw new Error(`Auth refresh: falta ${required}`);
}
const pkg = JSON.parse(fs.readFileSync("package.json","utf8"));
if (pkg.engines?.node !== "22.x") throw new Error("Node debe quedar fijado en 22.x");

// Storage refresh invariants
for (const required of [
  "await ensureFreshSession();",
  "/auth/v1/logout"
]) {
  if (!app.includes(required)) throw new Error(`Auth/Storage refresh: falta ${required}`);
}

// Japanese logo icon invariants
const indexHtml = fs.readFileSync("src/index.html","utf8");
const manifest = fs.readFileSync("public/manifest.webmanifest","utf8");
const iconSvg = fs.readFileSync("public/icon.svg","utf8");
for (const required of [
  'href="/icon.svg"',
  '<span class="brandMark" aria-hidden="true">オ</span>'
]) {
  const source = required.startsWith('href=') ? indexHtml : app;
  if (!source.includes(required)) throw new Error(`Brand icon: falta ${required}`);
}
if (!manifest.includes('"src": "/icon.svg"')) throw new Error("Brand icon: manifest no usa /icon.svg");
if (!iconSvg.includes(">オ</text>")) throw new Error("Brand icon: SVG no contiene オ");
