import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';
const app=fs.readFileSync('src/app.js','utf8');
const css=fs.readFileSync('src/styles.css','utf8');
const block=css.split('/* STUDIO + VOLUMES + HOME / 2026-10-14')[1];
assert.ok(block);
for(const n of ['.studioVolumeGrid>.studioVolumeCard','.studioVolumeCard .studioSectionRow','.studioVolumeCard .studioSectionActions','.volumeOpenedSynopsis','.volumeGallerySynopsis','.homeEditorial .homeFeaturedSlideInfo h2'])
 assert.ok(block.includes(n),'Falta regla '+n);
assert.match(block,/content-visibility:auto/);
assert.match(block,/prefers-reduced-motion:reduce/);
assert.doesNotMatch(block,/@import|\.readerPaper|\.readerExperience|url\(\s*https?:/);
for(const n of ['projectVolumeSynopsis','editVolumeSynopsis','volumeOpenedSynopsis','volumeGallerySynopsis','studioSectionRow','studioSectionStatsCache'])
 assert.ok(app.includes(n),'Falta funcionalidad '+n);
assert.ok(app.includes('volume_number,title,synopsis,status,cover_url,epub_fonts'));
assert.ok(app.includes('JSON.stringify({title,synopsis,cover_url,volume_number'));
assert.ok(app.includes('JSON.stringify({translation_id:P.id,volume_number,title,synopsis'));
assert.ok(app.includes("if(!teamCan(S.studioProject?.group_id,'edit'))"));
const fixture="<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><link rel=\"stylesheet\" href=\"/assets/styles.css\"></head><body><main class=\"wrap studioProject\" id=\"studio\"><div class=\"studioVolumeGrid\"><article class=\"studioVolumeCard volumeCard\"><div class=\"studioVolumeVisual\"><span>Vol 1</span></div><div class=\"studioVolumeContent\"><div class=\"sectionRow studioSectionRow\"><div class=\"studioSectionIdentity\"><div class=\"studioSectionBadges row\"><span class=\"badge\">chapter</span><span class=\"badge\">published</span></div><strong class=\"studioSectionTitle\">¿Heroína? ¿Santa? ¡No, soy una sirvienta todoterreno con orgullo!</strong><div class=\"muted\">#1 · 15,176 caracteres · 3 imágenes · 2026-10-08</div></div><div class=\"studioSectionActions row\"><div class=\"sectionSort\"><button class=\"btn\">↑</button><button class=\"btn\">↓</button></div><button class=\"btn\">Vista previa</button><button class=\"btn\">Historial</button><button class=\"btn\">Editar</button><button class=\"btn danger\">Ocultar</button></div><details class=\"studioReviewPanel\"><summary><strong>Revisión editorial</strong><span class=\"badge\">Sin solicitar</span></summary></details></div></div></article></div></main><main class=\"wrap homeEditorial\" id=\"home\"><section class=\"homeShowcase\"><div class=\"homeFeatured\"><div class=\"homeFeaturedVisual\"><a class=\"homeFeaturedBook\" href=\"#detail:one\"><span>Portada</span></a></div><div class=\"homeFeaturedInfo\"><div class=\"homeFeaturedSlideInfo\"><h2><a class=\"homeFeaturedTitleLink\" href=\"#detail:one\">El título de la novela destacada</a></h2></div></div></div></section><div class=\"homeBookGrid\"><article class=\"homeBookCard\"><a class=\"homeBookCover\" href=\"#detail:one\">Portada</a><div class=\"homeBookDetails\"><h3><a class=\"homeBookTitleLink\" href=\"#detail:one\">Título de la novela</a></h3></div></article></div></main><main class=\"wrap\" id=\"volume\"><section class=\"volumeOpenedSynopsis\" aria-label=\"Sinopsis del volumen\"><strong>Sinopsis de este volumen</strong><p>Una historia específica para este libro.</p></section><span class=\"volumeGallerySynopsis\">Introducción independiente del volumen.</span></main></body></html>";
let count=0;
for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,768,1280]){
   const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block',reducedMotion:'reduce'});
   await context.route('**/studio-synopsis-home-fixture',r=>r.fulfill({status:200,contentType:'text/html; charset=utf-8',body:fixture}));
   const page=await context.newPage();
   try{
    await page.goto('http://127.0.0.1:4173/studio-synopsis-home-fixture',{waitUntil:'load'});
    for(const theme of ['light','dark']){
     for(const id of ['studio','home','volume']){
      const d=await page.evaluate(({id,dark})=>{
       document.body.classList.toggle('dark',dark);
       for(const el of document.querySelectorAll('main'))el.hidden=el.id!==id;
       const box=s=>document.querySelector(s).getBoundingClientRect();
       const style=s=>getComputedStyle(document.querySelector(s));
       return{
        client:document.documentElement.clientWidth,
        scroll:document.documentElement.scrollWidth,
        titleWidth:box('.studioSectionTitle').width,
        rowWidth:box('.studioSectionRow').width,
        titleSize:parseFloat(style('.homeFeaturedSlideInfo h2').fontSize),
        chapterLayout:style('.studioSectionRow').display,
        chapters:['Vista previa','Historial','Editar','Ocultar'].every(s=>
          [...document.querySelectorAll('.studioSectionActions button')].some(b=>b.textContent===s)),
        synopsis:document.querySelector('.volumeOpenedSynopsis p').textContent.trim(),
        synopsisPreview:document.querySelector('.volumeGallerySynopsis').textContent.trim(),
        coverHref:document.querySelector('.homeFeaturedBook').getAttribute('href')
       };
      },{id,dark:theme==='dark'});
      assert.ok(d.scroll<=d.client+2,name+' '+width+'px '+theme+' '+id+' overflow '+d.scroll+'/'+d.client);
      if(id==='studio'){
       assert.equal(d.chapterLayout,'grid');
       assert.ok(d.titleWidth>=170,name+' '+width+'px: width '+d.titleWidth);
       assert.ok(d.rowWidth>=d.titleWidth);
       assert.ok(d.chapters,'Acciones editoriales perdidas');
      }
      if(id==='home'){
       assert.ok(d.titleSize>=14,name+' '+width+': texto demasiado pequeño');
       assert.equal(d.coverHref,'#detail:one');
      }
      if(id==='volume'){
       assert.ok(d.synopsis.includes('historia específica'));
       assert.ok(d.synopsisPreview.includes('independiente'));
      }
      count++;
     }
    }
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}
console.log('Studio, volume synopsis and Home:',JSON.stringify({scenarios:count,failures:0}));
