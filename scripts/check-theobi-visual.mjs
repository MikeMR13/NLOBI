import assert from "node:assert/strict";
import fs from "node:fs";

const css=fs.readFileSync("src/styles.css","utf8");
const html=fs.readFileSync("src/index.html","utf8");
const loader=fs.readFileSync("src/activate-styles.js","utf8");
const marker="/* THEOBIPROJECT — adaptación editorial visual";
assert.ok(css.includes(marker),"Falta integración de THEOBIPROJECT");
const theme=css.slice(css.indexOf(marker));
for(const token of ["--theobi-ink:#0d0c0a","--theobi-paper:#f3ecd9",
  "--theobi-gold:#f2c230","--theobi-display:","body.dark{",
  ".homeEditorial .homeShowcase",".volumeGalleryCard",".detailEditorialHero",
  ".studioV3 .studioV3Sidebar","@media(prefers-reduced-motion:reduce)",
  "@media(forced-colors:active)"]){
  assert.ok(theme.includes(token),`Falta token o protección editorial: ${token}`);
}
assert.ok(!theme.includes(".readerPaper{"),"La capa THEOBI no debe cambiar el documento del lector");
assert.ok(!theme.includes(".reader-font-"),"La capa THEOBI no debe reemplazar fuentes EPUB");
assert.ok(html.includes('id="theobiFonts"')&&html.includes('media="print" id="theobiFonts"'),
 "Las fuentes editoriales deben cargarse de forma no bloqueante");
assert.ok(loader.includes("enable('theobiFonts')"),"No se habilitaron fuentes tras cargar");
assert.ok(html.includes("El preload de la portada guardada debe descubrirse"),
 "Se perdió la pista LCP del inicio");
assert.ok(html.includes("home-cover-hint.js"),"La pista de portada LCP no debe desaparecer");
assert.ok(css.includes("html[data-site-motion=\"reduce\"]"),"Falta respetar reducir movimiento");
assert.ok(css.includes(".readerExperience.readerPresentation-editorial"),"Falta presentación existente del lector");
console.log("THEOBIPROJECT visual QA OK");
