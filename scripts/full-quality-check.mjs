import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';

const base='http://127.0.0.1:4173/';
const api='https://qa.supabase.local';
const now='2026-10-07T18:00:00.000Z';
const longTitle='La novela ligera con un título extremadamente largo para comprobar que el diseño no se rompe en web, móvil, lector ni vista de creador';

const section1={id:'section-1',volume_id:'volume-1',title:'Capítulo 1 — Un encabezado largo que debe ajustarse correctamente incluso en una pantalla de 320 píxeles',section_type:'chapter',section_number:1,status:'published',sort_order:1,updated_at:now,content:[
 {type:'heading',text:'Una escena de prueba'},
 {type:'paragraph',text:'Este párrafo sirve para probar lectura, interlineado, zoom y reflow. '.repeat(45)},
 {type:'quote',text:'Una cita suficientemente larga para comprobar el ancho del lector.'},
 {type:'translator_note',text:'Nota del traductor para validar contraste y espaciado.'},
 {type:'ruby',base:'結花',reading:'ゆうか'}
]};
const section2={id:'section-2',volume_id:'volume-1',title:'Capítulo 2',section_type:'chapter',section_number:2,status:'published',sort_order:2,updated_at:now,content:[{type:'paragraph',text:'Segundo capítulo.'}]};
const translation={id:'project-1',title:longTitle,status:'active',language_code:'es',popularity_score:99,updated_at:now,group_id:'group-1',editorial_mode:true,
 novels:{id:'novel-1',title:longTitle,synopsis:'Sinopsis extensa para validar comportamiento visual. '.repeat(20),cover_url:null,author_name:'Autor de prueba',genres:['Romance','Comedia','Fantasía'],tags:['school-life','slow-burn','etiqueta-extremadamente-larga']},
 translator_groups:{id:'group-1',name:'Equipo traductor con un nombre largo de control de calidad'},
 volumes:[
  {id:'volume-1',volume_number:1,title:'Volumen uno con un subtítulo muy largo para probar la vista editorial',status:'published',cover_url:null,sections:[section1,section2]},
  {id:'volume-2',volume_number:2,title:'Volumen borrador',status:'draft',cover_url:null,sections:[]}
 ],
 links:{purchase:[{id:'buy-1',volume_number:1,store_name:'Tienda oficial de ejemplo',region:'JP',language_code:'ja',format:'digital',url:'https://example.test/buy'}],support:[{id:'support-1',label:'Apoyar al equipo',url:'https://example.test/support'}],downloads:[{id:'download-1',volume_id:'volume-1',format:'epub',provider:'Drive',url:'https://example.test/download'}]},
 purchase_links:[{id:'buy-1',volume_number:1,store_name:'Tienda oficial',region:'JP',language_code:'ja',format:'digital',url:'https://example.test/buy',is_verified:true}],
 download_links:[{id:'download-1',volume_id:'volume-1',format:'epub',provider:'Drive',url:'https://example.test/download'}]
};
const user={id:'user-1',email:'qa@example.test'};
const profile={id:'user-1',username:'qa_creator',display_name:'Creador QA con nombre largo',avatar_url:null,bio:'Biografía larga de control de calidad. '.repeat(12),account_type:'reader_translator',public_library:true,public_activity:true};
const group={id:'group-1',slug:'equipo-qa',name:'Equipo traductor con un nombre largo de control de calidad',description:'Descripción extensa del equipo. '.repeat(16),avatar_url:null,banner_url:null,primary_color:'#111111',secondary_color:'#ffd400',support_links:[{id:'support-1',label:'Ko-fi',url:'https://example.test'}]};
const groups=[{role:'owner',translator_groups:{id:'group-1',name:group.name,slug:group.slug}}];
const studioTranslations=[{id:'project-1',title:longTitle,status:'active',language_code:'es',group_id:'group-1',editorial_mode:true,novels:{id:'novel-1',title:longTitle},translator_groups:{id:'group-1',name:group.name}}];
const library=[{translation_id:'project-1',status:'reading',is_favorite:true,updated_at:now,translations:{id:'project-1',title:longTitle,novels:{id:'novel-1',title:longTitle,cover_url:null},translator_groups:{id:'group-1',name:group.name}}}];
const progress=[{translation_id:'project-1',volume_id:'volume-1',section_id:'section-1',progress_percent:57,anchor:'p-3',updated_at:now,volumes:{id:'volume-1',volume_number:1,title:'Volumen 1'},sections:{id:'section-1',title:section1.title,section_number:1}}];
const history=[{section_id:'section-1',translation_id:'project-1',viewed_at:now,sections:{id:'section-1',title:section1.title,section_number:1,volumes:{id:'volume-1',volume_number:1,translations:{id:'project-1',title:longTitle,novels:{id:'novel-1',title:longTitle}}}}}];
const notes=[{id:'note-1',notification_type:'team_updates',title:'Aviso de prueba con un título deliberadamente largo para reflow',body:'Contenido del aviso. '.repeat(14),translation_id:'project-1',section_id:null,actor_user_id:'user-2',read_at:null,created_at:now}];
const comments=[{id:'comment-1',section_id:'section-1',user_id:'user-2',parent_id:null,body:'Comentario de prueba '.repeat(12),is_spoiler:false,created_at:now,profiles:{id:'user-2',username:'lector',display_name:'Lector QA'},comment_reactions:[{user_id:'user-1',reaction:'like'}]}];
const readerSection={...section1,translation_id:'project-1',volume_number:1,novel_title:longTitle,navigation:[{...section1,volume_number:1},{...section2,volume_number:1}]};
const publicProfile={...profile,id:'user-2',username:'lector_publico',display_name:'Perfil público con nombre largo',library,activity:[{translation_id:'project-1',progress_percent:83,updated_at:now,translations:{id:'project-1',title:longTitle,novels:{id:'novel-1',title:longTitle}}}]};
const publicGroup={...group,translations:[translation]};
const teamMembers=[
 {group_id:'group-1',user_id:'user-1',role:'owner',profiles:{id:'user-1',username:'qa_creator',display_name:'Creador QA',avatar_url:null}},
 {group_id:'group-1',user_id:'user-2',role:'editor',profiles:{id:'user-2',username:'editor_qa',display_name:'Editor con un nombre largo',avatar_url:null}}
];
const adminData={
 admin:true,
 apps:[{id:'app-1',applicant_id:'user-1',requested_name:'Equipo solicitado de prueba',requested_slug:'equipo-prueba',description:'Solicitud QA '.repeat(10),website_url:'https://example.test',status:'pending',created_at:now,profiles:{display_name:'Creador QA'}}],
 adminUsers:[profile],adminTeams:[group],
 adminReports:[{id:'report-1',comment_id:'comment-1',reason:'Motivo de prueba '.repeat(8),status:'pending',created_at:now,comments:{id:'comment-1',body:'Comentario reportado',user_id:'user-2',section_id:'section-1'}}],
 adminContent:[{id:'project-1',title:longTitle,status:'active',updated_at:now,novels:{id:'novel-1',title:longTitle},translator_groups:{id:'group-1',name:group.name}}],
 adminVolumes:[{id:'volume-1',volume_number:1,title:'Volumen 1',status:'published',updated_at:now,translations:{id:'project-1',title:longTitle,novels:{id:'novel-1',title:longTitle}}}],
 adminSections:[{id:'section-1',title:section1.title,status:'published',updated_at:now,volumes:{id:'volume-1',translations:{id:'project-1',title:longTitle,novels:{id:'novel-1',title:longTitle}}}}],
 adminPurchaseLinks:[{id:'buy-1',volume_number:1,store_name:'Tienda de ejemplo',url:'https://example.test',is_verified:false,created_at:now,novels:{id:'novel-1',title:longTitle},translator_groups:{id:'group-1',name:group.name}}],
 adminAudit:[{id:'audit-1',action_type:'qa',target_type:'translation',target_id:'project-1',details:{note:'prueba'},created_at:now}],
 adminBetaFeedback:[{id:'beta-1',user_id:'user-1',category:'ux',title:'Reporte QA',description:'Descripción '.repeat(10),page:'#beta',status:'open',admin_note:null,created_at:now,profiles:{display_name:'Creador QA'}}]
};
const authBase={user,profile,groups,library,readingProgress:progress,readingHistory:history,notes,studioTranslations,betaFeedback:adminData.adminBetaFeedback,follows:[{target_type:'translation',target_id:'project-1',created_at:now}],...adminData};

function importState(step){
 const sections=[{title:'Capítulo 1 muy largo para validar el importador en móvil',section_type:'chapter',section_number:1,body:'Texto importado '.repeat(80),blocks:[{type:'heading',text:'Capítulo 1'},{type:'paragraph',text:'Texto importado '.repeat(40)}]},{title:'閑話',section_type:'interlude',section_number:2,body:'Interludio',blocks:[{type:'paragraph',text:'Interludio'}]}];
 return {step,file:null,type:'docx',name:'volumen-de-prueba-con-nombre-largo.docx',text:'Texto importado '.repeat(120),parsedBlocks:sections.flatMap(x=>x.blocks),sections,warnings:['Advertencia QA de ejemplo con texto largo para comprobar el ajuste.'],translationId:'project-1',volumeNumber:'1',volumeTitle:'Volumen de prueba',existingAction:'append',busy:false,message:''};
}

const scenarios=[
 ['public-home','home',{catalog:[translation]}],
 ['public-explore','explore',{catalog:[translation]}],
 ['public-detail','detail:project-1',{catalog:[translation],currentDetail:translation}],
 ['public-group','group:group-1',{catalog:[translation],publicGroup}],
 ['public-profile','profile:user-2',{catalog:[translation],publicProfile}],
 ['public-reader','reader:section-1',{catalog:[translation],readerSection,readerComments:comments}],
 ['guest-library','library',{}],['guest-auth','auth',{}],
 ['user-library','library',authBase],['user-profile','auth',authBase],['user-notifications','notifications',authBase],['user-beta','beta',authBase],
 ['creator-studio','studio',authBase],['creator-new','studio:new',authBase],
 ['creator-project','studio:project:project-1',{...authBase,studioProject:translation,teamMembers}],
 ['creator-team','studio:team:group-1',{...authBase,studioTeam:group,teamMembers}],
 ['creator-media','studio:media:group-1',{...authBase,mediaGroupId:'group-1',mediaLoading:false,mediaFiles:[{name:'cover.jpg',path:'teams/group-1/cover.jpg',size:2048,mimetype:'image/jpeg',updated_at:now}],mediaUsage:{'teams/group-1/cover.jpg':1}}],
 ['import-file','studio:import',{...authBase,importState:importState('file')}],
 ['import-analysis','studio:import',{...authBase,importState:importState('analysis')}],
 ['import-structure','studio:import',{...authBase,importState:importState('structure')}],
 ['import-review','studio:import',{...authBase,importState:importState('review')}],
 ['import-edit','studio:import',{...authBase,importState:importState('edit')}],
 ['import-publish','studio:import',{...authBase,importState:importState('publish')}],
 ['admin','admin',authBase],
 ['error-state','home',{catalog:[translation],err:'Error de conexión simulado con un mensaje largo que debe visualizarse correctamente y conservar el botón de reintento.'}],
 ['empty-library','library',{...authBase,library:[],readingProgress:[],readingHistory:[]}],
 ['empty-studio','studio',{...authBase,studioTranslations:[]}],
 ['readonly-studio','studio',{...authBase,admin:false,groups:[{role:'collaborator',translator_groups:{id:'group-1',name:group.name,slug:group.slug}}]}],
 ['readonly-project','studio:project:project-1',{...authBase,admin:false,groups:[{role:'proofreader',translator_groups:{id:'group-1',name:group.name,slug:group.slug}}],studioProject:translation,teamMembers}],
 ['readonly-team','studio:team:group-1',{...authBase,admin:false,groups:[{role:'collaborator',translator_groups:{id:'group-1',name:group.name,slug:group.slug}}],studioTeam:group,teamMembers}]
];

const viewports=[['mobile-320',320,800],['mobile-390',390,844],['tablet-768',768,1024],['desktop-1280',1280,900],['desktop-1600',1600,1000]];
async function prepare(context){
 await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'"+api+"',supabasePublishableKey:'qa',qaMode:true};"}));
 await context.route(api+'/**',r=>{
  const url=new URL(r.request().url());
  if(url.pathname.startsWith('/storage/v1/object/public/')){
   const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZpTQAAAAASUVORK5CYII=','base64');
   return r.fulfill({status:200,contentType:'image/png',body:png});
  }
  return r.fulfill({status:200,contentType:'application/json',body:'[]'});
 });
}
async function inspect(page){
 return page.evaluate(()=>{
  const root=document.documentElement,text=document.body.innerText;
  const controls=[...document.querySelectorAll('button,.btn,.navLink,select,input,textarea')].filter(el=>{const r=el.getBoundingClientRect(),cs=getComputedStyle(el);return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0});
  return {
   overflow:root.scrollWidth-root.clientWidth,
   clipped:controls.map(el=>{const r=el.getBoundingClientRect();return{label:(el.textContent||el.getAttribute('aria-label')||el.getAttribute('placeholder')||'').trim().slice(0,90),left:r.left,right:r.right,width:r.width,height:r.height}}).filter(x=>x.left<-2||x.right>root.clientWidth+2),
   tiny:controls.filter(el=>el.matches('button,.btn,.navLink,select')).map(el=>{const r=el.getBoundingClientRect();return{label:(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,90),width:r.width,height:r.height}}).filter(x=>x.width<40||x.height<40),
   badText:['undefined','[object Object]','NaN','Infinity'].filter(v=>text.includes(v)),
   main:!!document.querySelector('main'),content:(document.querySelector('main')?.innerText||'').trim().length
  };
 });
}
fs.mkdirSync('quality-results',{recursive:true});
const browser=await chromium.launch({headless:true});
const report=[],failures=[];
for(const [vpName,width,height] of viewports){
 for(const [name,view,state] of scenarios){
  const full=vpName==='mobile-390'||vpName==='desktop-1280';
  const edge=['public-home','public-explore','public-detail','public-reader','user-library','creator-studio','creator-project','creator-team','import-edit','admin','error-state'];
  if(!full&&!edge.includes(name))continue;
  const context=await browser.newContext({viewport:{width,height},serviceWorkers:'block',colorScheme:'light'});await prepare(context);
  const page=await context.newPage(),runtime=[];page.on('pageerror',e=>runtime.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!/favicon|Failed to load resource/i.test(m.text()))runtime.push(m.text())});
  await page.goto(base+'#home',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__NLOBI_QA__);
  await page.evaluate(({state,view})=>{window.__NLOBI_QA__.setState(state);window.__NLOBI_QA__.setView(view)},{state,view});await page.waitForTimeout(25);
  const check=await inspect(page),axe=await new AxeBuilder({page}).analyze(),serious=axe.violations.filter(v=>['serious','critical'].includes(v.impact||'')).map(v=>v.id);
  const row={viewport:vpName,scenario:name,...check,runtime,axeSerious:serious};report.push(row);
  if(check.overflow>2)failures.push({...row,error:'horizontal-overflow'});if(check.clipped.length)failures.push({...row,error:'clipped-controls'});if(check.tiny.length)failures.push({...row,error:'small-targets'});if(check.badText.length)failures.push({...row,error:'bad-visible-text'});if(!check.main||check.content<2)failures.push({...row,error:'empty-main'});if(runtime.length)failures.push({...row,error:'runtime-error'});if(serious.length)failures.push({...row,error:'axe-serious'});
  if(name==='creator-project'){const edit=page.locator('[data-edit-section="section-1"]');if(await edit.count()){await edit.click();await page.waitForTimeout(15);if(!(await page.locator('#editSectionTitle').count()))failures.push({...row,error:'editor-open-failed'})}}
  if(name==='user-library'){const b=page.locator('[data-library-filter="favorites"]');if(await b.count())await b.click()}
  if(name==='admin')for(const tab of ['applications','users','teams','reports','content','links','beta','audit']){const b=page.locator('[data-admin-tab="'+tab+'"]');if(await b.count())await b.first().click()}
  if(name==='readonly-studio' && ((await page.locator('[data-v="studio:new"]').count())||(await page.locator('[data-v="studio:import"]').count())))failures.push({...row,error:'readonly-studio-exposes-editor-actions'});
  if(name==='readonly-project' && ((await page.locator('#createVolume').count())||(await page.locator('#saveDiscoveryMeta').count())||(await page.locator('[data-new-section]').count())))failures.push({...row,error:'readonly-project-exposes-editor-actions'});
  if(name==='readonly-team' && ((await page.locator('#saveTeamProfile').count())||(await page.locator('#addSupportLink').count())||(await page.locator('[data-media-open]').count())))failures.push({...row,error:'readonly-team-exposes-editor-actions'});
  if((vpName==='mobile-390'||vpName==='desktop-1280')&&['public-home','public-detail','public-reader','user-library','creator-project','creator-team','import-edit','admin'].includes(name))await page.screenshot({path:'quality-results/'+vpName+'-'+name+'.png',fullPage:true});
  await context.close();
 }
}
for(const item of [['home',{catalog:[translation]}],['reader:section-1',{readerSection,readerComments:comments}],['studio:project:project-1',{...authBase,studioProject:translation,teamMembers}],['admin',authBase]]){
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await prepare(context);const page=await context.newPage();
 await page.goto(base+'#home',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__NLOBI_QA__);
 await page.evaluate(({state,view})=>{window.__NLOBI_QA__.setState(state);window.__NLOBI_QA__.setView(view);document.documentElement.style.fontSize='200%'},{view:item[0],state:item[1]});
 const check=await inspect(page);if(check.overflow>2||check.clipped.length)failures.push({scenario:'text-200-'+item[0],check,error:'text-enlargement-reflow'});await context.close();
}
{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'"+api+"',supabasePublishableKey:'qa'};"}));await context.route(api+'/**',r=>r.fulfill({status:503,contentType:'application/json',body:'{"message":"simulated outage"}'}));
 const page=await context.newPage(),runtime=[];page.on('pageerror',e=>runtime.push(e.message));await page.goto(base+'#home',{waitUntil:'networkidle'});await page.waitForTimeout(50);
 if(!(await page.locator('[role="alert"]').count())||!(await page.locator('#retryBackend').count())||runtime.length)failures.push({scenario:'backend-outage',runtime,error:'unsafe-error-state'});await context.close();
}
await browser.close();
fs.writeFileSync('quality-results/full-quality-report.json',JSON.stringify({testedAt:new Date().toISOString(),renderedScenarios:report.length,failures,report},null,2));
console.log('Full quality pass: '+report.length+' rendered scenarios; '+failures.length+' failure(s).');
if(failures.length){console.error(JSON.stringify(failures.slice(0,25),null,2));process.exit(1)}
