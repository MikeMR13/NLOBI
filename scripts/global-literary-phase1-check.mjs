import {chromium,webkit} from 'playwright';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./full-quality-check.mjs',import.meta.url),'utf8');
const start=source.indexOf('const now='),end=source.indexOf('const viewports=');
if(start<0||end<=start)throw Error('Fixtures de QA no disponibles');
const {scenarios}=new Function(source.slice(start,end)+'\nreturn {scenarios};')();
const cases=[
 {name:'public-home',route:'home',selector:'.homeEditorial .catalogEditorialCard,.homeEditorial .homeBookCard'},
 {name:'public-explore',route:'explore',selector:'.exploreEditorial .catalogEditorialCard'},
 {name:'user-library',route:'library',selector:'.libraryEditorial .libraryShelfCard'}
];
const style=fs.readFileSync('src/styles.css','utf8');
for(const marker of ['--obi-book-paper','--obi-book-depth','object-fit:contain','html[data-site-motion="reduce"] :is(.homeEditorial,.exploreEditorial,.libraryEditorial)']){
 if(!style.includes(marker))throw Error('Token visual compartido ausente: '+marker);
}
const absent=cases.filter(x=>!scenarios.some(([name])=>name===x.name));
if(absent.length)throw Error('Faltan escenarios: '+absent.map(x=>x.name).join(','));
const problems=[];
let evaluated=0;
fs.mkdirSync('visual-results/global-literary-phase1',{recursive:true});
for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 for(const config of [
  {width:320,theme:'graphite',mode:'dark',motion:'reduce',scale:135},
  {width:390,theme:'amber',mode:'light',motion:'system',scale:100},
  {width:768,theme:'forest',mode:'dark',motion:'system',scale:120},
  {width:1280,theme:'amber',mode:'light',motion:'system',scale:100}
 ]){
  const context=await browser.newContext({viewport:{width:config.width,height:844},serviceWorkers:'block',reducedMotion:config.motion==='reduce'?'reduce':'no-preference'});
  await context.addInitScript(settings=>localStorage.setItem('nlobi_site_appearance',JSON.stringify({theme:settings.theme,mode:settings.mode,motion:settings.motion,scale:settings.scale})),config);
  await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
  await context.route('https://qa.supabase.local/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.__NLOBI_QA__&&document.querySelector('#siteStyles')?.media==='all',undefined,{timeout:15000});
   for(const item of cases){
    const fixture=scenarios.find(([name])=>name===item.name);
    await page.evaluate(({route,state})=>{
     window.__NLOBI_QA__.setState({...state,catalogLoading:false,catalogLoaded:true,libraryTab:'books',libraryFilter:'all',libraryQuery:''});
     window.__NLOBI_QA__.setView(route);
    },{route:item.route,state:fixture[2]});
    await page.waitForFunction(route=>window.__NLOBI_QA__?.getState()?.view===route, item.route);
    const info=await page.evaluate(selector=>{
     const el=document.querySelector(selector),s=el?getComputedStyle(el):null;
     const root=document.documentElement,main=document.querySelector('main');
     const pictures=[...document.querySelectorAll('main .catalogBookArt img,main .homeBookCover img,main .libraryShelfCover img,main .libraryContinueCover img')];
     return {
      exists:!!el,theme:root.dataset.siteTheme,
      dark:document.body.classList.contains('dark'),
      motion:root.dataset.siteMotion,
      overflow:Math.max(0,root.scrollWidth-root.clientWidth),
      bg:s?.backgroundImage||'',shadow:s?.boxShadow||'',
      imageFits:pictures.map(p=>getComputedStyle(p).objectFit),
      error:document.body.innerText.includes('no pudo mostrar esta vista'),
      content:main?.innerText?.length||0,
      fullFocus:!!document.querySelector('main :focus-visible')
     };
    },item.selector);
    evaluated++;
    if(!info.exists||info.content<40||info.error||info.overflow>2||info.theme!==config.theme||info.dark!==(config.mode==='dark')||!info.bg.includes('gradient')||info.shadow==='none'||info.imageFits.some(f=>f!=='contain')){
      problems.push({engineName,width:config.width,scenario:item.name,info});
    }
    if(engineName==='Chromium'&&config.width===390&&item.route!=='library')await page.screenshot({path:'visual-results/global-literary-phase1/'+item.route+'-390.png'});
   }
   if(errors.length)problems.push({engineName,width:config.width,runtime:errors.slice(0,5)});
  }catch(e){problems.push({engineName,width:config.width,error:String(e)})}
  finally{await context.close()}
 }
 await browser.close();
}
console.log('Global literary phase 1 visual QA',JSON.stringify({scenarios:evaluated,problems:problems.length}));
if(problems.length){console.error(JSON.stringify(problems.slice(0,30),null,2));process.exit(1)}
