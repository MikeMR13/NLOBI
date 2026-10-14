import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';

const css=fs.readFileSync('src/styles.css','utf8');
const app=fs.readFileSync('src/app.js','utf8');
const phase=css.split('/* OBI EDITORIAL BOOKS — FASE 3')[1];
assert.ok(phase,'Falta Fase 3 editorial de obras y lectura');
for(const fragment of [
 '.detailEditorialHero::before',
 '.volumeGallerySection .volumeGalleryHeading::before',
 '.volumeGallerySection .volumeGalleryArtwork::after',
 '.volumeEditorialOpened .volumeOpenedEyebrow::before',
 '.readerExperience.readerPresentation-editorial .readerMeta',
 '.readerExperience.readerPresentation-editorial.readerFocused'
])assert.ok(phase.includes(fragment),'Falta regla '+fragment);
assert.doesNotMatch(phase,/@import|https?:\/\/|\.readerPaper\s+p\s*\{|data-epub-family|NLOBI-EPUB/);
assert.ok(app.includes('readerPresentation-${presentation}'));
assert.ok(app.includes('data-open-volume='));
assert.ok(app.includes('volumeOpenedProgress'));
assert.ok(app.includes('readerContinuousChapters'));
assert.ok(app.includes('readerEpubTitleAttribute'));
const fixture="<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><link rel=\"stylesheet\" href=\"/assets/styles.css\"></head><body>\n<main class=\"wrap\">\n<section class=\"detailHero detailEditorialHero\" aria-labelledby=\"detailNovelTitle\">\n<div class=\"detailEditorialMedia\"><div class=\"detailCover hasImage\"><img alt=\"Portada\" width=\"220\" height=\"330\" src=\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='220'%20height='330'%3E%3Crect%20width='220'%20height='330'%20fill='%23f9d400'/%3E%3C/svg%3E\"></div></div>\n<header class=\"detailEditorialHeadline\"><div class=\"detailEditorialKicker\"><span>Ficha de obra</span><span class=\"detailEditorialLanguage\">ES</span></div><h1 id=\"detailNovelTitle\">Una novela de ejemplo</h1><p class=\"detailEditorialAuthor\">Autor <strong>Prueba</strong></p></header>\n<div class=\"detailEditorialBody\"><div class=\"detailEditorialBadges\"><span class=\"badge\">Novela ligera</span></div><section class=\"detailSynopsis\" aria-labelledby=\"detailSynopsisHeading\"><h2 id=\"detailSynopsisHeading\">Sinopsis</h2><p>Sinopsis breve de la novela para comprobar el papel editorial.</p></section><div class=\"detailEditorialActions\"><button class=\"btn primary\" type=\"button\">Comenzar a leer</button></div></div>\n</section>\n<section class=\"volumeGallerySection\" aria-labelledby=\"detailVolumesTitle\"><div class=\"volumeGalleryHeading\"><div><span class=\"volumeGalleryEyebrow\">Colección de lectura</span><h2 id=\"detailVolumesTitle\">Volúmenes</h2></div></div>\n<div class=\"volumeGallery\"><button type=\"button\" data-open-volume=\"one\" aria-label=\"Abrir volumen 1\" class=\"volumeGalleryCard volumeEditorialCard\"><span class=\"volumeGalleryArtwork\"><img alt=\"\" width=\"240\" height=\"360\" src=\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='240'%20height='360'%3E%3Crect%20width='240'%20height='360'%20fill='%23f9d400'/%3E%3C/svg%3E\"></span><span class=\"volumeGalleryInfo\"><span class=\"volumeGalleryVolumeLine\"><strong>Vol. 1</strong></span><span class=\"volumeGalleryName\">Primer volumen</span></span></button></div>\n</section>\n<section class=\"volumeEditorialOpened\"><div class=\"volumeOpenedHero\"><div class=\"volumeOpenedCover\"><img alt=\"Portada del volumen 1\" width=\"240\" height=\"360\" src=\"data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20width='240'%20height='360'%3E%3Crect%20width='240'%20height='360'%20fill='%23f9d400'/%3E%3C/svg%3E\"></div><div class=\"volumeOpenedInfo\"><span class=\"volumeOpenedEyebrow\">Índice de lectura · Vol. 1</span><h2>Primer volumen</h2><div class=\"volumeOpenedProgress\"><progress value=\"1\" max=\"3\" aria-label=\"Capítulos leídos\">33%</progress></div><div class=\"volumeOpenedActions\"><button class=\"btn primary\" type=\"button\">Continuar leyendo</button></div></div></div>\n<div class=\"volumeIndexHeading\"><h3>Capítulos</h3></div><div class=\"volumeChapterIndex\"><div class=\"volumeChapterRow isNext\"><span class=\"volumeChapterNumber\">02</span><div class=\"volumeChapterMeta\"><strong>La siguiente página</strong></div><button class=\"btn\" type=\"button\">Leer</button></div></div>\n</section>\n</main>\n<main class=\"wrap readerExperience readerSurface-sepia readerPresentation-editorial\"><div class=\"readerShell\"><nav class=\"readerTop\" aria-label=\"Navegación entre capítulos\"><button class=\"btn\" type=\"button\">← Obra</button></nav><article class=\"readerPaper reader-font-original\" style=\"font-family:Georgia,serif;font-size:18px;--epub-reader-font:Georgia,serif\"><div class=\"readerMeta\">Novela de ejemplo · Vol. 1</div><h1>Capítulo de ejemplo</h1><div class=\"readerChapterDivider\" aria-hidden=\"true\"></div><p>Una línea del capítulo con <strong>negrita</strong> y <em>cursiva</em>.</p></article></div></main>\n</body></html>";
const scenarios=[];
for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,1280]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce',serviceWorkers:'block'});
   await context.route('**/obi-book-phase3-fixture',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture}));
   const page=await context.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   try{
    await page.goto('http://127.0.0.1:4173/obi-book-phase3-fixture',{waitUntil:'load'});
    for(const theme of ['light','dark']){
     const measured=await page.evaluate(dark=>{
      document.body.classList.toggle('dark',dark);
      const sty=s=>getComputedStyle(document.querySelector(s));
      const pseudo=(s,p)=>getComputedStyle(document.querySelector(s),p);
      const reading=document.querySelector('.readerExperience');
      const paragraph=document.querySelector('.readerPaper p');
      reading.classList.remove('readerFocused');
      const editorialFont=getComputedStyle(paragraph).fontFamily;
      const after=pseudo('.readerPaper','::after').content;
      reading.classList.replace('readerPresentation-editorial','readerPresentation-classic');
      const classicFont=getComputedStyle(paragraph).fontFamily;
      const classicMeta=pseudo('.readerMeta','::before').content;
      reading.classList.replace('readerPresentation-classic','readerPresentation-editorial');
      reading.classList.add('readerFocused');
      const focusedAfter=pseudo('.readerPaper','::after').display;
      reading.classList.remove('readerFocused');
      return{
       scroll:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,
       detailGradient:sty('.detailEditorialHero').backgroundImage,
       volumeGradient:sty('.volumeGalleryCard').backgroundImage,
       openedGradient:sty('.volumeOpenedHero').backgroundImage,
       bookKicker:pseudo('.detailEditorialKicker>span:first-child','::before').content,
       galleryLabel:pseudo('.volumeGalleryHeading','::before').content,
       volumeLabel:pseudo('.volumeOpenedEyebrow','::before').content,
       readerMetaLabel:pseudo('.readerMeta','::before').content,
       readerOrnament:after,classicMeta,focusedAfter,
       originalFont:editorialFont,classicFont,
       imageFit:sty('.detailCover.hasImage img').objectFit,
       progress:document.querySelector('.volumeOpenedProgress progress').value,
       volumeAccessible:document.querySelector('[data-open-volume]').getAttribute('aria-label'),
       btnCursor:sty('.volumeGalleryCard').cursor
      };
     },theme==='dark');
     assert.ok(measured.scroll<=measured.client+2,
      engineName+' '+width+' '+theme+' horizontal overflow: '+measured.scroll+'/'+measured.client);
     assert.match(measured.detailGradient,/gradient/);
     assert.match(measured.volumeGradient,/gradient/);
     assert.match(measured.openedGradient,/gradient/);
     assert.ok(width<=360?true:measured.bookKicker.includes('作品案内'));
     assert.ok(measured.galleryLabel.includes('巻'));
     assert.ok(measured.volumeLabel.includes('目次'));
     assert.ok(measured.readerMetaLabel.includes('読書'));
     assert.ok(measured.readerOrnament.includes('帯'));
     assert.equal(measured.classicMeta,'none');
     assert.equal(measured.focusedAfter,'none');
     assert.equal(measured.originalFont,measured.classicFont,'La fuente del capítulo no cambia al pasar de presentación editorial a clásica');
     assert.equal(measured.imageFit,'contain');
     assert.equal(measured.progress,1);
     assert.equal(measured.volumeAccessible,'Abrir volumen 1');
     scenarios.push({engine:engineName,width,theme});
    }
    assert.deepEqual(errors,[]);
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}
console.log('OBI detail & reader phase 3:',JSON.stringify({scenarios:scenarios.length,failures:0}));
