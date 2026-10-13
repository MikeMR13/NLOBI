import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';

// Reusar los datos oficiales de QA del proyecto; no se consulta Supabase real.
const source=fs.readFileSync('scripts/full-quality-check.mjs','utf8');
const start=source.indexOf('const now='),end=source.indexOf('const viewports=');
assert.ok(start>=0&&end>start,'No se encontraron fixtures de QA');
const {scenarios}=new Function(source.slice(start,end)+'\nreturn {scenarios};')();
const exploreFixture=scenarios.find(([name])=>name==='public-explore')?.[2];
const libraryFixture=scenarios.find(([name])=>name==='user-library')?.[2];
assert.ok(exploreFixture?.catalog?.length&&libraryFixture?.library?.length,'Faltan fixtures de catálogo');

const src=fs.readFileSync('src/app.js','utf8');
assert.match(src,/const CATALOG_BATCH_SIZE=24;/);
assert.match(src,/visibleCatalogBatch\('explore',results/);
assert.match(src,/visibleCatalogBatch\('library',filtered/);
assert.match(src,/showMoreCatalogBatch\(button.dataset.catalogMore\)/);

const books=Array.from({length:65},(_,i)=>{
 const base=exploreFixture.catalog[0],id='catalog-qa-'+String(i+1).padStart(3,'0');
 return {...base,id,title:'Historia QA '+String(i+1).padStart(3,'0'),updated_at:'2026-10-07T18:00:00.000Z',
  novels:{...base.novels,id:'novel-qa-'+i,title:'Historia QA '+String(i+1).padStart(3,'0'),cover_url:null}};
});
const shelf=Array.from({length:65},(_,i)=>{
 const base=libraryFixture.library[0],id='library-qa-'+String(i+1).padStart(3,'0');
 return {...base,translation_id:id,is_favorite:i%2===0,updated_at:'2026-10-07T18:00:00.000Z',
  translations:{...base.translations,id,title:'Lectura QA '+String(i+1).padStart(3,'0'),
   novels:{...base.translations.novels,title:'Lectura QA '+String(i+1).padStart(3,'0')}}};
});
const failures=[];let evaluated=0;
for(const [browserName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 for(const width of [320,390,1280]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',
   body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
  await context.route('https://qa.supabase.local/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const page=await context.newPage(),runtime=[];
  page.on('pageerror',e=>runtime.push(String(e)));
  try{
   await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.__NLOBI_QA__&&document.querySelector('#siteStyles')?.media==='all',undefined,{timeout:18000});

   await page.evaluate(({fixture,books})=>{
    window.__NLOBI_QA__.setState({...fixture,catalog:books,catalogLoading:false,catalogLoaded:true,
      searchQuery:'',searchGenre:'all',searchStatus:'all',searchNovelStatus:'all',searchSequelStatus:'all',
      searchNovelType:'all',searchLanguage:'all',searchTeam:'all',searchDemography:'all',searchTag:'all',
      searchAvailability:'all',searchSort:'updated'});
    window.__NLOBI_QA__.setView('explore');
   },{fixture:exploreFixture,books});
   const explorer=page.locator('.exploreNovelGrid .catalogEditorialCard');
   await explorer.first().waitFor();
   assert.equal(await explorer.count(),24,'Explorar debe mostrar 24 tarjetas inicialmente');
   assert.match(await page.locator('.exploreResultsBar').innerText(),/65 novelas encontradas/);
   await page.locator('[data-catalog-more="explore"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('.exploreNovelGrid .catalogEditorialCard').length===48,null,{timeout:5000});
   assert.equal(await explorer.count(),48,'Explorar debe mostrar 48 obras tras ampliar');
   await page.locator('#catalogSearch').fill('Historia QA 065');
   assert.equal(await explorer.count(),1,'Buscar debe encontrar obras fuera del primer lote');
   assert.equal(await page.locator('[data-catalog-more="explore"]').count(),0,'Sin botón al filtrar a un resultado');
   await page.locator('#catalogSearch').fill('');
   assert.equal(await explorer.count(),24,'La búsqueda reinicia la ventana visible');
   await page.locator('[data-explore-view="list"]').click();
   assert.equal(await explorer.count(),24,'La vista de lista no pierde la ventana visible');
   assert.equal(await page.locator('.exploreNovelGrid.exploreListView').count(),1);

   await page.evaluate(({fixture,shelf})=>{
    window.__NLOBI_QA__.setState({...fixture,library:shelf,libraryTab:'books',libraryFilter:'all',
     libraryQuery:'',librarySort:'title',catalogLoading:false,catalogLoaded:true});
    window.__NLOBI_QA__.setView('library');
   },{fixture:libraryFixture,shelf});
   const readerShelf=page.locator('.libraryShelf .libraryShelfCard');
   await readerShelf.first().waitFor();
   assert.equal(await readerShelf.count(),24,'Biblioteca debe mostrar 24 libros inicialmente');
   assert.match(await page.locator('.libraryResultCount').innerText(),/65 novelas/);
   await page.locator('[data-catalog-more="library"]').click();
   await page.waitForFunction(()=>document.querySelectorAll('.libraryShelf .libraryShelfCard').length===48,null,{timeout:5000});
   assert.equal(await readerShelf.count(),48,'Biblioteca debe permitir mostrar más');
   await page.locator('#librarySearch').fill('Lectura QA 065');
   assert.equal(await readerShelf.count(),1,'Búsqueda de biblioteca debe recorrer las 65 entradas');
   await page.locator('#librarySearch').fill('');
   assert.equal(await readerShelf.count(),24,'Restablecer búsqueda reinicia la ventana');
   await page.locator('[data-library-filter="favorites"]').click();
   assert.equal(await readerShelf.count(),24,'Los filtros aplican a toda la biblioteca');
   assert.match(await page.locator('.libraryResultCount').innerText(),/33 novelas/);

   const overflow=await page.evaluate(()=>Math.max(0,document.documentElement.scrollWidth-innerWidth));
   assert.ok(overflow<=2,'Biblioteca desborda horizontalmente: '+overflow);
   assert.equal(runtime.length,0,'Errores JS: '+runtime.join('; '));
   evaluated++;
  }catch(e){failures.push({browserName,width,error:String(e),runtime:runtime.slice(0,3)})}
  finally{await context.close()}
 }
 await browser.close();
}
console.log('Fase 5 · Catálogos progresivos:',JSON.stringify({evaluated,failures:failures.length}));
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1)}
