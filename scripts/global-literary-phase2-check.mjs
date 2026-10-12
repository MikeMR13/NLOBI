import {chromium,webkit} from 'playwright';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./full-quality-check.mjs',import.meta.url),'utf8');
const start=source.indexOf('const now='),end=source.indexOf('const viewports=');
if(start<0||end<=start)throw Error('Fixtures de QA no disponibles');
const {scenarios}=new Function(source.slice(start,end)+'\nreturn {scenarios};')();
const definitions=[
 {name:'public-profile',selector:'.publicReaderHero',cards:'.publicReaderStats>div'},
 {name:'public-group',selector:'.teamIdentityHero',cards:'.teamPublicOverview .teamPublicStat'},
 {name:'user-notifications',selector:'.notificationsShowcase',cards:'.notificationFeedCard'},
 {name:'public-reader-discovery',selector:'.readerDirectoryHero',cards:'.readerDirectoryCard'}
];
for(const d of definitions)if(!scenarios.some(([name])=>name===d.name))throw Error('Sin fixture '+d.name);
const css=fs.readFileSync('src/styles.css','utf8');
for(const marker of ['--obi-community-paper','--obi-community-shadow','notificationsEditorial .notificationFeedCard.unread',
 'html[data-site-motion="reduce"] :is(.readerDirectory .readerDirectoryCard']){
 if(!css.includes(marker))throw Error('Falta acabado literario de comunidad: '+marker);
}
const failures=[];let cases=0;
fs.mkdirSync('visual-results/global-literary-phase2',{recursive:true});
for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true,args:engineName==='Chromium'?['--no-sandbox']:[]});
 for(const config of [
  {width:320,theme:'graphite',mode:'dark',motion:'reduce'},
  {width:390,theme:'amber',mode:'light',motion:'system'},
  {width:768,theme:'indigo',mode:'dark',motion:'system'},
  {width:1280,theme:'amber',mode:'light',motion:'system'}
 ]){
  const context=await browser.newContext({viewport:{width:config.width,height:844},serviceWorkers:'block',
   reducedMotion:config.motion==='reduce'?'reduce':'no-preference'});
  await context.addInitScript(p=>localStorage.setItem('nlobi_site_appearance',JSON.stringify(p)),config);
  await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',
   body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
  await context.route('https://qa.supabase.local/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.__NLOBI_QA__&&document.querySelector('#siteStyles')?.media==='all',undefined,{timeout:15000});
   for(const d of definitions){
    const [,view,state]=scenarios.find(([name])=>name===d.name);
    await page.evaluate(({view,state})=>{
      window.__NLOBI_QA__.setState({...state,catalogLoading:false,catalogLoaded:true});
      window.__NLOBI_QA__.setView(view);
    },{view,state});
    await page.waitForFunction(route=>window.__NLOBI_QA__?.getState()?.view===route,view,{timeout:7000});
    const info=await page.evaluate(({selector,cards})=>{
      const root=document.documentElement,hero=document.querySelector(selector),card=document.querySelector(cards);
      const cs=card?getComputedStyle(card):null;
      const main=document.querySelector('main');
      return {
       title:main?.querySelector('h1')?.textContent?.trim()||'',
       hero:!!hero,card:!!card,
       paper:cs?.backgroundImage||'',shadow:cs?.boxShadow||'',
       overflow:Math.max(0,root.scrollWidth-root.clientWidth),
       theme:root.dataset.siteTheme,
       dark:document.body.classList.contains('dark'),
       broken:document.body.innerText.includes('no pudo mostrar esta vista'),
       transitions:cs?.transitionDuration||'',
       coverFit:main?.querySelector('.publicReaderBookCover img')?getComputedStyle(main.querySelector('.publicReaderBookCover img')).objectFit:null,
       groupBannerImage:main?.querySelector('.teamIdentityBanner')?getComputedStyle(main.querySelector('.teamIdentityBanner')).backgroundImage:null
      };
    },d);
    cases++;
    if(!info.hero||!info.card||!info.title||info.broken||info.overflow>2||info.theme!==config.theme||
       info.dark!==(config.mode==='dark')||!info.paper.includes('gradient')||info.shadow==='none'||
       (info.coverFit&&info.coverFit!=='contain')){
       failures.push({engineName,width:config.width,name:d.name,info});
    }
    if(d.name==='user-notifications'){
      const unread=await page.locator('.notificationFeedCard.unread').count();
      if(!unread)failures.push({engineName,width:config.width,name:d.name,error:'Sin avisos no leídos'});
    }
    if(engineName==='Chromium'&&config.width===390&&['public-group','user-notifications'].includes(d.name)){
     await page.screenshot({path:'visual-results/global-literary-phase2/'+d.name+'-390.png'});
    }
   }
   await page.evaluate(()=>document.documentElement.dataset.siteMotion='reduce');
   const reduced=await page.evaluate(()=>{
     const e=document.querySelector('.readerDirectoryCard'),style=e&&getComputedStyle(e);
     return {transition:style?.transitionDuration,transform:style?.transform};
   });
   if(reduced.transition?.split(',').some(x=>parseFloat(x)>0)||reduced.transform!=='none'){
     failures.push({engineName,width:config.width,error:'Movimiento reducido no respetado',reduced});
   }
   if(errors.length)failures.push({engineName,width:config.width,errors:errors.slice(0,5)});
  }catch(e){failures.push({engineName,width:config.width,error:String(e)})}
  finally{await context.close()}
 }
 await browser.close();
}
console.log('Global literary phase 2:',JSON.stringify({cases,failures:failures.length}));
if(failures.length){console.error(JSON.stringify(failures.slice(0,20),null,2));process.exit(1)}
