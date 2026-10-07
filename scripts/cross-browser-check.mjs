import { firefox, webkit } from 'playwright';

const base='http://127.0.0.1:4173/';
const api='https://qa.supabase.local';
const project={
 id:'project-x',title:'Proyecto QA',status:'active',language_code:'es',group_id:'group-x',editorial_mode:true,
 novels:{id:'novel-x',title:'Novela QA',genres:[],tags:[]},translator_groups:{id:'group-x',name:'Equipo QA'},
 volumes:[{id:'volume-x',volume_number:1,title:'Volumen QA',status:'draft',sections:[{id:'section-x',title:'Capítulo QA',section_type:'chapter',section_number:1,status:'draft',sort_order:1,content:[{type:'paragraph',text:'Texto QA'}]}]}]
};
const user={id:'user-x',email:'qa@example.test'};
const state={user,profile:{id:'user-x',display_name:'QA',account_type:'translator'},groups:[{role:'editor',translator_groups:{id:'group-x',name:'Equipo QA',slug:'equipo-qa'}}],studioTranslations:[project]};
const reader={id:'reader-x',translation_id:'project-x',volume_id:'volume-x',volume_number:1,novel_title:'Novela QA',title:'Capítulo QA',section_type:'chapter',section_number:1,content:[{type:'paragraph',text:'Lectura cross-browser '.repeat(80)}],navigation:[]};

async function prepare(context){
 await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'"+api+"',supabasePublishableKey:'qa',qaMode:true};"}));
 await context.route(api+'/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
}
const scenarios=[
 ['home',{catalog:[]}],
 ['auth',{}],
 ['reader:reader-x',{readerSection:reader}],
 ['studio:project:project-x',{...state,studioProject:project}],
 ['studio:import',{...state,importState:{step:'edit',file:null,type:'docx',name:'qa.docx',text:'QA',parsedBlocks:[],sections:[{title:'Capítulo QA',section_type:'chapter',section_number:1,body:'QA',blocks:[{type:'paragraph',text:'QA'}]}],warnings:[],translationId:'project-x',volumeNumber:'1',volumeTitle:'QA',existingAction:'append',busy:false,message:''}}]
];
const failures=[];
for(const [browserName,browserType] of [['firefox',firefox],['webkit',webkit]]){
 const browser=await browserType.launch({headless:true});
 for(const viewport of [{width:390,height:844},{width:1280,height:900}]){
  for(const [view,patch] of scenarios){
   const context=await browser.newContext({viewport,serviceWorkers:'block'});await prepare(context);
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'#home',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__NLOBI_QA__);
   await page.evaluate(({patch,view})=>{window.__NLOBI_QA__.setState(patch);window.__NLOBI_QA__.setView(view)},{patch,view});
   await page.waitForTimeout(40);
   const check=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,main:(document.querySelector('main')?.innerText||'').trim().length}));
   if(errors.length||check.overflow>2||check.main<2)failures.push({browser:browserName,viewport:viewport.width,view,errors,check});
   await context.close();
  }
 }
 await browser.close();
}
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1)}
console.log('Cross-browser QA OK: Firefox + WebKit');
