import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, "assets"), { recursive: true });

fs.copyFileSync(path.join(root, "src", "index.html"), path.join(dist, "index.html"));
fs.copyFileSync(path.join(root, "src", "styles.css"), path.join(dist, "assets", "styles.css"));
fs.copyFileSync(path.join(root, "src", "app.js"), path.join(dist, "assets", "app.js"));
fs.copyFileSync(path.join(root, "src", "studio-phase7.js"), path.join(dist, "assets", "studio-phase7.js"));
fs.copyFileSync(path.join(root, "src", "studio-phase6.js"), path.join(dist, "assets", "studio-phase6.js"));
fs.copyFileSync(path.join(root, "src", "studio-phase5.js"), path.join(dist, "assets", "studio-phase5.js"));
fs.copyFileSync(path.join(root, "src", "activate-styles.js"), path.join(dist, "assets", "activate-styles.js"));
fs.copyFileSync(path.join(root, "src", "home-cover-hint.js"), path.join(dist, "assets", "home-cover-hint.js"));
fs.copyFileSync(path.join(root, "src", "initial-home.js"), path.join(dist, "assets", "initial-home.js"));

for (const file of ["manifest.webmanifest", "sw.js", "icon.svg",
  "icon-192.png", "icon-512.png"]) {
  fs.copyFileSync(path.join(root, "public", file), path.join(dist, file));
}

// Inmutabilidad por contenido: la URL cambia cuando el asset cambia.
// Evita recibir CSS/JS obsoleto y permite servir caché directa entre visitas.
const versionedAssets=["assets/app.js","assets/styles.css","assets/activate-styles.js","assets/home-cover-hint.js","assets/initial-home.js"];
const versions=new Map(versionedAssets.map(name=>[
 name,createHash("sha256").update(fs.readFileSync(path.join(dist,name))).digest("hex").slice(0,12)
]));
const manifestVersion=createHash("sha256").update([...versions.values()].join(":")).digest("hex").slice(0,12);
const indexPath=path.join(dist,"index.html");
let builtHtml=fs.readFileSync(indexPath,"utf8");
for(const [file,digest] of versions){
 const resource="/"+file;
 const needle=new RegExp(resource.replaceAll(".","\\.")+"(?:\\?v=[A-Za-z0-9_-]+)?","g");
 builtHtml=builtHtml.replace(needle,resource+"?v="+digest);
}
fs.writeFileSync(indexPath,builtHtml);
const swPath=path.join(dist,"sw.js");
let builtWorker=fs.readFileSync(swPath,"utf8");
builtWorker=builtWorker.replace(/const CACHE='([^']+)'/,(_all,name)=>"const CACHE='"+name+"-"+manifestVersion+"'");
for(const [file,digest] of versions){
 const resource="/"+file;
 const quoted="'"+resource+"'";
 const coreStart=builtWorker.indexOf("const CORE=[");
 const coreEnd=builtWorker.indexOf("];",coreStart);
 if(coreStart<0||coreEnd<0)throw new Error("Service Worker CORE no disponible");
 const first=builtWorker.slice(coreStart,coreEnd).replace(quoted,"'"+resource+"?v="+digest+"'");
 builtWorker=builtWorker.slice(0,coreStart)+first+builtWorker.slice(coreEnd);
}
fs.writeFileSync(swPath,builtWorker);

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
  "assets/home-cover-hint.js",
  "assets/initial-home.js",
  "assets/studio-phase7.js",
  "assets/studio-phase6.js",
  "assets/studio-phase5.js",
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
for (const route of ["/assets/styles.css","/assets/app.js","/assets/home-cover-hint.js","/assets/initial-home.js","/runtime-config.js","/assets/studio-phase5.js"]) {
  if (!builtSw.includes(route)) throw new Error(`Service Worker no referencia el asset construido: ${route}`);
}
for (const wrong of ["'/styles.css'","'/app.js'"]) {
  if (builtSw.includes(wrong)) throw new Error(`Service Worker referencia una ruta obsoleta: ${wrong}`);
}
console.log("Build output verification OK");
