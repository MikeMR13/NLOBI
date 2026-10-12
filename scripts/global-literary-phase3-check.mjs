import {chromium,webkit} from 'playwright';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./full-quality-check.mjs',import.meta.url),'utf8');
const first=source.indexOf('const now='),last=source.indexOf('const viewports=');
if(first<0||last<=first)throw Error('Fixtures de plataforma no disponibles');
const {scenarios}=new Function(source.slice(first,last)+'\nreturn {scenarios};')();
const views=[
 {name:'creator-studio',route:'studio',selector:'.studioV3',surface:'.studioV3Stat'},
 {name:'admin',route:'admin',selector:'.adminWorkspace',surface:'.adminDashboardKpi'},
 {name:'creator-work',route:'studio:work',selector:'.studioV5',surface:'.studioV5Panel'}
];
for(const view of views)if(!scenarios.find(([name])=>name===view.name))throw Error('Fixture faltante: '+view.name);
const css=fs.readFileSync('src/styles.css','utf8');
for(const marker of ['--obi-desk-paper','--obi-desk-rule','.studioV3 .studioV3BookCover::after','html[data-site-motion="reduce"] .studioV3']){
 if(!css.includes(marker))throw Error('Regla del sistema editorial ausente: '+marker);
}
const results=[];let count=0;
fs.mkdirSync('visual-results/global-literary-phase3',{recursive:true});
for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true,args:engineName==='Chromium'?['--no-sandbox']:[]});
 for(const config of [
  {width:320,theme:'graphite',mode:'dark',scale:135,motion:'reduce'},
  {width:390,theme:'amber',mode:'light',scale:100,motion:'system'},
  {width:768,theme:'forest',mode:'dark',scale:120,motion:'system'},
  {width:1280,theme:'amber',mode:'light',scale:100,motion:'system'}
 ]){
  const context=await browser.newContext({viewport:{width:config.width,height:844},serviceWorkers:'block',
    reducedMotion:config.motion==='reduce'?'reduce':'no-preference'});
  await context.addInitScript(p=>localStorage.setItem('nlobi_site_appearance',JSON.stringify(p)),config);
  await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',
    body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
  await context.route('https://qa.supabase.local/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const page=await context.newPage(),runtime=[];
  page.on('pageerror',e=>runtime.push(e.message));
  try{
   await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.__NLOBI_QA__&&document.querySelector('#siteStyles')?.media==='all',undefined,{timeout:16000});
   for(const view of views){
    const [,route,state]=scenarios.find(([name])=>name===view.name);
    await page.evaluate(({route,state})=>{
      window.__NLOBI_QA__.setState({...state,catalogLoading:false,catalogLoaded:true});
      window.__NLOBI_QA__.setView(route);
    },{route,state});
    await page.waitForFunction(target=>window.__NLOBI_QA__?.getState()?.view===target,route,{timeout:8000});
    const m=await page.evaluate(v=>{
     const root=document.documentElement,main=document.querySelector('main'),panel=document.querySelector(v.surface);
     const style=panel?getComputedStyle(panel):null;
     return {
      hasMain:!!document.querySelector(v.selector),
      title:main?.querySelector('h1,h2')?.textContent?.trim()||'',
      panel:!!panel,
      paper:style?.backgroundImage||'',
      shadow:style?.boxShadow||'',
      width:panel?.getBoundingClientRect().width||0,
      overflow:Math.max(0,root.scrollWidth-root.clientWidth),
      theme:root.dataset.siteTheme,
      dark:document.body.classList.contains('dark'),
      broken:document.body.innerText.includes('no pudo mostrar esta vista'),
      forbidden:document.body.innerText.includes('Acceso restringido')
     };
    },view);
    count++;
    if(!m.hasMain||!m.title||!m.panel||m.width<=0||m.shadow==='none'||!m.paper.includes('gradient')||
       m.overflow>2||m.theme!==config.theme||m.dark!==(config.mode==='dark')||m.broken||m.forbidden){
      results.push({engineName,width:config.width,view:view.name,measurement:m});
    }
    if(engineName==='Chromium'&&config.width===390&&view.name!=='creator-work'){
     await page.screenshot({path:'visual-results/global-literary-phase3/'+view.name+'-390.png'});
    }
    if(view.name==='admin'){
     // Verificar que la navegación administrativa conserva su funcionalidad.
     await page.locator('[data-admin-tab="users"]').click();
     const users=await page.evaluate(()=>({table:!!document.querySelector('.adminDirectory'),
       title:document.querySelector('.adminCurrentHead')?.textContent||''}));
     if(!users.table||!users.title.includes('Usuarios'))results.push({engineName,width:config.width,view:'admin-directory',users});
    }
   }
   await page.evaluate(()=>document.documentElement.dataset.siteMotion='reduce');
   await page.evaluate(({route,state})=>{window.__NLOBI_QA__.setState(state);window.__NLOBI_QA__.setView(route)},(()=>{
      const [,route,state]=scenarios.find(([name])=>name==='creator-studio');return {route,state};
   })());
   const reduced=await page.evaluate(()=>{
    const e=document.querySelector('.studioV3BookCard'),s=e&&getComputedStyle(e);
    return {exists:!!e,transition:s?.transitionDuration,transform:s?.transform};
   });
   if(reduced.exists&&(reduced.transition?.split(',').some(x=>parseFloat(x)>0)||reduced.transform!=='none')){
    results.push({engineName,width:config.width,view:'reduced-motion',reduced});
   }
   if(runtime.length)results.push({engineName,width:config.width,view:'runtime',errors:runtime.slice(0,6)});
  }catch(e){results.push({engineName,width:config.width,error:String(e)})}
  finally{await context.close()}
 }
 await browser.close();
}
console.log('Global literary phase 3:',JSON.stringify({scenarios:count,failures:results.length}));
if(results.length){console.error(JSON.stringify(results.slice(0,25),null,2));process.exit(1)}
