import fs from "node:fs";
import { spawnSync } from "node:child_process";
import vm from "node:vm";

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



// Importer heuristics fixtures
{
  const start = app.indexOf("function normalizeSectionHeadingText(");
  const end = app.indexOf("function detectSectionsRich(", start);
  if (start < 0 || end < 0) throw new Error("Importer QA: no se pudieron aislar las heurísticas.");
  const sandbox = {};
  vm.runInNewContext(app.slice(start, end) + ";globalThis.__qa={normalizeSectionHeadingText,detectSectionType,isSectionHeading};", sandbox);
  const qa = sandbox.__qa;
  const headings = ["第１章 夏祭り","第一話 はじまり","序章","終章","幕間","閑話","外伝","短編","特別編","書き下ろし","後日談","Capítulo 12","Episode 3"];
  for (const title of headings) if (!qa.isSectionHeading(title)) throw new Error("Importer QA: no reconoce encabezado " + title);
  const nonHeadings = ["今日は学校へ行った。","これは普通の本文です。","「第1章って何？」と彼女は聞いた。"];
  for (const text of nonHeadings) if (qa.isSectionHeading(text)) throw new Error("Importer QA: falso positivo de encabezado " + text);
  if (qa.normalizeSectionHeadingText("第１章　夏") !== "第1章 夏") throw new Error("Importer QA: NFKC/espacios CJK incorrectos.");
  if (qa.detectSectionType("閑話") !== "interlude") throw new Error("Importer QA: 閑話 debe ser interlude.");
  if (qa.detectSectionType("書き下ろし短編") !== "extra") throw new Error("Importer QA: 書き下ろし debe ser extra.");
}

for (const required of [
  "function importFingerprint(",
  "async function rollbackImportedPaths(",
  "backup_sections",
  "skipped_duplicates",
  "function epubUtilityKind(",
  "function studioSectionStats("
]) {
  if (!app.includes(required)) throw new Error("Importer hardening: falta " + required);
}



for (const required of [
  "const translationStatusLabel=",
  "function libraryButton(",
  "visibleCatalog().slice(0,8)",
  "some(sec=>sec.status==='published')",
  "publicVolumeIds",
  "✓ En biblioteca"
]) {
  if (!app.includes(required)) throw new Error("Novel display QA: falta " + required);
}
if (app.includes("x.demo?'Demo':'Publicada'")) throw new Error("Novel display QA: las tarjetas siguen ocultando el estado real.");

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
  "@axe-core/playwright@4.13.0",
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

// Playwright axe runner invariant
if (!fs.existsSync("scripts/axe-check.mjs")) throw new Error("Accessibility CI: falta scripts/axe-check.mjs");
if (!fs.existsSync("scripts/layout-check.mjs")) throw new Error("Visual QA: falta scripts/layout-check.mjs");
if (!fs.existsSync("scripts/full-quality-check.mjs")) throw new Error("Full QA: falta scripts/full-quality-check.mjs");
if (!fs.existsSync("scripts/cross-browser-check.mjs")) throw new Error("Cross-browser QA: falta scripts/cross-browser-check.mjs");
if (!workflow.includes("Visual layout audit")) throw new Error("Visual QA: falta auditoría responsive en CI");
if (!workflow.includes("Full platform quality pass")) throw new Error("Full QA: falta pase integral en CI");
if (!workflow.includes("Cross-browser smoke")) throw new Error("Cross-browser QA: falta smoke Firefox/WebKit en CI");
if (!workflow.includes("playwright@1.63.0") || !workflow.includes("@axe-core/playwright@4.13.0")) {
  throw new Error("Accessibility CI: versiones Playwright/axe no están fijadas");
}

if (!app.includes("mediaTargetLabel(t){if(!t)")) throw new Error("Full QA: mediaTargetLabel no tolera destino vacío.");
if (!app.includes("authShell betaFeedbackShell")) throw new Error("Full QA: feedback Beta conserva layout inline no responsive.");
if (!app.includes("CONFIG.qaMode===true")) throw new Error("Full QA: falta hook de QA protegido por configuración.");
if (!css.includes(".betaFeedbackShell{grid-template-columns:.7fr 1.3fr}")) throw new Error("Full QA: falta estilo responsive de feedback Beta.");

if (!app.includes("MAX_IMPORT_BYTES=80*1024*1024")) throw new Error("Import security: falta límite global de 80 MB.");
if (!app.includes("MAX_ARCHIVE_UNCOMPRESSED=300*1024*1024")) throw new Error("Import security: falta límite de expansión ZIP.");
if (!app.includes("const safeCssUrl=")) throw new Error("CSS security: falta normalizador de URL para contexto CSS.");
if (!app.includes("/rest/v1/rpc/create_translation_project")) throw new Error("Integrity: creación de proyecto no usa RPC atómico.");

if (!app.includes("/auth/v1/signup?redirect_to=")) throw new Error("Auth email: signup no fija redirect_to.");
if (!app.includes("/auth/v1/resend?redirect_to=")) throw new Error("Auth email: falta reenvío de verificación.");
if (!app.includes("id=\"resendVerification\"")) throw new Error("Auth email: falta control de reenvío.");

if (!app.includes("function consumeAuthCallback()")) throw new Error("Auth email: falta consumir callback de confirmación.");
if (!app.includes("sessionStorage.setItem('nlobi_auth_notice'")) throw new Error("Auth email: falta feedback del callback.");
if (app.includes("location.origin+'/#auth'")) throw new Error("Auth email: redirect_to no debe usar el hash de rutas.");
