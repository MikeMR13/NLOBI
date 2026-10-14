import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';
import {seedFeaturedHomeHtml} from './home-seed-html.mjs';

const origin='https://qa.supabase.local',id='early-featured-qa';
const cover=origin+'/storage/v1/object/public/nlobi-media/teams/qa/covers/cover.webp';
const book={id,title:'Libro destacado',status:'active',language_code:'es',
 updated_at:'2026-10-14T14:00:00Z',novels:{id:'novel-qa',title:'Libro destacado',synopsis:'Una historia de prueba',cover_url:cover,genres:[]},
 translator_groups:{id:'group-qa',name:'Equipo QA'}};
const html=seedFeaturedHomeHtml(fs.readFileSync('src/index.html','utf8'),book,origin);
assert.ok(html.includes('data-early-featured-cover'));
const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZpTQAAAAASUVORK5CYII=','base64');
let passed=0;const failures=[];
for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:850},serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await page.route('**/assets/app.js*',async route=>{await new Promise(r=>setTimeout(r,450));await route.continue()});
  await page.route('**/runtime-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',
   body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
  await page.route('https://qa.supabase.local/**',route=>{
   const url=new URL(route.request().url());
   const response=url.pathname==='/rest/v1/translations'?[book]:[];
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
  });
  await page.route('**/media/teams/qa/covers/cover.webp',route=>route.fulfill({status:200,contentType:'image/png',body:pixel}));
  await page.route('http://127.0.0.1:4173/',route=>route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:html}));
  try{
   await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'commit'});
   await page.locator('img[data-early-featured-cover]').waitFor({timeout:8000});
   const before=await page.evaluate(()=>{
    const img=document.querySelector('img[data-early-featured-cover]');
    window.__EARLY_COVER_NODE=img;
    const bounds=img.getBoundingClientRect();
    return {visible:bounds.width>0&&bounds.height>0,src:img.getAttribute('src'),alt:img.alt};
   });
   assert.ok(before.visible,'La portada debe ocupar espacio antes de cargar app.js');
   assert.equal(before.src,'/media/teams/qa/covers/cover.webp');
   assert.equal(before.alt,'Portada de Libro destacado');
   await page.waitForFunction(()=>{
    const qa=window.__NLOBI_QA__,state=qa?.getState();
    return !!qa&&state?.catalogLoaded&&!state?.catalogLoading;
   },null,{timeout:20000});
   const after=await page.evaluate(()=>({
    same:document.querySelector('.homeFeaturedBook img')===window.__EARLY_COVER_NODE,
    image:document.querySelector('.homeFeaturedBook img')?.getAttribute('src'),
    view:window.__NLOBI_QA__.getState().view
   }));
   assert.equal(after.same,true,'La hidratación debe conservar la portada inicial');
   assert.equal(after.view,'home');
   assert.equal(after.image,before.src);
   await page.evaluate(()=>window.__NLOBI_QA__.setView('studio'));
   const studio=await page.evaluate(()=>({
    main:document.querySelector('main')?.textContent||'',
    fallback:document.querySelector('main')?.textContent?.includes('Preparando Studio…')
   }));
   assert.equal(studio.fallback,false,'El bundle Studio debe estar disponible tras inicialización QA');
   assert.ok(studio.main.includes('Studio')||studio.main.includes('equipo'),'Se debe abrir Studio');
   assert.deepEqual(errors,[],'No debe haber excepciones en navegador');
   passed++;
  }catch(error){failures.push({name,width,error:String(error),runtime:errors.slice(0,3)})}
  finally{await context.close()}
 }
 await browser.close();
}
console.log('Seeded LCP and deferred Studio browser QA:',JSON.stringify({passed,failures:failures.length}));
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1)}
