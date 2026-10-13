import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

const base='http://127.0.0.1:4173/';
const api='https://qa.supabase.local';
const now='2026-10-13T10:00:00Z';
const book={id:'ux-translation',title:'Novela QA',group_id:'ux-team',status:'active',
 updated_at:now,language_code:'es',novels:{id:'ux-novel',title:'Novela QA',
 genres:['Fantasía'],status:'ongoing',novel_type:'light_novel',cover_url:null},
 translator_groups:{id:'ux-team',name:'Equipo QA'},volumes:[]};
const profile={id:'ux-reader',username:'lector',display_name:'Lector QA'};
const user={id:'ux-reader',email:'qa@example.test'};
const group={id:'ux-team',name:'Equipo QA',slug:'equipo-qa'};
const creator={user,profile,groups:[{role:'owner',translator_groups:group}],
 accountPermissionsReady:true,adminPermissionsReady:true,studioTranslations:[book],
 catalog:[book],catalogLoaded:true,catalogLoading:false,admin:false};
const cases=[320,390,768,1280];
const errors=[];

for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of cases){
   const context=await browser.newContext({viewport:{width,height:860},hasTouch:true,
    reducedMotion:'reduce',serviceWorkers:'block'});
   await context.route('**/runtime-config.js',route=>route.fulfill({status:200,
    contentType:'application/javascript',
    body:"window.__NLOBI_CONFIG__={supabaseUrl:'"+api+"',supabasePublishableKey:'qa',qaMode:true};"}));
   await context.route(api+'/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
   const page=await context.newPage();
   const crashes=[];
   page.on('pageerror',e=>crashes.push(String(e)));
   try{
    await page.goto(base+'#home',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>window.__NLOBI_QA__&&
     document.getElementById('siteStyles')?.media==='all',{timeout:15000});
    await page.evaluate(patch=>window.__NLOBI_QA__.setState(patch),creator);

    const home=await page.evaluate(()=>{
     const heading=document.querySelector('.homeEditorial .homeShowcaseCopy h1');
     const s=heading&&getComputedStyle(heading);
     const menu=document.querySelector('.mobileNav > summary');
     const m=menu?.getBoundingClientRect();
     return {font:s?.fontFamily,menuHeight:m?.height,
      toastPointer:getComputedStyle(document.querySelector('#toastHost')).pointerEvents};
    });
    assert.ok(home.font,'Hero heading rendered');
    assert.ok((width<=767?home.font.startsWith('Georgia'):home.font.includes('Literata')),
     engineName+' '+width+' unexpected hero font: '+home.font);
    assert.equal(home.toastPointer,'none');
    if(width<=767)assert.ok(home.menuHeight>=43.5,'Touch menu smaller than 44px at '+width);

    await page.evaluate(patch=>{window.__NLOBI_QA__.setState(patch);window.__NLOBI_QA__.setView('studio')},creator);
    if(width<=767){
     const small=await page.evaluate(()=>{
      const targets=[...document.querySelectorAll('.studioV3 button')].filter(el=>{
       const rect=el.getBoundingClientRect(),style=getComputedStyle(el);
       return rect.width>0&&rect.height>0&&style.visibility!=='hidden'&&style.display!=='none'&&!el.disabled;
      });
      return targets.filter(el=>el.getBoundingClientRect().height<43.5)
       .map(el=>({text:el.textContent.trim().slice(0,40),height:el.getBoundingClientRect().height}));
     });
     assert.deepEqual(small,[],engineName+' '+width+' Studio touch targets');
    }

    const ui=await page.evaluate(()=>{
     const probe=document.createElement('div');
     probe.innerHTML='<div class="readerExperience"><div class="readerTop"><button class="btn">Volver</button></div><div class="readerReadingActions"><button class="btn">Marcar leído</button></div></div><div class="adminWorkspace"><button class="btn">Administrar</button></div><button class="btn primary" aria-busy="true" type="button">Guardando…</button>';
     document.body.appendChild(probe);
     const buttons=[...probe.querySelectorAll('button')];
     const heights=buttons.map(b=>b.getBoundingClientRect().height);
     const spinner=getComputedStyle(buttons[buttons.length-1],'::after').content;
     const spinnerAnimation=getComputedStyle(buttons[buttons.length-1],'::after').animationName;
     probe.remove();
     return {heights,spinner,spinnerAnimation,overflow:document.documentElement.scrollWidth>innerWidth+2};
    });
    if(width<=767)assert.ok(ui.heights.every(x=>x>=43.5),
     engineName+' '+width+' admin/reader action targets: '+ui.heights);
    assert.equal(ui.spinner,'" "','Busy indicator spinner is missing');
    assert.equal(ui.spinnerAnimation,'none','Reduced-motion users must not see spinning actions');
    assert.equal(ui.overflow,false,engineName+' '+width+' unexpected horizontal overflow');
    assert.deepEqual(crashes,[],engineName+' '+width+' browser errors');
   }catch(e){errors.push({engine:engineName,width,message:String(e),runtime:crashes.slice(0,3)})}
   finally{await context.close()}
  }
 }finally{await browser.close()}
}
if(errors.length){console.error(JSON.stringify(errors,null,2));process.exit(1)}
console.log('Mobile action UX: 8 browser/viewport scenarios; 44px targets, reduced motion, busy indicator, stable home typography, no overflow.');
