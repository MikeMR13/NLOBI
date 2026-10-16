import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium, webkit } from 'playwright';

const src=fs.readFileSync('src/app.js','utf8');
const html=fs.readFileSync('src/index.html','utf8');
const built=fs.readFileSync('dist/index.html','utf8');
const sw=fs.readFileSync('dist/sw.js','utf8');
const hint=fs.readFileSync('src/home-cover-hint.js','utf8');
assert.match(src,/function primeHomeCover\(book\)/);
assert.ok(src.includes('new globalThis.URL(src,location.origin)'),'Usar constructor URL nativo');
assert.ok(src.includes('const secondaryResults=earlyRender?null:loadSecondary()'),'Catálogo prioritario');
assert.ok(src.includes('if(CONFIG.qaMode===true&&qaCatalogFixtureActive)return;'),'No sobrescribir fixtures después de diferir consultas');
assert.ok(src.includes("requestIdleCallback(startSecondary,{timeout:2400})"),'Las consultas auxiliares esperan a que el navegador esté ocioso');
assert.ok(src.includes("setTimeout(startSecondary,1200)"),'El fallback también difiere trabajo no crítico');
assert.ok(src.includes("if(CONFIG.qaMode===true&&qaCatalogFixtureActive)return;"),'La carga diferida no debe pisar fixtures QA');
assert.match(src,/existingFeaturedVisual\.querySelector\('a'\)/);
assert.match(src,/homeFirstPaintDone=S\.view==='home'/);
assert.match(src,/if\(S\.view!=='home'\)render\(\)/);
assert.match(hint,/12\*60\*60\*1000/);
assert.match(hint,/url\.origin!==location\.origin/);
assert.match(html,/home-cover-hint\.js/);
assert.match(html,/@media\(max-width:640px\)\{\.homeEditorial \.homeShowcase/);
assert.match(built,/assets\/home-cover-hint\.js\?v=[a-f0-9]{12}/);
assert.match(sw,/assets\/home-cover-hint\.js\?v=[a-f0-9]{12}/);

const quality=fs.readFileSync('scripts/full-quality-check.mjs','utf8');
const begin=quality.indexOf('const now='),end=quality.indexOf('const viewports=');
assert.ok(begin>=0&&end>begin,'QA fixture missing');
const {scenarios}=new Function(quality.slice(begin,end)+'\nreturn {scenarios};')();
const scenario=scenarios.find(([name])=>name==='public-home-carousel');
assert.ok(scenario,'Featured carousel fixture missing');
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZpTQAAAAASUVORK5CYII=','base64');
const failures=[];let passed=0;
for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await context.addInitScript(()=>{
   localStorage.setItem('nlobi_home_cover_hint_v1',JSON.stringify({path:'/media/test-phase3-cover.webp',at:Date.now()}));
  });
  await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',
   body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
  await context.route('https://qa.supabase.local/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await context.route('**/media/test-phase3-cover.webp',r=>r.fulfill({status:200,contentType:'image/png',body:image}));
  await context.route('https://example.test/**',r=>r.fulfill({status:200,contentType:'image/png',body:image}));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  try{
   await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
   const warm=await page.evaluate(()=>{
    const seeded=document.querySelector('link[data-home-cover-seed]');
    const hinted=document.querySelector('link[data-home-cover-hint]');
    const link=seeded||hinted;
    return {href:link?.getAttribute('href'),priority:link?.fetchPriority,as:link?.as,
      seeded:!!seeded,hinted:!!hinted,
      seedPath:document.querySelector('meta[name="nlobi-build-cover"]')?.content};
   });
   assert.ok(warm.href?.startsWith('/media/')||warm.href?.includes('/media/'),'Warm visit must preload a public image');
   assert.equal(warm.as,'image');
   assert.equal(warm.priority,'high');
   if(warm.seeded){
    assert.equal(warm.href,warm.seedPath,'Build seed must be the image request discovered in HEAD');
    assert.equal(warm.hinted,false,'Do not preload a second locally cached cover');
   }else{
    assert.ok(warm.href.endsWith('/media/test-phase3-cover.webp'),'Warm visit without build seed must use local hint');
   }
   await page.waitForFunction(()=>!!window.__NLOBI_QA__,undefined,{timeout:16000});
   await page.evaluate(data=>{
    window.__NLOBI_QA__.setState(data);
    window.__NLOBI_QA__.setView('home');
   },scenario[2]);
   await page.locator('.homeFeaturedVisual .homeFeaturedBook img').first().waitFor();
   const stable=await page.evaluate(()=>{
    const current=document.querySelector('.homeFeaturedVisual .homeFeaturedBook img');
    window.__NL_PREVIOUS_HERO=current;
    window.__NLOBI_QA__.setState({notificationBellOpen:''});
    return document.querySelector('.homeFeaturedVisual .homeFeaturedBook img')===window.__NL_PREVIOUS_HERO;
   });
   assert.equal(stable,true,'Unchanged LCP cover must survive rerender');
   assert.equal(errors.length,0,'Unexpected JS errors: '+errors.join('; '));
   passed++;
  }catch(e){failures.push({browser:name,width,error:String(e)})}
  finally{await context.close()}
 }
 await browser.close();
}
// La precarga no debe intentar recursos expirados ni terceros.
console.log('Home LCP phase 3:',JSON.stringify({passed,failures}));
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1)}
