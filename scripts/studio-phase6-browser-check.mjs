import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
try{
 for(const width of [320,390,768,1280]){
  const page=await browser.newPage({viewport:{width,height:900},acceptDownloads:true});
  await page.goto('about:blank');
  await page.setContent('<!doctype html><html lang="es"><body><main class="wrap"><div id="qualityRoot"></div><div data-studio-volume-id="v1">Volumen de prueba</div></main></body></html>');
  await page.addStyleTag({path:'dist/assets/styles.css'});
  await page.addScriptTag({path:'dist/assets/studio-phase6.js'});
  await page.evaluate(()=>{
   const S={groups:[{translator_groups:{id:'g1'}}],studioQaQuery:'',studioQaSeverity:'all',studioProject:{id:'t1',group_id:'g1',title:'Obra',novels:{title:'Obra',novel_type:'light_novel',genres:['Fantasía'],synopsis:'Sinopsis',cover_url:'cover.png',demography:'Shōnen',author_name:'Autor'},translator_groups:{review_required:false},
    volumes:[{id:'v1',volume_number:1,title:'Primer volumen',cover_url:'cover.png',sections:[{id:'c1',title:'Capítulo 1',section_number:1,status:'draft',content:[{type:'paragraph',text:'Un párrafo de prueba'},{type:'image',url:'img.png',alt:''}]},{id:'c2',title:'Capítulo 2',section_number:2,status:'draft',content:[]}]}],review_requests:[],publication_schedules:[]}};
   const escape=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
   const mod=window.createStudioPhase6({S,esc:escape,$:s=>document.querySelector(s),$$:s=>[...document.querySelectorAll(s)],teamCan:()=>false,editSection:()=>{throw Error('Editor should be forbidden')},toast:()=>{},blocksToPlainText:items=>items.map(b=>b.text||'').join(' ')});
   document.getElementById('qualityRoot').innerHTML=mod.renderPanel(S.studioProject);
   mod.bind();
  });
  await page.locator('#studioProjectQuality').evaluate(el=>el.open=true);
  assert.ok(await page.getByText('Hallazgos del diagnóstico').isVisible());
  assert.ok(await page.locator('[data-qa-severity="error"]').count()>0);
  assert.equal(await page.locator('[data-qa-section]').count(),0,'Viewer must not have edit actions');
  await page.locator('#studioQaSeverity').selectOption('warning');
  assert.equal(await page.locator('[data-qa-severity="error"]:visible').count(),0,'Severity filter must hide errors');
  await page.locator('#studioQaSeverity').selectOption('all');
  await page.locator('#studioQaQuery').fill('furigana inexistente');
  assert.equal(await page.locator('[data-qa-severity]:visible').count(),0,'Search must filter issues');
  assert.ok(await page.locator('#studioQaEmpty').isVisible());
  await page.locator('#studioQaQuery').fill('');
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('[data-qa-export]').click()]);
  assert.ok(download.suggestedFilename().endsWith('.json'));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+1);
  assert.equal(overflow,false,'Quality inspector overflows at '+width+'px');
  await page.close();
 }
 console.log('Studio Fase 6 browser check OK: responsive viewports, accessible filters, protected edit and report export.');
}finally{await browser.close()}
