import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {chromium,webkit} from 'playwright';

const base='http://127.0.0.1:4173/';
const api='https://qa.supabase.local';
const stamp='2026-10-13T10:00:00Z';
const section={id:'qa-section-1',volume_id:'qa-volume-1',title:'Capítulo de prueba',section_number:1,section_type:'chapter',status:'published',sort_order:1,content:[{type:'paragraph',text:'Historia para la auditoría de interacción.'}]};
const book={id:'qa-translation-1',title:'Obra editorial QA',group_id:'qa-group-1',status:'active',updated_at:stamp,language_code:'es',novels:{id:'qa-novel-1',title:'Obra editorial QA',author_name:'Autor QA',cover_url:null,status:'ongoing',novel_type:'light_novel',genres:['Fantasía'],tags:[],synopsis:'Resumen de una obra QA.'},translator_groups:{id:'qa-group-1',name:'Equipo QA'},volumes:[{id:'qa-volume-1',translation_id:'qa-translation-1',volume_number:1,title:'Volumen de prueba',status:'published',sections:[section]}]};
const user={id:'qa-user-1',email:'reader@example.test'};
const profile={id:'qa-user-1',username:'lector_qa',display_name:'Lector QA',account_type:'reader_translator',public_library:true,public_activity:true};
const group={id:'qa-group-1',name:'Equipo QA',slug:'equipo-qa',description:'Equipo editorial de pruebas'};
const groups=[{role:'owner',translator_groups:group}];
const library=[{translation_id:book.id,status:'reading',is_favorite:false,updated_at:stamp,translations:{id:book.id,title:book.title,novels:book.novels,translator_groups:group}}];
const creator={user,profile,groups,accountPermissionsReady:true,adminPermissionsReady:true,catalog:[book],catalogLoaded:true,catalogLoading:false,library,studioTranslations:[book],studioProject:book,studioTeam:group,teamMembers:[{group_id:group.id,user_id:user.id,role:'owner',profiles:profile}],notes:[],admin:false};
const guest={catalog:[book],catalogLoaded:true,catalogLoading:false,user:null,admin:false};
const reader={...creator,groups:[],studioTranslations:[],studioProject:null,studioTeam:null,admin:false};
const admin={...creator,admin:true,adminUsers:[profile],adminTeams:[group],adminReports:[],adminContent:[book],adminVolumes:[],adminSections:[],adminPurchaseLinks:[],adminBetaFeedback:[],adminAudit:[]};
const cases=[
 {id:'guest-home',view:'home',patch:guest},
 {id:'guest-explore',view:'explore',patch:guest},
 {id:'guest-detail',view:'detail:qa-translation-1',patch:{...guest,currentDetail:book}},
 {id:'guest-auth',view:'auth',patch:guest},
 {id:'reader-library',view:'library',patch:reader},
 {id:'reader-notifications',view:'notifications',patch:reader},
 {id:'reader-chapter',view:'reader:qa-section-1',patch:{...guest,readerSection:{...section,translation_id:book.id,novel_title:book.title,volume_number:1,navigation:[section]},readerComments:[]}},
 {id:'translator-studio',view:'studio',patch:creator},
 {id:'translator-studio-empty',view:'studio',patch:{...creator,studioProjectSearch:'sin-coincidencia-de-prueba'}},
 {id:'translator-project',view:'studio:project:qa-translation-1',patch:creator},
 {id:'translator-team',view:'studio:team:qa-group-1',patch:creator},
 {id:'reader-studio-limited',view:'studio',patch:{...creator,admin:false,groups:[{role:'collaborator',translator_groups:group}]}},
 {id:'admin',view:'admin',patch:admin}
];

const browsers=[['Chromium',chromium],['WebKit',webkit]],widths=[390,1280];
const failures=[],matrix=[];
mkdirSync('quality-results',{recursive:true});

async function setup(context){
 await context.addInitScript(()=>{
  const tracked=new WeakMap(),nativeAdd=EventTarget.prototype.addEventListener;
  EventTarget.prototype.addEventListener=function(type,listener,options){
   if(type==='click'||type==='submit'){
    const types=tracked.get(this)||new Set();
    types.add(type);
    tracked.set(this,types);
   }
   return nativeAdd.call(this,type,listener,options);
  };
  window.__NLOBI_EVENT_QA__={handles(element,type){
   for(let node=element;node&&node!==document;node=node.parentNode){
    if(tracked.get(node)?.has(type))return true;
    if(type==='click'&&typeof node.onclick==='function')return true;
    if(type==='submit'&&typeof node.onsubmit==='function')return true;
   }
   return false;
  }};
 });
 await context.route('**/runtime-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'"+api+"',supabasePublishableKey:'qa',qaMode:true};"}));
 await context.route(api+'/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
}

async function census(page){
 return page.evaluate(()=>{
  const shown=element=>{
   if(element.disabled||element.closest('[hidden],[inert]'))return false;
   if(!element.getClientRects().length)return false;
   const style=getComputedStyle(element),rect=element.getBoundingClientRect();
   return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0;
  };
  const qa=window.__NLOBI_EVENT_QA__;
  const buttons=[...document.querySelectorAll('button,input[type=button],input[type=submit],input[type=reset],[role=button]')].filter(shown);
  const links=[...document.querySelectorAll('a')].filter(shown);
  const disconnected=[];
  const unidentified=[];
  for(const element of buttons){
   const name=(element.getAttribute('aria-label')||element.getAttribute('title')||element.textContent||element.value||'').trim().replace(/\s+/g,' ').slice(0,75);
   const isSubmit=element.matches('button[type=submit],input[type=submit]') || element.tagName==='BUTTON'&&!element.hasAttribute('type')&&!!element.closest('form');
   const nativeForm=isSubmit&&element.closest('form')&&(qa.handles(element.closest('form'),'submit')||element.closest('form').getAttribute('onsubmit'));
   const nativeReset=element.matches('button[type=reset],input[type=reset]');
   const nativeDetail=element.matches('summary');
   const handler=qa.handles(element,'click')||!!element.getAttribute('onclick')||nativeForm||nativeReset||nativeDetail;
   if(!handler)disconnected.push({tag:element.tagName,id:element.id||'',name,html:element.outerHTML.slice(0,190)});
   if(!name)unidentified.push(element.outerHTML.slice(0,190));
  }
  const brokenLinks=links.filter(el=>!el.hasAttribute('href')||!el.getAttribute('href')?.trim()).map(el=>el.outerHTML.slice(0,190));
  return {buttons:buttons.length,links:links.length,disconnected,unidentified,brokenLinks,brokenRoute:document.body.textContent.includes('no pudo mostrar esta vista')};
 });
}

for(const [browserName,type] of browsers){
 const browser=await type.launch({headless:true});
 try{
  for(const width of widths){
   const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block',reducedMotion:'reduce'});
   await setup(context);
   const page=await context.newPage(),runtime=[];
   page.on('pageerror',error=>runtime.push(error.message));
   try{
    await page.goto(base+'#home',{waitUntil:'networkidle'});
    await page.waitForFunction(()=>!!window.__NLOBI_QA__,undefined,{timeout:15000});
    for(const scenario of cases){
     // Explicitly clear previous view state before each role snapshot.
     await page.evaluate(({view,patch})=>{
      const qa=window.__NLOBI_QA__;
      qa.setState({studioProjectSearch:'',studioProjectFilter:'all',studioNovelPublicationFilter:'all',studioNovelTypeFilter:'all',studioTeamFilter:'all',studioGenreFilter:'all',studioPublicationFilter:'all',studioWorkflowFilter:'all',studioSequelStatusFilter:'all',studioNovelStatusFilter:'all',...patch});
      qa.setView(view);
     },{view:scenario.view,patch:scenario.patch});
     const check=await census(page);
     matrix.push({browser:browserName,width,scenario:scenario.id,...check});
     if(check.disconnected.length||check.brokenLinks.length||check.brokenRoute)failures.push({browser:browserName,width,scenario:scenario.id,...check});
     if(scenario.id==='translator-studio'){
      assert.equal(await page.locator('.studioV3BookCard').count(),1);
      await page.locator('#studioProjectFilter').selectOption('active');
      assert.equal(await page.locator('#studioResetFilters').count(),1,'Reset visible with active filters');
      await page.locator('#studioResetFilters').click();
      assert.equal(await page.locator('#studioProjectFilter').inputValue(),'all');
      await page.locator('#studioProjectSearch').fill('no-se-encontrara');
      assert.equal(await page.locator('.studioV3BookCard').count(),0);
      await page.locator('#studioResetFiltersEmpty').click();
      assert.equal(await page.locator('#studioProjectSearch').inputValue(),'');
      assert.equal(await page.locator('.studioV3BookCard').count(),1);
     }
     if(scenario.id==='guest-home'){
      const toggle=page.locator(width<768?'#themeMobileQuick':'#theme');
      const before=await page.evaluate(()=>document.body.classList.contains('dark'));
      await toggle.click();
      const after=await page.evaluate(()=>document.body.classList.contains('dark'));
      assert.notEqual(before,after,'Theme button changes theme');
      if(width<768){
       const menu=page.locator('.mobileNav');
       await menu.locator(':scope > summary').click();
       assert.equal(await menu.evaluate(element=>element.open),true,'Mobile navigation opens');
       await menu.locator('.mobileNavClose').click();
       assert.equal(await menu.evaluate(element=>element.open),false,'Mobile navigation closes');
      }
     }
     if(scenario.id==='reader-chapter'){
      const button=page.locator('#readerBookmark');
      if(await button.count()){
       await button.click();
       const stored=await page.evaluate(()=>Object.keys(localStorage).some(key=>key.includes('reader_position')));
       assert.equal(stored,true,'Reader bookmark saves a position');
      }
     }
    }
    assert.equal(runtime.length,0,'Unexpected browser errors: '+runtime.join('; '));
   }catch(error){
    failures.push({browser:browserName,width,scenario:'interaction-execution',error:String(error),runtime:runtime.slice(0,5)});
   }finally{await context.close();}
  }
 }finally{await browser.close();}
}
writeFileSync('quality-results/global-action-matrix.json',JSON.stringify({matrix,failures},null,2));
const buttons=matrix.reduce((sum,row)=>sum+row.buttons,0),links=matrix.reduce((sum,row)=>sum+row.links,0);
console.log('Global action matrix: '+matrix.length+' snapshots, '+buttons+' rendered button instances, '+links+' rendered links; '+failures.length+' issue(s).');
if(failures.length){console.error(JSON.stringify(failures.slice(0,25),null,2));process.exit(1)}
