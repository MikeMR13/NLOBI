import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';

const views=['home','explore','auth'];
fs.mkdirSync('axe-results',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let failed=false;
const report=[];
for(const view of views){
  const context=await browser.newContext({serviceWorkers:'block'});
  // Un entorno estable: evita navegación automática de sesión durante Axe.
  await context.route('**/runtime-config.js',route=>route.fulfill({
    status:200,contentType:'application/javascript',
    body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"
  }));
  await context.route('https://qa.supabase.local/**',route=>route.fulfill({
    status:200,contentType:'application/json',body:'[]'
  }));
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded',timeout:15000});
    await page.waitForFunction(()=>!!window.__NLOBI_QA__,undefined,{timeout:15000});
    await page.evaluate(next=>{
      window.__NLOBI_QA__.setState({catalogLoaded:true,catalogLoading:false});
      window.__NLOBI_QA__.setView(next);
    },view);
    await page.waitForFunction(next=>{
      const state=window.__NLOBI_QA__?.getState();
      return state?.view===next&&!!document.querySelector('main')&&
        !document.body.innerText.includes('no pudo mostrar esta vista');
    },view,{timeout:8000});
    const results=await new AxeBuilder({page}).analyze();
    const url='http://127.0.0.1:4173/#'+view;
    report.push({url,violations:results.violations,errors});
    console.log(url+': '+results.violations.length+' violation(s)');
    for(const v of results.violations){
      failed=true;
      console.log('- ['+(v.impact||'unknown')+'] '+v.id+': '+v.help);
      for(const node of v.nodes.slice(0,10))console.log('  '+node.target.join(' '));
    }
    if(errors.length){failed=true;console.error('Page errors in '+view,errors)}
  }catch(error){
    failed=true;
    report.push({view,errors:[String(error),...errors]});
    console.error('Axe '+view+' failed: '+String(error));
  }finally{await context.close()}
}
// Regresión permanente: el banner personalizado de Studio debe ser legible.
const fixtures=fs.readFileSync(new URL('./full-quality-check.mjs',import.meta.url),'utf8');
const fixtureStart=fixtures.indexOf('const now='),fixtureEnd=fixtures.indexOf('const viewports=');
if(fixtureStart<0||fixtureEnd<=fixtureStart)throw Error('Muestras QA de Studio no disponibles');
const {scenarios}=new Function(fixtures.slice(fixtureStart,fixtureEnd)+'\nreturn {scenarios};')();
const teamCase=scenarios.find(row=>row[0]==='creator-team-custom');
if(!teamCase)throw Error('Falta escenario de personalización del equipo');
for(const width of [390,1280]){
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
 await context.route('**/runtime-config.js',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"
 }));
 await context.route('https://qa.supabase.local/**',route=>route.fulfill({
  status:200,contentType:'application/json',body:'[]'
 }));
 const page=await context.newPage();
 try{
  await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__NLOBI_QA__,undefined,{timeout:15000});
  await page.evaluate(({state,view})=>{
   window.__NLOBI_QA__.setState(state);
   window.__NLOBI_QA__.setView(view);
  },{state:teamCase[2],view:teamCase[1]});
  await page.waitForFunction(()=>!!document.querySelector('#teamCustomPreview .teamIdentityKicker'),undefined,{timeout:8000});
  const result=await new AxeBuilder({page}).analyze();
  const serious=result.violations.filter(v=>['serious','critical'].includes(v.impact||''));
  report.push({url:'QA:Studio-custom-'+width,violations:serious});
  console.log('Studio team banner '+width+'px: '+serious.length+' serious/critical violation(s)');
  for(const v of serious){
   failed=true;
   console.error(v.id+': '+v.nodes.slice(0,4).map(n=>n.target.join(' ')).join(' | '));
  }
 }catch(error){failed=true;report.push({view:'Studio-custom-'+width,error:String(error)});console.error(String(error))}
 finally{await context.close()}
}
await browser.close();
fs.writeFileSync('axe-results/axe-report.json',JSON.stringify(report,null,2));
if(failed)process.exit(1);
