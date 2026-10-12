import { chromium, webkit } from 'playwright';
import fs from 'node:fs';

// Reuse the complete public-detail fixture, including a long title, synopsis and published chapters.
const source=fs.readFileSync(new URL('./full-quality-check.mjs',import.meta.url),'utf8');
const from=source.indexOf('const now='),to=source.indexOf('const viewports=');
if(from<0||to<=from)throw Error('Missing shared QA fixtures');
const {scenarios}=new Function(source.slice(from,to)+'\nreturn {scenarios};')();
const sample=scenarios.find(([name])=>name==='public-detail');
if(!sample)throw Error('Missing public-detail scenario');
const baseline=sample[2];
const failures=[];
fs.mkdirSync('visual-results',{recursive:true});

for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 for(const width of [320,390,720,1280]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
  await context.route('https://qa.supabase.local/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await context.route('https://example.test/**',r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZpTQAAAAASUVORK5CYII=','base64')}));
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:4173/#detail:project-1',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>!!window.__NLOBI_QA__,undefined,{timeout:15000});
   await page.evaluate(state=>{window.__NLOBI_QA__.setState(state);window.__NLOBI_QA__.setView('detail:project-1')},baseline);
   await page.locator('#detailNovelTitle').waitFor();
   const base=await page.evaluate(()=>{
    const hero=document.querySelector('.detailEditorialHero'),cover=hero?.querySelector('.detailCover'),p=document.querySelector('#detailSynopsisText');
    return {overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      title:!!hero?.querySelector('h1'),fallback:!!cover?.querySelector('span'),sourceCover:!!cover?.querySelector('img'),
      hasType:hero?.innerText.includes('Novela ligera'),hasAuthor:!!hero?.querySelector('.detailEditorialAuthor'),
      synopsisClamp:getComputedStyle(p).webkitLineClamp,showRead:!!hero?.querySelector('[data-reader-continue="volume-1"][data-reader-start="section-1"]'),
      hasVolumes:!!document.getElementById('detailVolumes'),heroHeight:Math.round(hero?.getBoundingClientRect().height||0)};
   });
   if(base.overflow>2||!base.title||!base.fallback||base.sourceCover||!base.hasType||!base.hasAuthor||base.synopsisClamp!=='4'||!base.showRead||!base.hasVolumes)failures.push({engineName,width,phase:'fallback/meta/layout',base});
   const toggle=page.locator('#detailSynopsisToggle');
   if(!await toggle.count())throw Error('Synopsis expand control missing');
   await toggle.click();
   await page.waitForFunction(()=>document.querySelector('#detailSynopsisToggle')?.getAttribute('aria-expanded')==='true'&&!!document.querySelector('.detailSynopsis.is-expanded'),undefined,{timeout:5000}).catch(()=>{});
   if(await toggle.getAttribute('aria-expanded')!=='true'||!await page.locator('.detailSynopsis.is-expanded').count())failures.push({engineName,width,phase:'expand'});
   if(!await toggle.evaluate(e=>document.activeElement===e))failures.push({engineName,width,phase:'focus'});
   await toggle.click();
   await page.waitForFunction(()=>document.querySelector('#detailSynopsisToggle')?.getAttribute('aria-expanded')==='false',undefined,{timeout:5000}).catch(()=>{});
   if(await toggle.getAttribute('aria-expanded')!=='false')failures.push({engineName,width,phase:'collapse'});
   const imageWork={...baseline.currentDetail,novels:{...baseline.currentDetail.novels,cover_url:'https://example.test/cover.jpg'}};
   await page.evaluate((state)=>{
    window.__NLOBI_QA__.setState(state);
    window.__NLOBI_QA__.setView('detail:project-1');
   },{...baseline,currentDetail:imageWork,catalog:[imageWork]});
   const artwork=await page.evaluate(()=>{
    const c=document.querySelector('.detailEditorialHero .detailCover');
    return {hasImage:!!c?.querySelector('img'),hasArtworkClass:!!c?.classList.contains('hasImage'),
      overlay:c?getComputedStyle(c,'::after').display:null,duplicateTitle:!!c?.querySelector('span:not(.demoRibbon)'),
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      readControls:document.querySelectorAll('.detailEditorialActions [data-reader-continue]').length,
      type:document.querySelector('.detailEditorialBadges')?.innerText||''};
   });
   if(!artwork.hasImage||!artwork.hasArtworkClass||artwork.overlay!=='none'||artwork.duplicateTitle||artwork.overflow>2||artwork.readControls!==1||!artwork.type.includes('Novela ligera'))failures.push({engineName,width,phase:'cover/artwork',artwork});
   if(engineName==='Chromium'&&(width===390||width===1280))await page.screenshot({path:'visual-results/detail-editorial-phase1-'+width+'.png',fullPage:false});
  }catch(e){failures.push({engineName,width,phase:'exception',message:String(e)})}
  finally{
   if(errors.length)failures.push({engineName,width,phase:'runtime',errors:errors.slice(0,5)});
   await context.close();
  }
 }
 await browser.close();
}
console.log('Detail editorial phase 1:',JSON.stringify({cases:8,failures:failures.length}));
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1)}
