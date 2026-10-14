import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';

const html=fs.readFileSync('src/index.html','utf8');
const js=fs.readFileSync('src/app.js','utf8');
const built=fs.readFileSync('dist/index.html','utf8');
assert.match(html,/<div id="app" hidden>/,'El HTML debe incluir una presentación oculta hasta conocer la ruta');
assert.match(html,/<h1>Abre un libro\.<br><em>Entra en otra historia\.<\/em><\/h1>/);
assert.ok(html.indexOf('data-initial-home')<html.indexOf('type="module" src="/assets/app.js'));
assert.match(built,/\/assets\/initial-home\.js\?v=[a-f0-9]{12}/);
assert.match(js,/if\(app\.hidden\)app\.hidden=false/);
assert.match(html,/data-reader-href="https:\/\/fonts\.googleapis\.com/);
assert.doesNotMatch(html,/<link href="https:\/\/fonts\.googleapis\.com/,'No descargar fuentes externas al abrir Home');
const quality=fs.readFileSync('scripts/full-quality-check.mjs','utf8');
const start=quality.indexOf('const now='),end=quality.indexOf('const viewports=');
const {scenarios}=new Function(quality.slice(start,end)+'\nreturn {scenarios};')();
const home=scenarios.find(x=>x[0]==='public-home-carousel')?.[2];
assert.ok(home,'No existe escenario QA del Home');

const errors=[];let passed=0;
for(const [label,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await context.route('**/assets/app.js?*',async route=>{
   await new Promise(resolve=>setTimeout(resolve,450));
   await route.continue();
  });
  await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',
   body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
  await context.route('https://qa.supabase.local/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  const page=await context.newPage(),runtime=[];
  page.on('pageerror',e=>runtime.push(String(e)));
  try{
   await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'commit'});
   await page.locator('.homeShowcaseCopy h1').waitFor({timeout:12000});
   const initially=await page.evaluate(()=>{
    const node=document.querySelector('.homeShowcaseCopy h1');
    window.__QA_ORIGINAL_H1=node;
    return {visible:!!node&&!!node.getClientRects().length,
      text:node?.innerText,fonts:document.querySelector('#readerFonts')?.getAttribute('href')};
   });
   assert.equal(initially.visible,true,'El titular debe pintarse antes de app.js');
   assert.match(initially.text,/Abre un libro/);
   assert.equal(initially.fonts,null,'La portada no descarga tipografías del lector');
   await page.waitForFunction(()=>!!window.__NLOBI_QA__,undefined,{timeout:18000});
   await page.evaluate(data=>{window.__NLOBI_QA__.setState({...data,catalogLoading:false,catalogLoaded:true});window.__NLOBI_QA__.setView('home')},home);
   const hydrated=await page.evaluate(()=>{
    const title=document.querySelector('.homeShowcaseCopy h1');
    const same=title===window.__QA_ORIGINAL_H1;
    const fonts=document.querySelector('#readerFonts');
    const before=fonts?.getAttribute('href');
    window.__nlobiActivateReaderFonts?.('reader:test');
    return {same,view:window.__NLOBI_QA__.getState().view,before,
      after:fonts?.getAttribute('href'),h1:title?.innerText};
   });
   assert.equal(hydrated.same,true,'La hidratación debe conservar el mismo nodo del LCP');
   assert.equal(hydrated.view,'home');
   assert.equal(hydrated.before,null);
   assert.match(hydrated.after,/fonts\.googleapis\.com/,'Las fuentes deben cargarse al entrar al lector');
   assert.equal(runtime.length,0,'Error JavaScript: '+runtime.join('; '));
   passed++;
  }catch(e){errors.push({browser:label,width,error:String(e),runtime:runtime.slice(0,2)})}
  finally{await context.close()}
 }
 await browser.close();
}
console.log('Home early LCP shell:',JSON.stringify({passed,failures:errors.length}));
if(errors.length){console.error(JSON.stringify(errors,null,2));process.exit(1)}
