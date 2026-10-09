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
  "function home(){",
  "const real=S.catalog.length,items=visibleCatalog()",
  "class=\"homeShowcase\"",
  "class=\"homeBookGrid\"",
  "some(sec=>sec.status==='published')",
  "publicVolumeIds",
  "✓ En biblioteca"
]) {
  if (!app.includes(required)) throw new Error("Novel display QA: falta " + required);
}
if (app.includes("x.demo?'Demo':'Publicada'")) throw new Error("Novel display QA: las tarjetas siguen ocultando el estado real.");

// Library collections DOM regression: never execute collectionsTab() inside a class attribute.
if (app.includes("class=\"\${S.libraryTab==='collections'?collectionsTab():''}")) throw new Error("Library collections: collectionsTab() volvió a filtrarse dentro del atributo class.");
if (!app.includes("\${S.libraryTab==='collections'?collectionsTab():''}")) throw new Error("Library collections: falta renderizado normal de la pestaña Colecciones.");
if (!app.includes("collectionEmptySaved")) throw new Error("Library collections: falta estado vacío visual de colecciones guardadas.");
for (const required of [
  'class="collectionEditor"',
  'class="collectionEditorHead"',
  'class="collectionFormSection"',
  'class="collectionVisibilitySwitch"',
  'class="collectionPreviewPanel"',
  'class="collectionPreviewCard"'
]) {
  if (!app.includes(required)) throw new Error("Library collections phase 1: falta " + required);
}
const collectionCss = fs.readFileSync("src/styles.css", "utf8");
for (const required of [".collectionEditor{",".collectionVisibilitySwitch{",".collectionPreviewPanel{",".collectionPreviewCard{"]) {
  if (!collectionCss.includes(required)) throw new Error("Library collections phase 1 CSS: falta " + required);
}
for (const required of [
  'function bindCollectionEditorPreview(){',
  'data-collection-color=',
  'id="collectionPreviewTitle"',
  'id="collectionPreviewDescription"',
  'id="collectionPreviewBadge"',
  'id="collectionPreviewCoverLabel"',
  'id="collectionColorValue"'
]) {
  if (!app.includes(required)) throw new Error("Library collections phase 2: falta " + required);
}
for (const required of [".collectionColorSwatches{",".collectionColorSwatch{",".collectionCustomColor{",".collectionPreviewAutoCover{"]) {
  if (!collectionCss.includes(required)) throw new Error("Library collections phase 2 CSS: falta " + required);
}
for (const required of [
  'class="collectionCoverGallery"',
  'data-collection-cover=',
  'id="collectionCover"',
  'class="collectionCoverChoice',
  'collectionCoverAutomatic'
]) {
  if (!app.includes(required)) throw new Error("Library collections phase 3: falta " + required);
}
for (const required of [".collectionCoverGallery{",".collectionCoverChoice{",".collectionCoverChoiceArt{",".collectionCoverAutomatic{"]) {
  if (!collectionCss.includes(required)) throw new Error("Library collections phase 3 CSS: falta " + required);
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
if (!/const CACHE='nlobi-shell-v\d+-\d+';/.test(sw)) throw new Error('Service worker: falta versión de caché válida');
for (const required of [
  "url.pathname.startsWith('/media/')",
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

// Pagination invariants for result sets that can grow beyond Supabase's API row cap.
if (!app.includes("async function jreqAllRows(")) throw new Error("Data pagination: falta helper paginado.");
const pagedQueryUses=(app.match(/jreqAllRows\(/g)||[]).length;
if (pagedQueryUses < 7) throw new Error("Data pagination: catálogo, equipos, biblioteca, progreso, capítulos leídos y Studio deben usar consultas paginadas.");
for (const fragment of [
  "jreqAllRows('/rest/v1/translations?select=id,title,status",
  "jreqAllRows('/rest/v1/translator_groups?select=id,name,slug",
  "jreqAllRows(\`/rest/v1/library_entries?user_id=eq.\${uid}",
  "jreqAllRows(\`/rest/v1/reading_progress?user_id=eq.\${uid}",
  "jreqAllRows('/rest/v1/read_sections?user_id=eq.'+uid",
  "S.studioTranslations=await jreqAllRows("
]) {
  if (!app.includes(fragment)) throw new Error("Data pagination: falta " + fragment);
}

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

if (!app.includes("async function hydrateEpubImages")) throw new Error("EPUB QA: falta hidratación de imágenes SVG/XLink.");
if (!app.includes("svg image,object[type^=\"image/\"]")) throw new Error("EPUB QA: faltan imágenes SVG/object.");
if (!app.includes("MAX_ARCHIVE_UNCOMPRESSED")) throw new Error("EPUB QA: falta protección de expansión.");
if (!css.includes(".studioHero{")) throw new Error("Studio QA: falta hero editorial.");
if (!css.includes(".importImageStrip{")) throw new Error("Studio QA: falta vista previa de ilustraciones importadas.");
if (!app.includes("parseEpub(file){return parseEpubRich(file)}")) throw new Error("EPUB QA: falta hook de fixture.");

if (!app.includes('id="projectTitle"')) throw new Error("Studio: falta edición del nombre de la obra.");
if (!app.includes("/rest/v1/rpc/update_translation_project_title")) throw new Error("Studio: renombrado no usa RPC transaccional.");
if (!app.includes("/rest/v1/rpc/publish_volume_with_sections")) throw new Error("Studio: publicación de volumen no publica capítulos en bloque.");
if (!app.includes("Publicación en bloque")) throw new Error("Studio: falta explicar publicación automática de capítulos.");

if (!app.includes('data-delete-volume=')) throw new Error("Studio delete: falta botón de borrar volumen.");
if (!app.includes('data-delete-section=')) throw new Error("Studio delete: falta botón de borrar capítulo.");
if (!app.includes('async function deleteStudioVolume')) throw new Error("Studio delete: falta lógica de volumen.");
if (!app.includes('async function deleteStudioSection')) throw new Error("Studio delete: falta lógica de capítulo.");
if (!app.includes('cleanupDeletedMedia')) throw new Error("Studio delete: falta limpieza de multimedia.");

if (!app.includes('id="deleteStudioProject"')) throw new Error("Studio project delete: falta acción de eliminación completa.");
if (!app.includes("async function deleteStudioProject")) throw new Error("Studio project delete: falta lógica de eliminación.");
if (!app.includes("loadNovelDeletionSnapshot")) throw new Error("Studio project delete: falta inventario de contenido/multimedia.");
if (!app.includes("Escribe ELIMINAR")) throw new Error("Studio project delete: falta confirmación fuerte.");
if (!app.includes("data-detail-back")) throw new Error("Detail navigation: falta botón Volver.");
if (!app.includes("detailBackRoute")) throw new Error("Detail navigation: falta ruta de regreso contextual.");
if (!css.includes(".dangerZone{")) throw new Error("Studio project delete: falta zona peligrosa visual.");
if (!css.includes(".detailBackBar{")) throw new Error("Detail navigation: falta estilo de regreso.");

if (!app.includes("posfacio.*|historia\\s+especial")) throw new Error("EPUB Calibre: faltan títulos especiales.");
if (!app.includes("Se omitió material preliminar anterior a la primera sección narrativa")) throw new Error("EPUB Calibre: falta recorte de front matter.");
if (!app.includes("importCanonicalText(docTitle)!==importCanonicalText(bookTitle)")) throw new Error("EPUB Calibre: no se evita el <title> repetido.");
if (!app.includes("detectImportSections(blocks,text='')")) throw new Error("EPUB Calibre: falta hook QA de secciones.");

// QA de regresión para perfiles públicos y gestión de equipos.
for (const marker of [
 'function publicGroupView(){',
 'id="teamPublicWorks"',
 'teamPublicEmpty',
 'id="teamPanel-identity"',
 'id="teamPanel-members"',
 'id="teamPanel-permissions"',
 'id="teamPanel-links"',
 'aria-controls="teamPanel-${key}"',
 'No puedes modificar tu propio rol desde esta sesión.',
 'No puedes retirarte a ti mismo desde esta sección.',
 'Introduce un enlace HTTPS válido.',
 'Introduce colores válidos en formato #RRGGBB.',
]) if (!app.includes(marker)) throw new Error(`Regresión de perfiles de equipo: ${marker}`);


// Reader personalization regression checks (pre-deploy gate).
{
  const required = [
    'function readSiteAppearance(){',
    'function readLibraryPreferences(){',
    'function resetLocalReaderUiPreferences(){',
    'async function syncReaderUiPreferences(){',
    "const UI_PREF_OWNER='nlobi_ui_prefs_owner'",
    "const UI_PREF_DIRTY='nlobi_ui_prefs_modified_at'",
    'data-site-header=', 'data-site-contrast=', 'data-site-motion=',
    'data-library-custom-toggle=', 'data-nav-visible=',
    'reader_ui_preferences?user_id=eq.',
    'previousOwner&&previousOwner!==uid',
    'libraryCustomization.hideCompleted',
  ];
  for (const marker of required) {
    if (!app.includes(marker)) throw new Error('Preferencias lector: falta '+marker);
  }
  const cssRules = ['data-site-header="auto"','data-site-contrast="high"','data-site-focus="enhanced"','.libraryShelf.libraryDensity-compact'];
  for (const marker of cssRules) {
    if (!css.includes(marker)) throw new Error('Estilos de preferencias: falta '+marker);
  }
  const appearanceSource = app.slice(app.indexOf('function readSiteAppearance(){'),app.indexOf('let siteAppearance='));
  const librarySource = app.slice(app.indexOf('function readLibraryPreferences(){'),app.indexOf('let libraryCustomization='));
  if (!appearanceSource.includes('return {') || !librarySource.includes('return{')) throw new Error('Preferencias: no se pueden aislar los analizadores.');
  const local = new Map();
  const localStorage = {getItem:(k)=>local.has(k)?local.get(k):null,setItem:(k,v)=>local.set(k,String(v)),removeItem:(k)=>local.delete(k)};
  const sandbox={localStorage,SITE_NAV_DEFAULT:['home','translators','explore','collections','library'],SITE_THEMES:{amber:'Ámbar',forest:'Bosque'},SITE_FONTS:{system:'Sistema',serif:'Serifa'},LIB_PREF_KEY:'nlobi_library_personalization'};
  vm.runInNewContext(appearanceSource+librarySource+';globalThis.readers={site:readSiteAppearance,library:readLibraryPreferences};',sandbox);
  const {site,library}=sandbox.readers;
  if(site().startPage!=='home'||site().navOrder.length!==5||library().view!=='grid') throw new Error('Preferencias: valores iniciales inválidos.');
  localStorage.setItem('nlobi_site_appearance',JSON.stringify({navOrder:['library','library','unknown'],hiddenNav:['home','library'],mode:'dark',startPage:'explore'}));
  const configured=site();
  if(configured.navOrder.join(',')!=='library,home,translators,explore,collections'||configured.hiddenNav.includes('home')||configured.mode!=='dark')throw new Error('Preferencias: normalización de menú fallida.');
  localStorage.setItem('nlobi_library_view','list');
  localStorage.setItem('nlobi_library_personalization',JSON.stringify({view:'grid',sort:'favorites',hideCompleted:true}));
  if(library().view!=='grid'||library().sort!=='favorites'||!library().hideCompleted)throw new Error('Preferencias: la vista guardada no prevalece.');
  localStorage.setItem('nlobi_site_appearance','{invalid');
  if(site().navOrder.length!==5)throw new Error('Preferencias: no se recupera JSON dañado.');
}
