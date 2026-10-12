import { chromium, webkit } from 'playwright';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./full-quality-check.mjs',import.meta.url),'utf8');
const start=source.indexOf('const now='),end=source.indexOf('const viewports=');
if(start<0||end<=start)throw Error('Faltan fixtures de QA para ficha de obra');
const {scenarios}=new Function(source.slice(start,end)+'\nreturn {scenarios};')();
const fixture=scenarios.find(([name])=>name==='public-detail')?.[2];
if(!fixture)throw Error('No existe fixture público de detalle');
const styles=fs.readFileSync('src/styles.css','utf8');
for(const marker of ['obiVolumeCoverOpen','obiVolumePaperEnter','html[data-site-motion="reduce"]','.volumeEditorialOpened .volumeChapterIndex']){
 if(!styles.includes(marker))throw Error('Estilo literario ausente: '+marker);
}
const chapters=Array.from({length:3},(_,i)=>({id:'phase4-ch-'+i,volume_id:'phase4-vol',title:'Capítulo '+(i+1),section_type:'chapter',sort_order:i+1,section_number:i+1,status:'published'}));
const volume={id:'phase4-vol',volume_number:1,title:'Primer volumen de una novela extensa',status:'published',cover_url:'https://example.test/volume.png',sections:chapters};
const novel={...fixture.currentDetail,volumes:[volume]};
const data={...fixture,currentDetail:novel,catalog:[novel],readSections:[chapters[0].id],detailVolumeId:null,detailVolumeView:'grid'};
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZpTQAAAAASUVORK5CYII=','base64');
const failures=[];
fs.mkdirSync('visual-results/detail-phase4',{recursive:true});
const snapshot=async page=>page.evaluate(()=>{
 const card=document.querySelector('.volumeEditorialCard');
 const cover=document.querySelector('.volumeOpenedCover');
 const index=document.querySelector('.volumeChapterIndex');
 return {
  card:!!card,cover:!!cover,index:!!index,
  animation:cover?getComputedStyle(cover).animationName:'',
  indexAnimation:index?getComputedStyle(index).animationName:'',
  paper:index?getComputedStyle(index).backgroundImage:'',
  coverFit:cover?getComputedStyle(cover.querySelector('img')).objectFit:'',
  overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
  chapterCount:document.querySelectorAll('.volumeChapterRow').length,
  read:document.querySelectorAll('.volumeChapterRow.isRead').length,
  url:location.hash,
  scrollY:window.scrollY
 };
});
for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 for(const width of [320,390,768,1280]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
  await context.route('https://qa.supabase.local/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await context.route('https://example.test/**',r=>r.fulfill({status:200,contentType:'image/png',body:image}));
  const page=await context.newPage(),runtime=[];
  page.on('pageerror',e=>runtime.push(e.message));
  try{
   await page.goto('http://127.0.0.1:4173/#detail:project-1',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>!!window.__NLOBI_QA__,undefined,{timeout:15000});
   await page.evaluate(data=>{localStorage.setItem('nlobi_detail_volume_view','grid');window.__NLOBI_QA__.setState(data);window.__NLOBI_QA__.setView('detail:project-1')},data);
   await page.locator('.volumeEditorialCard').waitFor();
   const before=await snapshot(page);
   if(!before.card||before.overflow>2)failures.push({engineName,width,stage:'gallery',before});
   await page.locator('[data-open-volume="phase4-vol"]').click();
   await page.locator('.volumeChapterIndex').waitFor();
   const normal=await snapshot(page);
   if(!normal.cover||!normal.index||normal.chapterCount!==3||normal.read!==1||normal.coverFit!=='contain'||normal.overflow>2||!normal.animation.includes('obiVolumeCoverOpen')||!normal.indexAnimation.includes('obiVolumePaperEnter')||normal.paper==='none')failures.push({engineName,width,stage:'open',normal});
   await page.evaluate(()=>document.body.classList.add('dark'));
   const dark=await snapshot(page);
   if(!dark.cover||dark.overflow>2||dark.paper==='none')failures.push({engineName,width,stage:'dark',dark});
   await page.evaluate(()=>document.documentElement.dataset.siteMotion='reduce');
   const reducedSite=await snapshot(page);
   if(reducedSite.animation!=='none'||reducedSite.indexAnimation!=='none')failures.push({engineName,width,stage:'site-motion-reduced',reducedSite});
   await page.evaluate(()=>delete document.documentElement.dataset.siteMotion);
   await page.emulateMedia({reducedMotion:'reduce'});
   const reducedOS=await snapshot(page);
   if(reducedOS.animation!=='none'||reducedOS.indexAnimation!=='none')failures.push({engineName,width,stage:'os-motion-reduced',reducedOS});
   await page.emulateMedia({reducedMotion:'no-preference'});
   await page.locator('[data-volume-gallery]').click();
   await page.locator('#detailVolumeGrid').waitFor();
   await page.locator('[data-detail-volume-view="list"]').click();
   const list=await snapshot(page);
   if(!list.card||list.overflow>2||!await page.locator('#detailVolumeGrid.isListView').count())failures.push({engineName,width,stage:'list',list});
   if(engineName==='Chromium'&&(width===390||width===1280)){
    await page.locator('[data-detail-volume-view="grid"]').click();
    await page.screenshot({path:'visual-results/detail-phase4/'+width+'-shelf.png',fullPage:false});
    await page.locator('[data-open-volume="phase4-vol"]').click();
    await page.screenshot({path:'visual-results/detail-phase4/'+width+'-opened.png',fullPage:false});
   }
  }catch(e){failures.push({engineName,width,stage:'exception',error:String(e)})}
  finally{if(runtime.length)failures.push({engineName,width,stage:'runtime',runtime:runtime.slice(0,5)});await context.close()}
 }
 await browser.close();
}
console.log('Detail editorial phase 4:',JSON.stringify({cases:8,failures:failures.length}));
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1)}
