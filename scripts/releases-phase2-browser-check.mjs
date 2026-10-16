import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const iso=new Date().toISOString();
for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 await context.route('**/assets/app.js*',r=>r.fulfill({status:200,contentType:'application/javascript',body:''}));
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
  await page.evaluate(async iso=>{
   await import('/assets/releases-phase2.js');
   document.body.innerHTML='<main id="phase2Harness"></main>';
   const css=document.createElement('link');css.rel='stylesheet';css.href='/assets/releases-phase2.css';document.head.append(css);
   const catalog=[
    {id:'t1',title:'Alicia',novels:{title:'Alicia'},translator_groups:{id:'g1',name:'Equipo Uno'}},
    {id:'t2',title:'Novela B',novels:{title:'Novela B'},translator_groups:{id:'g2',name:'Equipo Dos'}}];
   const S={user:{id:'qa-reader'},follows:[{target_type:'translation',target_id:'t1'}],readSections:[],
    publishedVolumes:[{id:'v1',translation_id:'t1',volume_number:1,title:'Volumen A',status:'published',published_at:iso},{id:'v2',translation_id:'t2',volume_number:2,title:'Volumen B',status:'published',published_at:iso}],
    publishedSections:[{id:'c1',volume_id:'v1',title:'Capítulo A',status:'published',published_at:iso},{id:'c2',volume_id:'v2',title:'Capítulo B',status:'published',published_at:iso}]};
   const component=window.createReleasesPhase2({S,nav:()=>'',status:()=>'',esc:v=>String(v).replace(/</g,'&lt;'),visibleCatalog:()=>catalog,titleOf:t=>t.novels.title,safeMediaUrl:()=>'',volumeReleaseDate:()=>iso,render:()=>draw()});
   function draw(){document.getElementById('phase2Harness').innerHTML=component.view();component.bind()}
   window.__releaseTest={S,draw,component};
   draw();
  },iso);
  assert.equal(await page.locator('.releaseV2Item').count(),2,name+' debe agrupar volúmenes');
  await page.locator('[data-rel-grouping="chapter"]').click();
  assert.equal(await page.locator('.releaseV2Item').count(),4,name+' debe mostrar publicaciones individuales');
  await page.locator('[data-rel-follow]').check();
  assert.equal(await page.locator('.releaseV2Item').count(),2,name+' solo seguidos');
  await page.locator('[data-rel-mode="calendar"]').click();
  await page.waitForSelector('.releaseV2MonthGrid');
  assert.equal(await page.locator('.releaseV2Day').count(),new Date(new Date().getFullYear(),new Date().getMonth()+1,0).getDate());
  await page.locator('[data-rel-mode="list"]').click();
  await page.locator('[data-rel-dense]').check();
  assert.equal(await page.locator('.releaseV2Compact').count(),1,name+' compacto');
  await page.locator('[data-rel-mute="t1"]').first().click();
  assert.equal(await page.locator('.releaseV2Item').count(),0,name+' silenciar títulos');
  await page.locator('[data-rel-unmute-panel]').click();
  await page.locator('[data-rel-unmute="t1"]').click();
  assert.equal(await page.locator('.releaseV2Item').count(),2,name+' restaurar silenciados');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
  assert.equal(overflow,false,name+' no debe desbordar en móvil');
  assert.deepEqual(errors,[],name+' errores JavaScript');
  console.log(name+': calendario, filtros, favoritos, compacto, silenciar, restaurar y móvil OK');
 }finally{await context.close();await browser.close();}
}
