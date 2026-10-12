import { chromium } from 'playwright';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./full-quality-check.mjs',import.meta.url),'utf8');
const start=source.indexOf('const now='),end=source.indexOf('const viewports=');
if(start<0||end<=start)throw Error('No se encontraron las muestras QA del catálogo');
const {scenarios}=new Function(source.slice(start,end)+'\nreturn {scenarios};')();
const base=scenarios.find(([name])=>name==='public-home');
const carousel=scenarios.find(([name])=>name==='public-home-carousel');
if(!base||!carousel)throw Error('Faltan escenarios QA para el Home');
const viewports=[
 {width:320,height:800,theme:'graphite',mode:'dark',corners:'soft'},
 {width:390,height:844,theme:'amber',mode:'light',corners:'normal'},
 {width:1280,height:900,theme:'amber',mode:'dark',corners:'square'}
];
const failures=[];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
fs.mkdirSync('visual-results',{recursive:true});
for(const config of viewports){
 const context=await browser.newContext({viewport:{width:config.width,height:config.height},serviceWorkers:'block'});
 await context.addInitScript(settings=>localStorage.setItem('nlobi_site_appearance',JSON.stringify(settings)),{
  theme:config.theme,mode:config.mode,corners:config.corners,scale:100
 });
 await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
 await context.route('https://qa.supabase.local/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await context.route('https://example.test/**',r=>r.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZpTQAAAAASUVORK5CYII=','base64')}));
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__NLOBI_QA__,undefined,{timeout:15000});
  await page.evaluate(state=>{window.__NLOBI_QA__.setState(state);window.__NLOBI_QA__.setView('home')},base[2]);
  const current=await page.evaluate(()=>{
   const hero=document.querySelector('.homeShowcase');
   const gridCards=[...document.querySelectorAll('.homeBookCard.homeNovelTile')];
   const shelfCards=[...document.querySelectorAll('.discoverShelfTrack .catalogEditorialCard.homeNovelTile')];
   const cards=[...gridCards,...shelfCards];
   const ratios=cards.map(card=>{
    const cover=card.querySelector('.homeBookCoverLink,.catalogCoverButton');
    const r=cover?.getBoundingClientRect();
    return r&&r.width?Number((r.height/r.width).toFixed(2)):0;
   });
   const releaseGrid=document.querySelector('.homeVolumeReleaseGrid');
   return {
    heroHeight:Math.round(hero?.getBoundingClientRect().height||0),
    horizontalOverflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    errorView:document.body.innerText.includes('no pudo mostrar esta vista'),
    cards:cards.length,
    gridCards:gridCards.length,
    shelfCards:shelfCards.length,
    ratios,
    releaseGrid:!!releaseGrid,
    corners:document.documentElement.dataset.siteCorners,
    buttonAria:[...document.querySelectorAll('.discoverShelfActions [data-shelf-scroll]')].every(b=>b.getAttribute('aria-controls')===b.closest('.discoverShelf')?.querySelector('.discoverShelfTrack')?.id)
   };
  });
  if(current.horizontalOverflow>2||current.errorView||current.cards<2||!current.gridCards||!current.shelfCards)failures.push({config,error:'estructura o reflow',current});
  if(current.ratios.some(r=>r<1.42||r>1.58))failures.push({config,error:'portadas con proporciones inconsistentes',ratios:current.ratios});
  if(config.width===390&&current.heroHeight>750)failures.push({config,error:'encabezado demasiado alto',heroHeight:current.heroHeight});
  if(current.corners!==config.corners||!current.buttonAria)failures.push({config,error:'personalización o controles sin vincular'});
  if(config.width===390){
   const shelf=page.locator('.discoverShelf').first();
   await shelf.locator('.discoverShelfTrack').evaluate(track=>{
    while(track.children.length<5)track.appendChild(track.firstElementChild.cloneNode(true));
    track.dispatchEvent(new Event('scroll'));
   });
   const prev=shelf.locator('[data-direction="-1"]'),next=shelf.locator('[data-direction="1"]');
   await page.waitForFunction(()=>{const el=document.querySelector('.discoverShelfTrack');return el&&el.scrollWidth>el.clientWidth+20});
   if(!await prev.isDisabled()||await next.isDisabled())failures.push({config,error:'límites iniciales del carrusel'});
   else{
    await next.click();
    await page.waitForFunction(()=>document.querySelector('.discoverShelfTrack')?.scrollLeft>10,undefined,{timeout:3500});
    await page.waitForFunction(()=>{
     const track=document.querySelector('.discoverShelfTrack');
     const previous=document.querySelector('.discoverShelf [data-direction="-1"]');
     return track&&track.scrollLeft>10&&previous&&!previous.disabled;
    },undefined,{timeout:3500});
   }
  }
  if(config.width===1280){
   await page.evaluate(state=>{window.__NLOBI_QA__.setState(state);window.__NLOBI_QA__.setView('home')},carousel[2]);
   const before=await page.locator('.homeFeaturedCoverLink').getAttribute('href');
   await page.locator('[data-featured-step="1"]').click();
   const after=await page.locator('.homeFeaturedCoverLink').getAttribute('href');
   if(before===after)failures.push({config,error:'el carrusel destacado no cambia de obra'});
  }
  if(config.width!==320)await page.screenshot({path:'visual-results/home-editorial-fase2-'+config.width+'.png',fullPage:false});
 }catch(error){failures.push({config,error:String(error)})}
 finally{
  if(errors.length)failures.push({config,error:'errores JavaScript',messages:errors.slice(0,5)});
  await context.close();
 }
}
await browser.close();
console.log('Home editorial fase 2:',JSON.stringify({viewports:viewports.length,failures:failures.length}));
if(failures.length){
 console.error(JSON.stringify(failures,null,2));
 process.exit(1);
}