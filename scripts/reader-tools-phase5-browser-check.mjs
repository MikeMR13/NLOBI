import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

for(const engine of [chromium,webkit]){
 const browser=await engine.launch({headless:true});
 try{
  const page=await browser.newPage();
  await page.setContent('<!doctype html><html lang="es"><head></head><body><main><article class="readerPaper"><h1 id="chapterTitle">Capítulo</h1><p>Texto publicado de prueba.</p></article><div id="readerPhase5Tools"></div></main></body></html>');
  await page.addScriptTag({path:'src/reader-tools-phase5.js'});
  await page.evaluate(()=>{
   const S={view:'reader:chapter-1',user:null,readerSection:{id:'chapter-1',translation_id:'translation-1',title:'Capítulo',novel_title:'Obra',content:[{type:'paragraph',text:'Texto publicado de prueba.'}],epub_fonts:[]}};
   const rows=[],requests=[],toasts=[],goes=[];
   const jreq=async(path,opts={})=>{
    requests.push({path,opts});
    if(opts.method==='POST'){
     const input=JSON.parse(opts.body);
     rows.push({...input,id:'note-1',created_at:'2026-10-15T00:00:00Z'});
     return null;
    }
    if(opts.method==='DELETE'){rows.splice(0,rows.length);return null}
    return rows.filter(x=>path.includes('user_id=eq.'+encodeURIComponent(x.user_id)));
   };
   const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   let offlineSaved=0;
   const tool=window.createReaderToolsPhase5({S,jreq,esc,toast:(...v)=>toasts.push(v),cacheReaderChapter:()=>{offlineSaved++;return true},safeMediaUrl:s=>s,go:v=>goes.push(v)});
   window.__phase5={S,rows,requests,toasts,goes,tool,count:()=>offlineSaved};
   tool.mount();
  });
  assert.equal(await page.locator('#readerP5Note').count(),0,'guest cannot access private notes');
  await page.locator('.readerPhase5Tools > summary').click();
  await page.locator('[data-reader-p5-offline]').click();
  assert.equal(await page.evaluate(()=>window.__phase5.count()),1,'offline action uses existing chapter storage');
  await page.evaluate(()=>{window.__phase5.S.user={id:'user-1'};window.__phase5.tool.mount()});
  await page.locator('#readerP5Note').fill('Mis comentarios de lectura');
  await page.locator('[data-reader-p5-save]').click();
  await page.waitForSelector('.readerP5Entry');
  const record=await page.evaluate(()=>({input:window.__phase5.rows[0],requests:window.__phase5.requests}));
  assert.equal(record.input.user_id,'user-1');
  assert.equal(record.input.section_id,'chapter-1');
  assert.equal(record.input.translation_id,'translation-1');
  assert.equal(record.input.note,'Mis comentarios de lectura');
  assert.equal(record.input.kind,'note');
  assert.equal(record.input.anchor_mode,'block');
  assert.equal(record.input.start_block,0);
  assert.ok(record.requests.some(x=>x.path.includes('reader_annotations?user_id=eq.user-1')));
  assert.ok(!record.requests.some(x=>x.path.includes('/rest/v1/comments')),'never posts public comments');
  // Cambiar de lector invalida inmediatamente las notas del anterior antes de consultar RLS.
  await page.evaluate(()=>{window.__phase5.S.user={id:'user-2'};window.__phase5.tool.mount()});
  assert.equal(await page.locator('.readerP5Entry').count(),0,'no notes leak between accounts');
  console.log('OX-MR Fase 5 navegador:',engine.name(),'OK');
  await page.close();
 }finally{await browser.close()}
}
