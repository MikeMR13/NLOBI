import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const resetStart=app.indexOf('function resetStudioCatalogFilters()');
const resetEnd=app.indexOf('\nfunction mediaFolderOf(',resetStart);
const bindStart=app.indexOf("for(const id of ['studioResetFilters','studioResetFiltersEmpty'])");
const bindEnd=app.indexOf("for(const [id,key] of [['studioNovelStatusFilter'",bindStart);
assert.ok(resetStart>=0&&resetEnd>resetStart,'Studio reset helper must exist');
assert.ok(bindStart>=0&&bindEnd>bindStart,'Both Studio filter buttons must be bound');
assert.match(app,/id="studioResetFilters"/);
assert.match(app,/id="studioResetFiltersEmpty"/);
const resetSource=app.slice(resetStart,resetEnd);
const bindSource=app.slice(bindStart,bindEnd);
const keys=['studioProjectFilter','studioNovelStatusFilter','studioNovelPublicationFilter','studioSequelStatusFilter','studioNovelTypeFilter','studioGenreFilter','studioPublicationFilter','studioTeamFilter','studioWorkflowFilter'];

for(const [name,type] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await type.launch({headless:true});
 try{
  for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:850}});
   await page.goto('about:blank');
   await page.setContent('<html lang="es"><body><main id="studioFixture"></main></body></html>');
   await page.evaluate(({resetSource,bindSource,keys})=>{
    const S={studioProjectSearch:'sin coincidencias',studioProjectSort:'title',studioDisplay:'list',unrelated:'keep'};
    for(const key of keys)S[key]='paused';
    const $=selector=>document.querySelector(selector);
    const bind=new Function('$','resetStudioCatalogFilters',bindSource);
    let resetStudioCatalogFilters;
    const audit={S,empty:false,render:null};
    const render=()=>{
     document.querySelector('#studioFixture').innerHTML='<label for="studioProjectSearch">Buscar obra</label><input id="studioProjectSearch" value="'+S.studioProjectSearch+'"><button type="button" id="'+(audit.empty?'studioResetFiltersEmpty':'studioResetFilters')+'">'+(audit.empty?'Restablecer filtros':'Limpiar filtros')+'</button>';
     bind($,resetStudioCatalogFilters);
    };
    resetStudioCatalogFilters=new Function('S','render','$',resetSource+';return resetStudioCatalogFilters;')(S,render,$);
    audit.render=render;
    window.studioResetAudit=audit;
    render();
   },{resetSource,bindSource,keys});

   await page.locator('#studioResetFilters').click();
   let state=await page.evaluate(()=>({S:window.studioResetAudit.S,focused:document.activeElement?.id}));
   assert.equal(state.S.studioProjectSearch,'');
   for(const key of keys)assert.equal(state.S[key],'all',name+' '+width+' '+key);
   assert.equal(state.S.studioProjectSort,'title');
   assert.equal(state.S.studioDisplay,'list');
   assert.equal(state.S.unrelated,'keep');
   assert.equal(state.focused,'studioProjectSearch');

   await page.evaluate(keys=>{
    const audit=window.studioResetAudit;
    audit.S.studioProjectSearch='sin resultados';
    for(const key of keys)audit.S[key]='paused';
    audit.empty=true;
    audit.render();
   },keys);
   await page.locator('#studioResetFiltersEmpty').click();
   state=await page.evaluate(()=>({S:window.studioResetAudit.S,focused:document.activeElement?.id}));
   assert.equal(state.S.studioProjectSearch,'');
   for(const key of keys)assert.equal(state.S[key],'all',name+' '+width+' empty '+key);
   assert.equal(state.focused,'studioProjectSearch');
   await page.close();
  }
 }finally{await browser.close()}
}
console.log('Studio filter reset buttons: both click paths work in Chromium/WebKit at 390/1280px; preserve display/sort and restore focus.');
