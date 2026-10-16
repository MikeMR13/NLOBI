import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';
const source=fs.readFileSync('scripts/full-quality-check.mjs','utf8');
const start=source.indexOf('const now='),end=source.indexOf('const viewports=');
if(start<0||end<=start)throw Error('Fixtures no disponibles');
const {scenarios}=new Function(source.slice(start,end)+'\nreturn {scenarios};')();
const fixture=scenarios.find(([name])=>name==='public-reader')?.[2];
assert.ok(fixture?.readerSection,'La prueba del lector requiere una sección publicada');
for(const [name,browserType] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await browserType.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 const sent=[];const failures=[];
 await context.route('**/runtime-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',
  body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
 await context.route('https://qa.supabase.local/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await context.route('https://qa.supabase.local/rest/v1/translation_errata*',route=>{
  sent.push({url:route.request().url(),method:route.request().method(),data:JSON.parse(route.request().postData()||'{}')});
  return route.fulfill({status:201,contentType:'application/json',body:'[]'});
 });
 const page=await context.newPage();page.on('pageerror',e=>failures.push(e.message));
 try{
  await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__NLOBI_QA__,null,{timeout:15000});
  await page.evaluate(data=>{
   window.__NLOBI_QA__.setState({...data,readerSection:data.readerSection,readerContinuous:null,
    user:null,notes:[],readerPrefs:{theme:'light',fontSize:18,width:'normal',lineHeight:'comfortable',fontFamily:'serif',paragraphSpace:'normal',indent:'none',align:'left',contrast:'standard',images:'show',presentation:'classic'}});
   window.__NLOBI_QA__.setView('reader:section-1');
  },fixture);
  await page.waitForSelector('.readerPaper');
  assert.equal(await page.locator('.readerErrataPhase4').count(),0,name+' no muestra reporte a invitados');
  await page.evaluate(()=>window.__NLOBI_QA__.setState({user:{id:'33333333-3333-4333-8333-333333333333',email:'qa@example.test'},profile:{display_name:'Lector QA'},notes:[]}));
  await page.waitForSelector('.readerErrataPhase4 > summary');
  await page.locator('.readerErrataPhase4 > summary').click();
  await page.locator('#readerErrataExcerpt').fill('Pasaje señalado');
  await page.locator('#readerErrataBody').fill('corto');
  await page.locator('[data-reader-errata-send]').click();
  assert.equal(sent.length,0,name+' rechaza reportes menores al mínimo');
  await page.locator('#readerErrataBody').fill('La palabra está escrita incorrectamente en este párrafo.');
  await page.locator('[data-reader-errata-send]').click();
  await page.waitForFunction(()=>document.querySelector('#readerErrataBody')?.value==='');
  assert.equal(sent.length,1,name+' envía un solo reporte válido');
  assert.equal(sent[0].method,'POST');
  assert.equal(sent[0].data.section_id,fixture.readerSection.id);
  assert.equal(sent[0].data.user_id,'33333333-3333-4333-8333-333333333333');
  assert.equal(sent[0].data.excerpt,'Pasaje señalado');
  assert.equal(await page.locator('.readerErrataPhase4').evaluate(e=>e.open),false,name+' cierra el formulario tras enviar');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
  assert.ok(overflow<=2,name+' desbordamiento horizontal '+overflow);
  assert.deepEqual(failures,[],name+' errores en navegador');
  console.log(name+': erratas privadas, formulario, validación y móvil OK');
 }finally{await context.close();await browser.close()}
}
