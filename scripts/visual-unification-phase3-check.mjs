import {chromium} from 'playwright';
import fs from 'node:fs';

/* Site-wide visual cohesion regression: public and authenticated editorial surfaces.
   Reuse the full-quality test's maintained fixtures instead of duplicating mock data. */
const source=fs.readFileSync(new URL('./full-quality-check.mjs',import.meta.url),'utf8');
const fixtureStart=source.indexOf('const now=');
const fixtureEnd=source.indexOf('const viewports=');
if(fixtureStart<0||fixtureEnd<=fixtureStart)throw Error('The full-quality fixtures could not be located');
const {scenarios}=new Function(source.slice(fixtureStart,fixtureEnd)+'\nreturn {scenarios};')();
const choices=['public-home','public-explore','public-detail','user-library','creator-studio','admin','public-reader'];
const cases=scenarios.filter(([name])=>choices.includes(name));
if(cases.length!==choices.length)throw Error('Missing editorial QA scenarios: '+choices.filter(name=>!cases.some(row=>row[0]===name)));
const viewports=[
 {width:320,height:800,scale:135,theme:'graphite',mode:'dark',corners:'soft'},
 {width:390,height:844,scale:100,theme:'amber',mode:'light',corners:'normal'},
 {width:768,height:1024,scale:135,theme:'indigo',mode:'dark',corners:'square'},
 {width:1280,height:900,scale:100,theme:'amber',mode:'dark',corners:'normal'}
];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const failures=[];
let total=0;
for(const viewport of viewports){
 const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},serviceWorkers:'block'});
 await context.addInitScript(settings=>{
  localStorage.setItem('nlobi_site_appearance',JSON.stringify(settings));
 },{theme:viewport.theme,mode:viewport.mode,scale:viewport.scale,corners:viewport.corners});
 await context.route('**/runtime-config.js',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"
 }));
 await context.route('https://qa.supabase.local/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
 const page=await context.newPage();
 const runtime=[];
 page.on('pageerror',error=>runtime.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__NLOBI_QA__,undefined,{timeout:12000});
  for(const [name,view,state] of cases){
   runtime.length=0;
   await page.evaluate(({view,state})=>{
    window.__NLOBI_QA__.setState(state);
    window.__NLOBI_QA__.setView(view);
   },{view,state});
   const result=await page.evaluate(()=>{
    const main=document.querySelector('main'), root=document.documentElement;
    const surfaces=[...document.querySelectorAll('.homeBookCard,.homeFeatured,.catalogEditorialCard,.libraryShelfCard,.libraryContinueCard,.studioBookCard,.studioVolumeCard,.adminDashboardKpi,.adminDashboardPanel,.readerVolumeOptions,.readerEditCard')].filter(el=>el.getBoundingClientRect().width>0);
    const buttons=[...document.querySelectorAll('main .btn')].filter(el=>{
     const r=el.getBoundingClientRect(),s=getComputedStyle(el);
     return r.height>0&&r.width>0&&s.visibility!=='hidden'&&!el.closest('[hidden]');
    });
    const undersized=buttons.filter(el=>{
     const r=el.getBoundingClientRect();
     const section=el.closest('.homeEditorial,.exploreEditorial,.libraryEditorial,.studioWrap,.adminWorkspace,.readerVolumeOptions,.siteAppearancePanel,.readerSettingsPanel');
     return section&&r.height<43;
    }).slice(0,5).map(el=>({label:el.innerText.slice(0,35),height:Math.round(el.getBoundingClientRect().height)}));
    const title=main?.querySelector('h1,h2,strong')?.innerText||'';
    const showcase=document.querySelector('.homeEditorial .homeShowcase');
    return {
     rootOverflow:Math.max(0,root.scrollWidth-root.clientWidth),
     mainText:main?.innerText?.trim().length||0,
     title:title.slice(0,65),
     surfaces:surfaces.length,
     undersized,
     heroHeight:showcase?Math.round(showcase.getBoundingClientRect().height):null,
     readerPaperFont:document.querySelector('.readerPaper')?getComputedStyle(document.querySelector('.readerPaper')).fontFamily:null,
     selectedTheme:document.documentElement.dataset.siteTheme,
     selectedCorners:document.documentElement.dataset.siteCorners,
     errorScreen:document.body.innerText.includes('no pudo mostrar esta vista')
    };
   });
   total++;
   if(result.rootOverflow>2)failures.push({viewport,name,error:'horizontal overflow',amount:result.rootOverflow});
   if(result.mainText<25||result.errorScreen)failures.push({viewport,name,error:'missing content or render error',result});
   if(result.undersized.length)failures.push({viewport,name,error:'small main actions',controls:result.undersized});
   if(result.selectedTheme!==viewport.theme||result.selectedCorners!==viewport.corners)failures.push({viewport,name,error:'visual preferences lost'});
   if(viewport.width===390&&name==='public-home'&&result.heroHeight>750)failures.push({viewport,name,error:'home hero still crowds first screen',heroHeight:result.heroHeight});
   if(name==='public-reader'&&!result.readerPaperFont)failures.push({viewport,name,error:'reader typography missing'});
   if(runtime.length)failures.push({viewport,name,error:'javascript errors',messages:[...runtime]});
  }
 }catch(error){failures.push({viewport,error:String(error)})}
 finally{await context.close()}
}
await browser.close();
console.log('Phase 3 visual cohesion:',JSON.stringify({scenarios:cases.length,viewports:viewports.length,checked:total,failures:failures.length}));
if(failures.length){console.error(JSON.stringify(failures.slice(0,40),null,2));process.exit(1)}
