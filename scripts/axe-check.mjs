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
await browser.close();
fs.writeFileSync('axe-results/axe-report.json',JSON.stringify(report,null,2));
if(failed)process.exit(1);
