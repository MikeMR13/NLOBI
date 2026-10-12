import { chromium, webkit } from 'playwright';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./full-quality-check.mjs',import.meta.url),'utf8');
const start=source.indexOf('const now='),end=source.indexOf('const viewports=');
if(start<0||end<=start)throw Error('Faltan los fixtures compartidos');
const {scenarios}=new Function(source.slice(start,end)+'\nreturn {scenarios};')();
const fixture=scenarios.find(([name])=>name==='public-detail')?.[2];
if(!fixture)throw Error('Falta fixture de ficha de obra');
const original=fixture.currentDetail;
const pub=(id,n,title,sections,extra={})=>({id,volume_number:n,title,status:'published',cover_url:'https://example.test/'+id+'.jpg',sections,...extra});
const work={...original,
 novels:{...original.novels,cover_url:'https://example.test/novel.jpg'},
 volumes:[
  pub('volume-1',1,'Primer libro y su nombre largo',[
   {id:'section-1',status:'published',section_number:1,sort_order:1,title:'Uno'},
   {id:'section-2',status:'published',section_number:2,sort_order:2,title:'Dos'}
  ]),
  pub('volume-2',2,'Segundo libro',[
   {id:'section-3',status:'published',section_number:1,sort_order:1,title:'Tres'},
   {id:'section-4',status:'published',section_number:2,sort_order:2,title:'Cuatro'}
  ]),
  pub('volume-3',3,'Final de la colección',[
   {id:'section-5',status:'published',section_number:1,sort_order:1,title:'Cinco'}
  ],{is_final_volume:true}),
  pub('volume-hidden',4,'Borrador no visible',[
   {id:'section-6',status:'draft',section_number:1,sort_order:1,title:'No publicado'}
  ],{status:'draft'})
 ]
};
const latestPublishedVolume={id:'volume-2',volume_number:2,published_at:new Date().toISOString()};
const state={...fixture,currentDetail:work,catalog:[{...work,latestPublishedVolume}],readSections:['section-1','section-3','section-4']};
const failures=[],image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZpTQAAAAASUVORK5CYII=','base64');
fs.mkdirSync('visual-results',{recursive:true});
for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 for(const width of [320,390,580,768,1280]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
  await context.route('https://qa.supabase.local/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await context.route('https://example.test/**',r=>r.fulfill({status:200,contentType:'image/png',body:image}));
  const page=await context.newPage(),runtime=[];page.on('pageerror',e=>runtime.push(e.message));
  try{
   await page.goto('http://127.0.0.1:4173/#detail:project-1',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>!!window.__NLOBI_QA__,undefined,{timeout:15000});
   await page.evaluate(fixture=>{window.__NLOBI_QA__.setState(fixture);window.__NLOBI_QA__.setView('detail:project-1')},state);
   const cards=page.locator('.volumeGalleryCard'),gallery=page.locator('#detailVolumeGrid');
   await cards.first().waitFor();
   const initial=await page.evaluate(()=>{
    const c=[...document.querySelectorAll('.volumeGalleryCard')];
    return {count:c.length,ids:c.map(e=>e.dataset.openVolume),progress:c.map(e=>e.querySelector('.volumeGalleryProgressFill')?.style.width),
     states:c.map(e=>e.querySelector('.volumeGalleryProgressLabel')?.innerText),badges:c.map(e=>e.querySelector('.volumeGalleryIndicators')?.innerText),
     aria:c.every(e=>(e.getAttribute('aria-label')||'').includes('capítulos leídos')),
     imageFit:getComputedStyle(c[0]?.querySelector('img')).objectFit,
     overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
     list:!!document.querySelector('#detailVolumeGrid.isListView')};
   });
   if(initial.count!==3||initial.ids.join(',')!=='volume-1,volume-2,volume-3'||initial.progress.join(',')!=='50%,100%,0%'||
    !initial.states[0].includes('En lectura')||!initial.states[1].includes('Completado')||!initial.states[2].includes('Sin empezar')||
    !initial.badges[1].includes('Nuevo')||!initial.badges[2].includes('Final')||!initial.aria||initial.imageFit!=='contain'||initial.overflow>2||initial.list)
    failures.push({engineName,width,stage:'gallery',initial});
   const listButton=page.locator('[data-detail-volume-view="list"]');
   await listButton.click();
   if(!await gallery.evaluate(e=>e.classList.contains('isListView'))||await listButton.getAttribute('aria-pressed')!=='true'||
     !await listButton.evaluate(e=>document.activeElement===e))failures.push({engineName,width,stage:'switch-list'});
   await page.reload({waitUntil:'networkidle'});
   await page.waitForFunction(()=>!!window.__NLOBI_QA__,undefined,{timeout:15000});
   await page.evaluate(fixture=>{window.__NLOBI_QA__.setState(fixture);window.__NLOBI_QA__.setView('detail:project-1')},state);
   if(!await page.locator('#detailVolumeGrid.isListView').count()||await page.locator('[data-detail-volume-view="list"]').getAttribute('aria-pressed')!=='true')
    failures.push({engineName,width,stage:'persistence'});
   await page.locator('[data-detail-volume-view="grid"]').click();
   if(await page.locator('#detailVolumeGrid.isListView').count())failures.push({engineName,width,stage:'switch-grid'});
   if(engineName==='Chromium'&&(width===390||width===1280))
    await page.screenshot({path:'visual-results/detail-editorial-phase2-'+width+'.png',fullPage:false});
   await page.locator('[data-open-volume="volume-2"]').click();
   await page.locator('.volumeOpenedHero').waitFor({timeout:4000});
   if(!await page.locator('[data-reader-continue]').count()||!await page.locator('#detailVolumes .volumeChapterList').count())
    failures.push({engineName,width,stage:'open-volume'});
   await page.locator('[data-volume-gallery]').click();
   if(!await page.locator('#detailVolumeGrid').count())failures.push({engineName,width,stage:'return-gallery'});
  }catch(error){failures.push({engineName,width,stage:'exception',message:String(error)})}
  finally{if(runtime.length)failures.push({engineName,width,stage:'runtime',runtime:runtime.slice(0,5)});await context.close()}
 }
 await browser.close();
}
console.log('Detail editorial phase 2:',JSON.stringify({cases:10,failures:failures.length}));
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1)}
