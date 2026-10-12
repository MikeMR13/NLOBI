import { chromium, webkit } from 'playwright';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./full-quality-check.mjs',import.meta.url),'utf8');
const start=source.indexOf('const now='),end=source.indexOf('const viewports=');
if(start<0||end<=start)throw Error('Fixtures QA no disponibles');
const {scenarios}=new Function(source.slice(start,end)+'\nreturn {scenarios};')();
const fixture=scenarios.find(([name])=>name==='public-detail')?.[2];
if(!fixture)throw Error('Falta la ficha pública para QA');
const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZpTQAAAAASUVORK5CYII=','base64');
const published=(id,num,sections)=>({id,volume_number:num,title:'Novela, volumen '+num,status:'published',cover_url:'https://example.test/'+id+'.png',sections});
const chapters=(volumeId,prefix,count)=>Array.from({length:count},(_,i)=>({id:prefix+'-'+(i+1),volume_id:volumeId,title:(i===0?'Prólogo: ':'Capítulo: ')+prefix+' '+(i+1),section_type:i===0?'prologue':'chapter',section_number:i+1,status:'published',sort_order:i+1}));
const volume1=published('volume-1',1,chapters('volume-1','chapterA',4));
const volume2=published('volume-2',2,chapters('volume-2','chapterB',3));
const volume3=published('volume-3',3,chapters('volume-3','chapterC',2));
const hidden={...published('volume-4',4,chapters('volume-4','draft',1)),status:'draft'};
const novel={...fixture.currentDetail,volumes:[volume1,volume2,volume3,hidden]};
const state={...fixture,currentDetail:novel,catalog:[novel],readSections:['chapterA-1','chapterA-2','chapterB-1'],readingProgress:[],detailReviewsFor:novel.id};
const failures=[];
fs.mkdirSync('visual-results',{recursive:true});

for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 for(const width of [320,390,580,768,1280]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
  await context.route('https://qa.supabase.local/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await context.route('https://example.test/**',r=>r.fulfill({status:200,contentType:'image/png',body:image}));
  const page=await context.newPage(),runtime=[];
  page.on('pageerror',e=>runtime.push(e.message));
  try{
   await page.goto('http://127.0.0.1:4173/#detail:project-1',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>!!window.__NLOBI_QA__,undefined,{timeout:15000});
   await page.evaluate(data=>{window.__NLOBI_QA__.setState(data);window.__NLOBI_QA__.setView('detail:project-1')},state);
   await page.locator('#detailVolumeGrid').waitFor();
   await page.evaluate(()=>{document.body.style.minHeight='3500px';window.scrollTo({top:Math.min(190,document.documentElement.scrollHeight-innerHeight)})});
   const galleryY=await page.evaluate(()=>window.scrollY);
   await page.locator('[data-open-volume="volume-1"]').click();
   await page.locator('#volumeOpenedTitle').waitFor();
   const opened=await page.evaluate(()=>{
    const index=document.querySelector('.volumeChapterIndex');
    return {count:index?.querySelectorAll('.volumeChapterRow').length,
      read:[...index?.querySelectorAll('.volumeChapterRow.isRead')||[]].map(n=>n.dataset.chapterRow),
      next:index?.querySelector('.volumeChapterRow.isNext')?.dataset.chapterRow,
      continueStart:document.querySelector('.volumeOpenedActions [data-reader-continue]')?.dataset.readerStart,
      continueText:document.querySelector('.volumeOpenedActions [data-reader-continue]')?.innerText,
      hasPreferences:!!document.querySelector('.volumeOpenedPreferences .readerVolumeOptions'),
      progress:document.querySelector('.volumeOpenedProgress progress')?.value,
      progressMax:document.querySelector('.volumeOpenedProgress progress')?.max,
      nextVolume:document.querySelector('[data-switch-volume="volume-2"]')?.getAttribute('aria-label'),
      hidden:!!document.querySelector('[data-switch-volume="volume-4"]'),
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
   });
   if(opened.count!==4||opened.read.join(',')!=='chapterA-1,chapterA-2'||opened.next!=='chapterA-3'||
      opened.continueStart!=='chapterA-3'||!opened.continueText?.includes('Continuar')||!opened.hasPreferences||
      opened.progress!==2||opened.progressMax!==4||!opened.nextVolume?.includes('siguiente')||opened.hidden||opened.overflow>2)
     failures.push({name,width,stage:'volume',opened});
   await page.locator('[data-switch-volume="volume-2"]').first().click();
   const second=await page.evaluate(()=>({
     title:document.querySelector('#volumeOpenedTitle')?.innerText,
     chapters:document.querySelectorAll('.volumeChapterRow').length,
     progress:document.querySelector('.volumeOpenedProgress progress')?.value,
     previous:!!document.querySelector('[data-switch-volume="volume-1"]'),
     next:!!document.querySelector('[data-switch-volume="volume-3"]'),
     overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
   }));
   if(second.chapters!==3||second.progress!==1||!second.previous||!second.next||second.overflow>2||!second.title?.includes('2'))failures.push({name,width,stage:'next',second});
   await page.locator('[data-switch-volume="volume-3"]').first().click();
   if(await page.locator('[data-switch-volume="volume-4"]').count()||await page.locator('[data-switch-volume="volume-2"]').count()===0)
     failures.push({name,width,stage:'last-volume'});
   await page.locator('[data-volume-gallery]').click();
   await page.waitForFunction(()=>document.querySelector('#detailVolumeGrid')&&Math.abs(window.scrollY-190)<=5,undefined,{timeout:4000}).catch(()=>{});
   const back=await page.evaluate(()=>({isGallery:!!document.querySelector('#detailVolumeGrid'),y:window.scrollY,overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth}));
   if(!back.isGallery||Math.abs(back.y-galleryY)>8||back.overflow>2)failures.push({name,width,stage:'return-to-gallery',back,galleryY});
   if(name==='Chromium'&&(width===390||width===1280)){
    await page.locator('[data-open-volume="volume-2"]').click();
    await page.screenshot({path:'visual-results/detail-editorial-phase3-'+width+'.png',fullPage:false});
   }
   // Simulate browser Back after leaving a volume for the reader; avoid private reader API.
   await page.evaluate(()=>{
     window.__NLOBI_QA__.setState({detailScrollReturn:{translationId:'project-1',volumeId:'volume-1',y:190},detailVolumeId:'volume-1',detailReviewsFor:'project-1'});
     window.__NLOBI_QA__.setView('reader:chapterA-3');
     location.hash='#detail:project-1';
   });
   await page.waitForFunction(()=>window.__NLOBI_QA__?.getState()?.view==='detail:project-1'&&window.__NLOBI_QA__?.getState()?.detailScrollReturn===null,undefined,{timeout:10000});
   const restored=await page.evaluate(()=>({y:window.scrollY,volume:window.__NLOBI_QA__.getState().detailVolumeId,opened:!!document.querySelector('#volumeOpenedTitle')}));
   if(Math.abs(restored.y-190)>8||restored.volume!=='volume-1'||!restored.opened)failures.push({name,width,stage:'reader-return',restored});
  }catch(e){failures.push({name,width,stage:'exception',error:String(e)})}
  finally{if(runtime.length)failures.push({name,width,stage:'runtime',runtime:runtime.slice(0,6)});await context.close()}
 }
 await browser.close();
}
console.log('Detail editorial phase 3:',JSON.stringify({cases:10,failures:failures.length}));
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1)}
