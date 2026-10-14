import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';

const css=fs.readFileSync('src/styles.css','utf8');
const app=fs.readFileSync('src/app.js','utf8');
const editorial=css.split('/* OBI EDITORIAL COLLECTIONS — FASE 2')[1];
assert.ok(editorial,'Falta el sistema de colecciones editoriales fase 2');
assert.match(editorial,/\.obiShelf-recent\s+\.discoverShelfHead::before/);
assert.match(editorial,/\.obiShelf-popular\s+\.discoverShelfHead::before/);
assert.match(editorial,/\.obiShelf-complete\s+\.discoverShelfHead::before/);
assert.match(editorial,/\.libraryEditorial\s+\.libraryShelfCard/);
assert.match(editorial,/\.exploreEditorial\s+\.exploreShowcase/);
assert.match(editorial,/prefers-reduced-motion:reduce/);
assert.match(editorial,/forced-colors:active/);
assert.doesNotMatch(editorial,/object-fit\s*:\s*cover/i,
 'No recortar portadas: prevalece object-fit:contain del sistema literario compartido');
assert.doesNotMatch(editorial,/@import|url\(\s*['"]?https?:/i);
assert.ok(app.includes('class="discoverShelf obiShelf-${slug}"'), 'Faltan etiquetas de sección en Home');
// Conservación funcional: no reemplazar tarjetas ni eliminar la carga progresiva.
assert.ok(app.includes('visibleCatalogBatch('));
assert.ok(app.includes('data-catalog-more="explore"'));
assert.ok(app.includes('data-catalog-more="library"'));
assert.ok(app.includes('libraryShelfCard'));
assert.ok(app.includes('exploreQuickGenres'));
const fixture="<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<link rel=\"stylesheet\" href=\"/assets/styles.css\"></head><body>\n<main class=\"wrap homeEditorial\" id=\"homeTest\">\n<section class=\"homeShowcase\"><div class=\"homeShowcaseCopy\"><span class=\"homeEyebrow\">EL OBI DEL LECTOR</span><h1>Abre un libro.</h1></div></section>\n<section class=\"discoverShelf obiShelf-recent\" aria-label=\"Actualizadas recientemente\">\n<div class=\"discoverShelfHead\"><div><span class=\"homeSectionKicker\">LO MÁS RECIENTE</span><h2>Actualizadas recientemente</h2></div></div>\n<div class=\"discoverShelfTrack\"><article class=\"novelCard catalogEditorialCard\"><a class=\"catalogCoverButton\" href=\"#detail:sample\" aria-label=\"Abrir novela de ejemplo\"><span class=\"catalogBookArt\"><span class=\"catalogCoverFallback\"><span>物語</span><strong>Libro de ejemplo</strong></span></span></a><div class=\"catalogCardContent\"><h3>Libro de ejemplo</h3></div></article></div></section>\n<section class=\"discoverShelf obiShelf-popular\" aria-label=\"Las más populares\"><div class=\"discoverShelfHead\"><div><h2>Las más populares</h2></div></div></section>\n<section class=\"discoverShelf obiShelf-complete\" aria-label=\"Novelas completas\"><div class=\"discoverShelfHead\"><div><h2>Novelas completas</h2></div></div></section>\n<section class=\"homeEditorialSection\"><div class=\"homeBookGrid\"><article class=\"homeBookCard\"><a class=\"homeBookCover\" href=\"#detail:sample\"><span>Portada</span></a><div class=\"homeBookDetails\"><h3>Una historia</h3></div></article></div></section>\n</main>\n<main class=\"wrap exploreEditorial\" id=\"exploreTest\"><section class=\"exploreShowcase\"><div class=\"exploreShowcaseIntro\"><span class=\"exploreEyebrow\">EL OBI DEL LECTOR / CATÁLOGO</span><span class=\"exploreKanji\" aria-hidden=\"true\">探</span></div><h1>Explora nuevas historias.</h1><div class=\"exploreSearchWrap\"><input type=\"search\" aria-label=\"Buscar novelas\" placeholder=\"Buscar...\"></div><div class=\"exploreQuickGenres\"><button type=\"button\" class=\"exploreGenreQuick active\" aria-pressed=\"true\">Todas</button></div></section>\n<div class=\"exploreResultsBar\"><span>1 novela encontrada</span></div><div class=\"exploreNovelGrid novelGrid\"><article class=\"catalogEditorialCard novelCard\"><a class=\"catalogCoverButton\" href=\"#detail:sample\" aria-label=\"Abrir novela de ejemplo\"><span class=\"catalogBookArt\"><span class=\"catalogCoverFallback\"><span>物語</span><strong>Novela de ejemplo</strong></span></span></a><div class=\"catalogCardContent\"><span class=\"catalogStatusTag\">Traducción activa</span><h3>Novela de ejemplo</h3></div></article></div>\n</main>\n<main class=\"wrap libraryEditorial\" id=\"libraryTest\"><section class=\"libraryShowcase\"><div class=\"libraryShowcaseTop\"><span class=\"libraryEyebrow\">EL OBI DEL LECTOR / MI ESPACIO</span><span class=\"libraryMark\" aria-hidden=\"true\">本</span></div><h1>Mi biblioteca</h1></section>\n<nav class=\"libraryTabs\" aria-label=\"Secciones de biblioteca\"><button class=\"active\" type=\"button\">Mis novelas</button></nav>\n<div class=\"libraryShelfTools\"><input type=\"search\" aria-label=\"Buscar en biblioteca\"><select aria-label=\"Ordenar biblioteca\"><option>Recientes</option></select></div>\n<div class=\"libraryShelf\"><article class=\"libraryShelfCard\"><button type=\"button\" class=\"libraryShelfCover\" aria-label=\"Abrir novela\"><span class=\"libraryShelfFallback\">本</span></button><div class=\"libraryShelfInfo\"><h3>Libro guardado</h3><div class=\"libraryShelfBottom\"><button class=\"btn primary\" type=\"button\">Continuar</button></div></div></article></div>\n</main></body></html>";
const results=[];
for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,1280]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
   await context.route('**/obi-catalog-fixture',route=>route.fulfill({
    status:200,contentType:'text/html; charset=utf-8',body:fixture}));
   const page=await context.newPage();
   const errors=[];
   page.on('pageerror',err=>errors.push(String(err)));
   try{
    await page.goto('http://127.0.0.1:4173/obi-catalog-fixture',{waitUntil:'load'});
    let tones={};
    for(const theme of ['light','dark']){
     const data=await page.evaluate(dark=>{
      document.body.classList.toggle('dark',dark);
      const style=s=>getComputedStyle(document.querySelector(s));
      const pseudo=(s,p)=>getComputedStyle(document.querySelector(s),p);
      return{
       width:document.documentElement.clientWidth,
       scroll:document.documentElement.scrollWidth,
       homeSeal:pseudo('.obiShelf-recent .discoverShelfHead','::before').content,
       popularSeal:pseudo('.obiShelf-popular .discoverShelfHead','::before').content,
       completeSeal:pseudo('.obiShelf-complete .discoverShelfHead','::before').content,
       catalogSeal:document.querySelector('.exploreKanji').textContent.trim(),
       librarySeal:document.querySelector('.libraryMark').textContent.trim(),
       homePaper:style('.homeBookCard').backgroundImage,
       catalogPaper:style('.exploreNovelGrid .catalogEditorialCard').backgroundImage,
       libraryPaper:style('.libraryShelfCard').backgroundImage,
       exploreGradient:style('.exploreNovelGrid .catalogEditorialCard').backgroundImage,
       libraryGradient:style('.libraryShelfCard').backgroundImage,
       bookSpine:pseudo('.exploreNovelGrid .catalogCoverButton','::before').content,
       libSpine:pseudo('.libraryShelfCover','::after').content,
       coverPointer:style('.catalogCoverButton').cursor,
       coverLabel:document.querySelector('.exploreNovelGrid .catalogCoverButton').getAttribute('aria-label'),
       searchLabel:document.querySelector('.exploreSearchWrap input').getAttribute('aria-label')
      };
     },theme==='dark');
     assert.ok(data.scroll<=data.width+2,
       engineName+' '+width+' '+theme+': desbordamiento horizontal '+data.scroll+'/'+data.width);
     assert.ok(data.homeSeal.includes('新着'));
     assert.ok(data.popularSeal.includes('人気'));
     assert.ok(data.completeSeal.includes('完結'));
     assert.equal(data.catalogSeal,'探');
     assert.equal(data.librarySeal,'本');
     assert.equal(data.bookSpine,'""');
     assert.equal(data.libSpine,'""');
     assert.match(data.exploreGradient,/gradient/,'Explorar: conservar fondo editorial');
     assert.match(data.libraryGradient,/gradient/,'Biblioteca: conservar fondo editorial');
     assert.equal(data.coverPointer,'pointer');
     assert.equal(data.coverLabel,'Abrir novela de ejemplo');
     assert.equal(data.searchLabel,'Buscar novelas');
     tones[theme]=data;
     results.push({engine:engineName,width,theme,overflow:false});
    }
    assert.notEqual(tones.light.homePaper,tones.dark.homePaper,
      'Home debe respetar el tema oscuro');
    assert.notEqual(tones.light.catalogPaper,tones.dark.catalogPaper,
      'Explorar debe respetar el tema oscuro');
    assert.notEqual(tones.light.libraryPaper,tones.dark.libraryPaper,
      'Biblioteca debe respetar el tema oscuro');
    await page.locator('.exploreNovelGrid .catalogCoverButton').click();
    assert.equal(new URL(page.url()).hash,'#detail:sample','La portada conserva navegación');
    assert.deepEqual(errors,[],'Errores de navegador '+engineName);
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}
console.log('OBI collections phase 2:',JSON.stringify({evaluated:results.length,failures:0}));
