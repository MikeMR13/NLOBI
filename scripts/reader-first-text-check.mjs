import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const API='https://reader-qa.supabase.local';
const first='reader-fast-1', second='reader-fast-2',volume='reader-fast-volume',translation='reader-fast-translation';
const sections=[
 {id:first,volume_id:volume,title:'Capítulo de apertura',section_type:'chapter',section_number:1,content:[{type:'paragraph',text:'Texto de novela visible sin esperar catálogo.'}]},
 {id:second,volume_id:volume,title:'Segundo capítulo',section_type:'chapter',section_number:2,content:[{type:'paragraph',text:'El segundo capítulo llega desde la precarga.'}]}
];
const novel={id:translation,title:'Novela de lectura rápida',status:'active',
 novels:{id:'reader-fast-novel',title:'Novela de lectura rápida'},
 translator_groups:{id:'reader-fast-team',name:'Equipo QA',slug:'qa'},
 volumes:[{id:volume,volume_number:1,title:'Volumen 1',status:'published',
  sections:sections.map((section,index)=>({id:section.id,title:section.title,section_number:index+1,status:'published',sort_order:index+1}))}]};
const volumeData={id:volume,translation_id:translation,volume_number:1,title:'Volumen 1',epub_font_url:null,epub_font_family:null,epub_fonts:[]};
const results=[];

for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 let catalogStarted=0,catalogFinished=0,volumeReads=0,metaReads=0;
 const reads=new Map();
 await context.route('**/runtime-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',
  body:`window.__NLOBI_CONFIG__={supabaseUrl:'${API}',supabasePublishableKey:'qa',qaMode:false};`}));
 await context.route(API+'/**',async route=>{
  const url=new URL(route.request().url()),params=url.searchParams;
  const json=body=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/rest/v1/sections'){
   const id=(params.get('id')||'').replace(/^eq\./,'');
   reads.set(id,(reads.get(id)||0)+1);
   return json(sections.filter(x=>x.id===id));
  }
  if(url.pathname==='/rest/v1/volumes'){volumeReads++;return json([volumeData])}
  if(url.pathname==='/rest/v1/translations'){
   if(params.has('id')){metaReads++;return json([novel])}
   catalogStarted++;
   // Retrasa el catálogo de manera deliberada: no debe bloquear el primer texto.
   await new Promise(resolve=>setTimeout(resolve,5500));
   catalogFinished++;
   return route.fulfill({status:200,contentType:'application/json',body:'[]'}).catch(()=>{});
  }
  return json([]);
 });
 const page=await context.newPage();
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{
  const started=Date.now();
  await page.goto('http://127.0.0.1:4173/#reader:'+first,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>document.querySelector('.readerPaper #chapterTitle')?.textContent==='Capítulo de apertura',
   null,{timeout:4800});
  const firstPaint=Date.now()-started;
  assert.ok(firstPaint<4800,`${name}: la lectura esperó al catálogo (${firstPaint} ms)`);
  assert.equal(catalogFinished,0,`${name}: el catálogo se resolvió antes del capítulo`);
  assert.equal(reads.get(first),1,`${name}: capítulo inicial duplicado`);
  assert.equal(volumeReads,1,`${name}: metadatos del volumen duplicados`);
  assert.equal(metaReads,1,`${name}: metadatos editoriales duplicados`);
  await page.waitForFunction(()=>document.querySelector('.readerPaper')?.innerText.includes('Texto de novela visible'),null,{timeout:1800});
  await page.waitForFunction(()=>document.querySelector('#readerChapterJump')?.options.length===2,null,{timeout:1800});
  // El siguiente capítulo debe consultarse a lo sumo una vez: precarga + navegación.
  await page.waitForTimeout(2400);
  const prefetchRequests=reads.get(second)||0;
  assert.ok(prefetchRequests<=1,`${name}: demasiadas solicitudes de precarga`);
  await page.locator('#readerChapterJump').selectOption(second);
  await page.waitForFunction(()=>document.querySelector('.readerPaper #chapterTitle')?.textContent==='Segundo capítulo',null,{timeout:3500});
  assert.equal(reads.get(second),1,`${name}: la navegación repitió el capítulo precargado`);
  assert.deepEqual(errors,[],`${name}: errores en ejecución`);
  results.push({engine:name,firstTextMs:firstPaint,catalogFinishedBeforeFirstText:catalogFinished,
   sectionFirstReads:reads.get(first),secondSectionReads:reads.get(second),prefetchRequests,metadataQueries:volumeReads+metaReads});
 }finally{
  await context.close();await browser.close();
 }
}
console.log('Reader first-text performance QA:',JSON.stringify(results));
