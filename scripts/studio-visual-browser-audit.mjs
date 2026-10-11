import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const studioStart=app.indexOf('function studioWorkspaceSidebar('),studioEnd=app.indexOf('\nfunction mediaFolderOf(',studioStart);
const genresStart=app.indexOf('function novelGenresPicker('),genresEnd=app.indexOf('\nfunction novelDemographyPicker(',genresStart);
assert.ok(studioStart>=0&&studioEnd>studioStart&&genresStart>=0&&genresEnd>genresStart);
const studioSource=app.slice(studioStart,studioEnd),genreSource=app.slice(genresStart,genresEnd);
mkdirSync('quality-results',{recursive:true});
const browser=await chromium.launch({headless:true});
try{
 for(const width of [320,390,768,1280]){
  const page=await browser.newPage({viewport:{width,height:920},deviceScaleFactor:1});
  await page.goto('about:blank');
  await page.setContent('<!DOCTYPE html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div></body></html>');
  await page.addStyleTag({path:'dist/assets/styles.css'});
  await page.evaluate(({studioSource,genreSource})=>{
   const statusOptions=[['active','Activa'],['paused','En pausa'],['abandoned','Abandonada'],['awaiting_sequel','En espera de secuela'],['no_sequel_confirmed','Sin secuela confirmada'],['complete','Completada']];
   const types=[['light_novel','Novela ligera'],['web_novel','Novela web'],['original','Novela original']];
   const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
   const groups=[{translator_groups:{id:'t1',name:'Equipo 1'},role:'owner'},{translator_groups:{id:'t2',name:'Equipo 2'},role:'editor'}];
   const books=[
    {id:'active',group_id:'t1',title:'Obra activa',updated_at:'2026-10-11',status:'active',novels:{title:'Obra activa',genres:['Romance','Fantasía'],novel_type:'light_novel'},volumes:[{status:'published',sections:[{status:'published'}]},{status:'draft',sections:[{status:'draft'}]}]},
    {id:'complete',group_id:'t1',title:'Obra completada',updated_at:'2026-10-10',status:'complete',novels:{title:'Obra completada',genres:['Fantasía'],novel_type:'original'},volumes:[{status:'published',sections:[{status:'published'}]}]},
    {id:'paused',group_id:'t2',title:'Obra en pausa',updated_at:'2026-10-09',status:'paused',novels:{title:'Obra en pausa',genres:['Misterio'],novel_type:'web_novel'},volumes:[{status:'draft',sections:[{status:'draft'}]}]}
   ];
   const S={groups,studioTranslations:books,catalog:[]};
   const factory=new Function('S','nav','status','teamCan','isCurrentGroupManager','isCurrentGroupEditor','safeMediaUrl','esc','novelTypeLabel','translationStatusLabel','TRANSLATION_STATUS_OPTIONS','NOVEL_TYPE_OPTIONS','localStorage',studioSource+';return studio;');
   const studio=factory(S,()=>'',()=>'',()=>true,()=>true,()=>true,()=>'',esc,
    x=>Object.fromEntries(types)[x]||x,x=>Object.fromEntries(statusOptions)[x]||x,statusOptions,types,window.localStorage);
   const studioMount=()=>{document.querySelector('#studioRoot').innerHTML=studio();bindStudioFilters()};
   const binder=[['studioProjectFilter','studioProjectFilter'],['studioGenreFilter','studioGenreFilter'],['studioPublicationFilter','studioPublicationFilter'],['studioNovelTypeFilter','studioNovelTypeFilter'],['studioTeamFilter','studioTeamFilter'],['studioWorkflowFilter','studioWorkflowFilter'],['studioProjectSort','studioProjectSort']];
   function bindStudioFilters(){for(const [id,key] of binder){const el=document.getElementById(id);if(el)el.onchange=()=>{S[key]=el.value;studioMount()}}
    document.querySelector('#studioProjectSearch').oninput=e=>{S.studioProjectSearch=e.target.value;studioMount()};
   }
   document.querySelector('#app').innerHTML='<div id="studioRoot"></div><section id="pickerRoot" class="wrap" style="margin:30px auto;max-width:730px"></section>';
   studioMount();
   const genres=new Function('S','NOVEL_GENRES','esc','$$','document',genreSource+';return {novelGenresPicker,selectedNovelGenres,bindNovelGenrePickers};')(S,['Acción','Aventura','Fantasía','Misterio','Romance','Fantasía oscura','Ciencia ficción','Escolar','Shōnen'],esc,s=>[...document.querySelectorAll(s)],document);
   document.querySelector('#pickerRoot').innerHTML='<h2>Géneros de la novela</h2><div class="authPanel" style="width:100%;max-width:100%"><div class="field"><span class="studioFieldLabel">Géneros (obligatorio)</span>'+genres.novelGenresPicker('auditGenres',['Romance'])+'</div></div>';
   genres.bindNovelGenrePickers();
   window._test={S,genres,studioMount};
  },{studioSource,genreSource});

  // Actual catalog filtering + state after selection.
  assert.equal(await page.locator('.studioV3BookCard').count(),3);
  await page.locator('#studioProjectFilter').selectOption('complete');
  assert.equal(await page.locator('.studioV3BookCard').count(),1);
  assert.ok(await page.locator('.studioV3BookCard').innerText().then(t=>t.includes('Obra completada')));
  await page.locator('#studioGenreFilter').selectOption('Fantasía');
  assert.equal(await page.locator('.studioV3BookCard').count(),1);
  await page.locator('#studioPublicationFilter').selectOption('full');
  assert.equal(await page.locator('.studioV3BookCard').count(),1);
  assert.equal(await page.locator('#studioProjectFilter').inputValue(),'complete');
  assert.equal(await page.locator('#studioGenreFilter').inputValue(),'Fantasía');
  await page.screenshot({path:'quality-results/studio-filters-'+width+'.png',fullPage:true});

  // Genre picker visual and keyboard interaction.
  await page.locator('#auditGenres summary').click();
  assert.ok(await page.locator('#auditGenres [data-genre-query]').isVisible());
  await page.locator('#auditGenres [data-genre-query]').fill('fantasía');
  assert.equal(await page.locator('#auditGenres [data-genre-option]:visible').count(),2);
  await page.locator('#auditGenres [data-genre-option]').filter({hasText:'Fantasía oscura'}).locator('input').check();
  assert.equal(await page.locator('#auditGenres [data-genre-count]').innerText(),'2');
  assert.deepEqual(await page.evaluate(()=>window._test.genres.selectedNovelGenres('auditGenres')),['Fantasía oscura','Romance']);
  await page.screenshot({path:'quality-results/studio-genres-'+width+'.png',fullPage:true});
  await page.locator('#auditGenres [data-genre-clear]').click();
  assert.equal(await page.locator('#auditGenres [data-genre-count]').innerText(),'0');
  await page.locator('#auditGenres [data-genre-query]').press('Escape');
  assert.equal(await page.locator('#auditGenres').evaluate(el=>el.open),false);
  const overlap=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  assert.equal(overlap,false,'Horizontal overflow at '+width+' px');
  await page.close();
 }
 console.log('Studio visual audit OK: 320/390/768/1280 px filters, completed status, genre multi-selector, search, clear, focus, screenshots.');
}finally{await browser.close()}
