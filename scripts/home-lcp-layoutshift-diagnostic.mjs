import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright';

// Medición real del primer Home sin QA-mode: la instrumentación es externa,
// las llamadas REST apuntan a fixtures locales y los recursos gráficos se simulan.
const html=fs.readFileSync('dist/index.html','utf8');
const match=html.match(/<meta name="nlobi-build-cover" content="(\/media\/[^"]+)"/);
if(!match){console.log('LCP shift diagnosis: semilla ausente, sin análisis');process.exit(0)}
const media=match[1];
const cover='https://qa.supabase.local/storage/v1/object/public/nlobi-media/'+media.slice('/media/'.length);
const book={id:'9aa0aaca-bed5-423b-8cd4-eb1c3317c28a',status:'active',updated_at:'2026-10-15T12:00:00Z',
 novels:{id:'novel-qa',title:'Novela destacada',cover_url:cover,synopsis:'Historia de prueba',genres:[]},
 translator_groups:{id:'team-qa',name:'Equipo QA'}};
const px=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZpTQAAAAASUVORK5CYII=','base64');
const browser=await chromium.launch({headless:true});
try{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.addInitScript(()=>{
  window.__lcpShiftTrace=[];
  new PerformanceObserver(list=>{
   for(const e of list.getEntries()){
    if(e.hadRecentInput||!e.value)continue;
    window.__lcpShiftTrace.push({
     value:e.value,time:Math.round(e.startTime),
     sources:e.sources?.slice(0,6).map(s=>({
      tag:s.node?.tagName,
      cls:typeof s.node?.className==='string'?s.node.className.slice(0,90):'',
      prev:{x:Math.round(s.previousRect?.x??0),y:Math.round(s.previousRect?.y??0),h:Math.round(s.previousRect?.height??0)},
      next:{x:Math.round(s.currentRect?.x??0),y:Math.round(s.currentRect?.y??0),h:Math.round(s.currentRect?.height??0)}
     }))
    });
   }
  }).observe({type:'layout-shift',buffered:true});
 });
 await context.route('**/runtime-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',
  body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:false};"}));
 await context.route('https://qa.supabase.local/**',route=>{
  const url=new URL(route.request().url());
  if(url.pathname.includes('/storage/'))return route.fulfill({status:200,contentType:'image/png',body:px});
  const response=url.pathname==='/rest/v1/translations'?[book]:[];
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
 });
 await context.route('**/media/**',route=>route.fulfill({status:200,contentType:'image/png',body:px}));
 const page=await context.newPage();
 const runtime=[];page.on('pageerror',e=>runtime.push(String(e)));
 await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
 await page.waitForTimeout(3600);
 const trace=await page.evaluate(()=>({
  shifts:window.__lcpShiftTrace,
  appStarted:!!document.querySelector('script[data-nlobi-app]'),
  navHeight:Math.round(document.querySelector('header.top')?.getBoundingClientRect().height||0),
  showcaseY:Math.round(document.querySelector('.homeShowcase')?.getBoundingClientRect().y||0),
  coverSrc:document.querySelector('.homeFeaturedBook img')?.getAttribute('src'),
  busy:document.querySelector('main')?.getAttribute('aria-busy')
 }));
 console.log('LCP shift diagnosis:',JSON.stringify({trace,runtime}));
 assert.equal(runtime.length,0,'Errores en primera carga pública de Home');
 assert.equal(trace.appStarted,true,'La portada no debe impedir el inicio completo');
 const shifted=(trace.shifts||[]).reduce((sum,entry)=>sum+entry.value,0);
 assert.ok(shifted<=0.02,'La hoja de estilo y la hidratación no deben desplazar la cabecera o la novela destacada (CLS='+shifted.toFixed(3)+')');
 await context.close();
}finally{await browser.close()}
