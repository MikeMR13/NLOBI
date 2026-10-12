import assert from 'node:assert/strict';
import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
try{
 for(const width of [360,768,1280]){
  const page=await browser.newPage({viewport:{width,height:850}});
  await page.goto('about:blank');
  await page.setContent('<!doctype html><html lang="es"><body><main class="wrap"><div id="studioTest"></div></main></body></html>');
  await page.addStyleTag({path:'dist/assets/styles.css'});
  await page.addScriptTag({path:'dist/assets/studio-phase7.js'});
  await page.evaluate(()=>{
   const gid='11111111-1111-4111-8111-111111111111';
   const data={id:'project',group_id:gid,title:'Obra de prueba',novels:{title:'Obra de prueba'},
    translator_groups:{name:'Equipo',avatar_url:'https://example.org/logo.png',review_required:false},
    volumes:[{id:'v1',title:'Volumen de prueba',volume_number:1,status:'draft',sections:[{id:'s1',title:'Capítulo uno',status:'draft',sort_order:1,content:[{type:'paragraph',text:'El primer texto'}, {type:'ruby',base:'猫',reading:'ねこ'}]},{id:'s2',title:'Capítulo dos',status:'draft',sort_order:2,content:[{type:'paragraph',text:'El segundo texto'}]}]}],review_requests:[],publication_schedules:[],publication_events:[]};
   const S={user:{id:'22222222-2222-4222-8222-222222222222'},groups:[{translator_groups:{id:gid}}],studioProject:data,readerPrefs:{fontSize:21,align:'justify'}};
   const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   window._phase7=window.createStudioPhase7({S,esc,$:s=>document.querySelector(s),$$:s=>[...document.querySelectorAll(s)],
     jreq:async()=>[],toast:()=>{},friendlyError:x=>String(x),teamCan:()=>true,
     renderReaderBlock:b=>b.type==='ruby'?'<p><ruby>'+esc(b.base)+'<rt>'+esc(b.reading)+'</rt></ruby></p>':'<p>'+esc(b.text||'')+'</p>',
     safeMediaUrl:x=>x,studioVolumeQuality:v=>({issues:v.sections.length?[]:['No sections'],warnings:['Revisa el formato visual']}),
     studioSectionQuality:()=>({issues:[],warnings:[]}),refreshProject:async()=>{},loadCatalog:async()=>{}});
   document.getElementById('studioTest').innerHTML=window._phase7.summary(data);
   window._phase7.bind();
  });
  assert.ok(await page.getByText('Centro de publicaciones').isVisible());
  await page.locator('[data-studio-v7-preview]').click();
  assert.ok(await page.locator('.studioV7PreviewDialog').isVisible());
  assert.equal((await page.locator('#studioV7ReaderPaper').innerText()).includes('El primer texto'),true);
  assert.ok(await page.locator('.studioV7TeamLogo').count());
  assert.equal(await page.locator('#studioV7ReaderPaper').evaluate(el=>el.style.textAlign),'justify');
  await page.locator('#studioV7PreviewChapter').selectOption('s2');
  assert.equal((await page.locator('#studioV7ReaderPaper').innerText()).includes('El segundo texto'),true);
  await page.locator('.studioV7PreviewDialog [data-studio-v7-close]').click();
  assert.equal(await page.locator('.studioV7PreviewDialog').count(),0);
  await page.evaluate(()=>{window._reviewResult=null;window._phase7.review('volume','v1').then(x=>window._reviewResult=x)});
  assert.ok(await page.getByText('Confirmar publicación').isVisible());
  assert.ok(await page.getByText('Secciones incluidas').isVisible());
  assert.ok(await page.getByText('Revisa el formato visual').isVisible());
  await page.locator('#studioV7WarningsAccepted').check();
  await page.locator('#studioV7ConfirmProceed').click();
  assert.equal(await page.evaluate(()=>window._reviewResult),true);
  assert.equal(await page.locator('.studioV7Dialog').count(),0);
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2);
  assert.equal(overflow,false,'Unexpected horizontal overflow at '+width);
  await page.close();
 }
 console.log('Studio phase 7 browser checks OK: preview, chapter navigation, formatting, warnings and modal confirmation.');
}finally{await browser.close()}
