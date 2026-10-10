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
  {id:'volume-2',volume_number:2,title:'Volumen borrador',status:'draft',cover_url:'https://example.test/cover-volume-2.jpg',sections:[{id:'section-3',volume_id:'volume-2',title:'Capítulo de prueba',section_type:'chapter',section_number:1,status:'draft',sort_order:1,content:[{type:'paragraph',text:'Contenido suficiente para realizar la publicación editorial de prueba.'}]}]}
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

const collectionTranslation={...translation,novels:{...translation.novels,cover_url:'https://example.test/qa-collection-cover.jpg'}};
const collectionFixture={id:'collection-qa',title:'Colección QA',description:'Descripción inicial QA',is_public:false,accent_color:'#ad794e',cover_translation_id:null,created_at:now,updated_at:now,reader_collection_items:[{translation_id:'project-1',created_at:now,sort_order:1}]};

const scenarios=[
 ['public-home','home',{catalog:[translation]}],
 ['public-explore','explore',{catalog:[translation]}],
 ['public-detail','detail:project-1',{catalog:[translation],currentDetail:translation}],
 ['public-group','group:group-1',{catalog:[translation],publicGroup}],
 ['public-profile','profile:user-2',{catalog:[translation],publicProfile}],
 ['public-reader-discovery','readers',{user:null,readerDirectory:[{reader_id:'user-2',username:'lector_publico',display_name:'Lector de novelas ligeras y romances con historias largas',avatar_url:null,bio:'Me encantan las comedias románticas y las historias de fantasía.',favorite_genres:['Romance','Fantasía'],followers:17,public_collections:2,public_reviews:4,public_activity:true}],readerViewMode:'discover'}],
 ['user-reader-discovery','readers',{...authBase,catalog:[translation],readerDirectory:[{reader_id:'user-2',username:'lector_publico',display_name:'Lector de novelas ligeras y romances con historias largas',avatar_url:null,bio:'Compartiendo lecturas y recomendaciones.',favorite_genres:['Romance','Comedia'],followers:17,public_collections:2,public_reviews:3,public_activity:true}],readerFollows:[],readerViewMode:'discover',readerActivity:[]}],
 ['user-following-feed','readers',{...authBase,catalog:[translation],readerDirectory:[],readerFollows:[{followed_id:'user-2',created_at:now}],followedReaderProfiles:[{id:'user-2',username:'lector_publico',display_name:'Lector con un perfil público',avatar_url:null,bio:'Amante de la fantasía',public_activity:true}],readerViewMode:'following',readerActivity:[{event_type:'reading',reader_id:'user-2',reader_name:'Lector con un perfil público',translation_id:'project-1',translation_title:longTitle,progress_percent:57,event_at:now},{event_type:'review',reader_id:'user-2',reader_name:'Lector con un perfil público',translation_id:'project-1',translation_title:longTitle,progress_percent:null,event_at:now}]}],
 ['user-public-reader-profile','profile:user-2',{...authBase,catalog:[translation],publicProfile:{...publicProfile,readerSocial:{followers:17,following:4}}}],
 ['public-reader','reader:section-1',{catalog:[translation],readerSection,readerComments:comments}],
 ['guest-library','library',{}],['guest-auth','auth',{}],
 ['user-library','library',authBase],
 ['user-library-collections','library',{...authBase,libraryTab:'collections',readerCollections:[],savedCollections:[],discoverCollections:[],collectionFormOpen:false}],
 ['user-library-collections-form','library',{...authBase,libraryTab:'collections',readerCollections:[],savedCollections:[],discoverCollections:[],collectionFormOpen:true,collectionEditingId:null}],
 ['user-library-collections-edit','library',{...authBase,catalog:[collectionTranslation],libraryTab:'collections',readerCollections:[collectionFixture],savedCollections:[],discoverCollections:[],collectionFormOpen:true,collectionEditingId:'collection-qa'}],
 ['user-profile','auth',authBase],['user-notifications','notifications',authBase],['user-beta','beta',authBase],
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
  const inHorizontalScroller=el=>{for(let a=el.parentElement;a&&a!==document.body;a=a.parentElement){const cs=getComputedStyle(a);if(/auto|scroll/.test(cs.overflowX)&&a.scrollWidth>a.clientWidth+2)return true}return false};
  return {
   overflow:root.scrollWidth-root.clientWidth,
   clipped:controls.filter(el=>!inHorizontalScroller(el)).map(el=>{const r=el.getBoundingClientRect();return{label:(el.textContent||el.getAttribute('aria-label')||el.getAttribute('placeholder')||'').trim().slice(0,90),left:r.left,right:r.right,width:r.width,height:r.height}}).filter(x=>x.left<-2||x.right>root.clientWidth+2),
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
  const check=await inspect(page),axe=await new AxeBuilder({page}).analyze(),seriousViolations=axe.violations.filter(v=>['serious','critical'].includes(v.impact||'')),serious=seriousViolations.map(v=>v.id),axeDetails=seriousViolations.flatMap(v=>v.nodes.slice(0,7).map(n=>({id:v.id,selector:n.target,reason:n.failureSummary?.slice(0,220),html:n.html?.slice(0,130)})));
  const row={viewport:vpName,scenario:name,...check,runtime,axeSerious:serious,axeDetails};report.push(row);
  if(check.overflow>2)failures.push({...row,error:'horizontal-overflow'});if(check.clipped.length)failures.push({...row,error:'clipped-controls'});if(check.tiny.length)failures.push({...row,error:'small-targets'});if(check.badText.length)failures.push({...row,error:'bad-visible-text'});if(!check.main||check.content<2)failures.push({...row,error:'empty-main'});if(runtime.length)failures.push({...row,error:'runtime-error'});if(serious.length)failures.push({...row,error:'axe-serious'});
  if(name==='creator-project'){const edit=page.locator('[data-edit-section="section-1"]');if(await edit.count()){await edit.click();await page.waitForTimeout(15);if(!(await page.locator('#editSectionTitle').count()))failures.push({...row,error:'editor-open-failed'})}}
  if(name==='user-library'){const b=page.locator('[data-library-filter="favorites"]');if(await b.count())await b.click()}
  if(name==='user-library-collections-form'){
   const form=page.locator('#collectionForm'),collections=page.locator('.libraryCollections'),bookTab=page.locator('[data-library-tab="books"]'),editor=page.locator('.collectionEditor'),preview=page.locator('.collectionPreviewPanel'),sections=page.locator('.collectionFormSection');
   if(!(await form.count())||!(await collections.count())||!(await editor.count())||!(await preview.count())||(await sections.count())!==3)failures.push({...row,error:'collections-phase1-editor-not-rendered'});
   const cls=await bookTab.getAttribute('class');
   if(String(cls||'').includes('<')||String(cls||'').length>80)failures.push({...row,error:'collections-html-leaked-into-tab-class'});
   const box=await form.boundingBox(),editorBox=await editor.boundingBox(),previewBox=await preview.boundingBox();
   if(box&&width>=768&&box.width<500)failures.push({...row,error:'collections-form-too-narrow'});
   if(width>=1100&&editorBox&&previewBox&&previewBox.x<=editorBox.x+100)failures.push({...row,error:'collections-preview-not-side-by-side'});
   await page.locator('#collectionTitle').fill('Vista en vivo QA');
   await page.locator('#collectionDescription').fill('Descripción que debe aparecer inmediatamente en la vista previa.');
   await page.locator('[data-collection-color="#4f9dd9"]').click();
   await page.locator('#collectionPublic').check({force:true});
   const live=await page.evaluate(()=>({
    title:document.querySelector('#collectionPreviewTitle')?.textContent,
    description:document.querySelector('#collectionPreviewDescription')?.textContent,
    badge:document.querySelector('#collectionPreviewBadge')?.textContent,
    color:document.querySelector('#collectionPreviewCard')?.style.getPropertyValue('--collection-preview-color'),
    inputColor:document.querySelector('#collectionAccent')?.value,
    swatch:document.querySelector('[data-collection-color="#4f9dd9"]')?.getAttribute('aria-pressed'),
    visibility:document.querySelector('#collectionVisibilityLabel')?.textContent
   }));
   if(live.title!=='Vista en vivo QA'||!live.description?.startsWith('Descripción que debe')||live.badge!=='Pública'||live.color!=='#4f9dd9'||live.inputColor!=='#4f9dd9'||live.swatch!=='true'||live.visibility!=='Colección pública')failures.push({...row,live,error:'collections-live-preview-failed'});
  }
  if(name==='user-library-collections-edit'){
   const visualChoices=page.locator('[data-collection-cover]');
   if((await visualChoices.count())<2)failures.push({...row,error:'collections-cover-gallery-missing-options'});
   const manual=page.locator('[data-collection-cover="project-1"]');
   if(await manual.count()){await manual.click();await page.waitForTimeout(20)}
   let coverState=await page.evaluate(()=>({value:document.querySelector('#collectionCover')?.value,label:document.querySelector('#collectionPreviewCoverLabel')?.textContent,images:document.querySelectorAll('#collectionPreviewCovers img.collectionPreviewCoverImage').length,pressed:document.querySelector('[data-collection-cover="project-1"]')?.getAttribute('aria-pressed')}));
   if(coverState.value!=='project-1'||coverState.label!=='Portada elegida'||coverState.images!==1||coverState.pressed!=='true')failures.push({...row,coverState,error:'collections-cover-gallery-manual-failed'});
   const automatic=page.locator('[data-collection-cover=""]');
   if(await automatic.count()){await automatic.click();await page.waitForTimeout(20)}
   coverState=await page.evaluate(()=>({value:document.querySelector('#collectionCover')?.value,label:document.querySelector('#collectionPreviewCoverLabel')?.textContent,pressed:document.querySelector('[data-collection-cover=""]')?.getAttribute('aria-pressed')}));
   if(coverState.value!==''||coverState.label!=='Portada automática'||coverState.pressed!=='true')failures.push({...row,coverState,error:'collections-cover-gallery-auto-failed'});
  }
  if(name==='admin')for(const tab of ['applications','users','teams','reports','content','links','beta','audit']){const b=page.locator('[data-admin-tab="'+tab+'"]:visible');if(await b.count())await b.first().click({timeout:5000})}
  if(name==='readonly-studio' && ((await page.locator('[data-v="studio:new"]:visible').count())||(await page.locator('[data-v="studio:import"]:visible').count())))failures.push({...row,error:'readonly-studio-exposes-editor-actions'});
  if(name==='readonly-project' && ((await page.locator('#createVolume:visible').count())||(await page.locator('#saveDiscoveryMeta:visible').count())||(await page.locator('[data-new-section]:visible').count())))failures.push({...row,error:'readonly-project-exposes-editor-actions'});
  if(name==='readonly-team' && ((await page.locator('#saveTeamProfile:visible').count())||(await page.locator('#addSupportLink:visible').count())||(await page.locator('[data-media-open]:visible').count())))failures.push({...row,error:'readonly-team-exposes-editor-actions'});
  if((vpName==='mobile-390'||vpName==='desktop-1280')&&['public-home','public-detail','public-reader','user-library','user-library-collections-form','user-library-collections-edit','creator-project','creator-team','import-edit','admin'].includes(name))await page.screenshot({path:'quality-results/'+vpName+'-'+name+'.png',fullPage:true});
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
// Supabase implicit-flow confirmation must be consumed before SPA hash routing.
{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'"+api+"',supabasePublishableKey:'qa',qaMode:true};"}));
 await context.route(api+'/**',r=>{
  const url=new URL(r.request().url());
  if(url.pathname==='/auth/v1/user')return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(user)});
  return r.fulfill({status:200,contentType:'application/json',body:'[]'});
 });
 const page=await context.newPage(),runtime=[];page.on('pageerror',e=>runtime.push(e.message));
 await page.goto(base+'#access_token=qa-confirm-token&refresh_token=qa-confirm-refresh&expires_in=3600&type=signup',{waitUntil:'networkidle'});
 await page.waitForTimeout(80);
 const authResult=await page.evaluate(()=>({hash:location.hash,token:localStorage.getItem('nlobi_token'),refresh:localStorage.getItem('nlobi_refresh_token'),title:document.title,text:document.body.innerText}));
 if(runtime.length||authResult.hash!=='#home'||authResult.token!=='qa-confirm-token'||authResult.refresh!=='qa-confirm-refresh'||!authResult.title.includes('El Obi del Lector'))failures.push({scenario:'email-confirmation-callback',runtime,authResult,error:'auth-callback-not-consumed'});
 await context.close();
}


// Realistic Japanese EPUB fixture: XHTML + SVG xlink image + relative path.
{
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});await prepare(context);
 const page=await context.newPage(),runtime=[];page.on('pageerror',e=>runtime.push(e.message));
 await page.goto(base+'#home',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__NLOBI_QA__?.parseEpub);
 const parsed=await page.evaluate(async b64=>{
  const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
  const file=new File([bytes],'fixture-jp.epub',{type:'application/epub+zip'});
  const r=await window.__NLOBI_QA__.parseEpub(file);
  return {text:r.text,blocks:r.blocks.map(x=>({type:x.type,text:x.text||'',url:x.url||''})),warnings:r.warnings};
 },'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');
 const image=parsed.blocks.find(x=>x.type==='image');
 if(runtime.length||!parsed.text.includes('これは本文です。')||!parsed.text.includes('画像の後の文章です。')||!parsed.blocks.some(x=>x.type==='heading'&&x.text.includes('第一章'))||!image||!/^data:image\/png;base64,/.test(image.url)){
  failures.push({scenario:'epub-svg-xlink-image',runtime,parsed,error:'epub-rich-import-failed'});
 }
 await context.close();
}


// Studio metadata and volume-level publishing must use the transactional RPCs.
{
 const calls=[];
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
 await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'"+api+"',supabasePublishableKey:'qa',qaMode:true};"}));
 await context.route(api+'/**',async r=>{
  const url=new URL(r.request().url()),path=url.pathname;
  if(path==='/rest/v1/rpc/update_translation_project_title'){calls.push({kind:'rename',body:r.request().postDataJSON()});return r.fulfill({status:204,body:''})}
  if(path==='/rest/v1/rpc/publish_volume_with_sections'){calls.push({kind:'publish',body:r.request().postDataJSON()});return r.fulfill({status:200,contentType:'application/json',body:'2'})}
  return r.fulfill({status:200,contentType:'application/json',body:'[]'});
 });
 const page=await context.newPage(),runtime=[];page.on('pageerror',e=>runtime.push(e.message));
 await page.goto(base+'#home',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__NLOBI_QA__);
 await page.evaluate(state=>{window.__NLOBI_QA__.setState(state);window.__NLOBI_QA__.setView('studio:project:project-1')},{...authBase,studioProject:translation,teamMembers});
 await page.locator('#projectTitle').fill('Nombre actualizado QA');
 await page.locator('input[name="projectGenres-choice"][value="Romance"]').check();
 await page.locator('#projectDemography').selectOption('General');
 await page.locator('#saveDiscoveryMeta').click();
 await page.waitForTimeout(60);
 await page.evaluate(state=>{window.__NLOBI_QA__.setState(state);window.__NLOBI_QA__.setView('studio:project:project-1')},{...authBase,studioProject:translation,teamMembers});
 await page.waitForFunction(()=>!!document.querySelector('[data-volume-status="volume-2"][data-status="published"]'));
 await page.evaluate(()=>document.querySelector('[data-volume-status="volume-2"][data-status="published"]')?.click());
 await page.waitForTimeout(650);
 const rename=calls.find(x=>x.kind==='rename'),publish=calls.find(x=>x.kind==='publish');
 if(runtime.length||rename?.body?.p_translation_id!=='project-1'||rename?.body?.p_title!=='Nombre actualizado QA'||publish?.body?.p_volume_id!=='volume-2'){
  failures.push({scenario:'studio-title-and-volume-publish',runtime,calls,error:'studio-rpc-flow-failed'});
 }
 await context.close();
}


// Detail view must return to the originating selection view.
{
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await prepare(context);
 const page=await context.newPage(),runtime=[];page.on('pageerror',e=>runtime.push(e.message));
 await page.goto(base+'#home',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__NLOBI_QA__);
 await page.evaluate(state=>{window.__NLOBI_QA__.setState(state);window.__NLOBI_QA__.setView('detail:project-1')},{...authBase,currentDetail:translation,detailBackRoute:'library'});
 await page.locator('[data-detail-back]').click();await page.waitForTimeout(30);
 if(runtime.length||!page.url().endsWith('#library'))failures.push({scenario:'detail-context-back',runtime,url:page.url(),error:'detail-back-route-failed'});
 await context.close();
}

// Deleting an entire Studio project must require confirmation and DELETE the novel root.
{
 const calls=[];
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
 await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'"+api+"',supabasePublishableKey:'qa',qaMode:true};"}));
 await context.route(api+'/**',async r=>{
  const u=new URL(r.request().url()),p=u.pathname;
  if(p==='/rest/v1/translations'&&u.searchParams.has('novel_id'))return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:'project-1',group_id:'group-1',volumes:translation.volumes||[]}])});
  if(p==='/rest/v1/section_revisions')return r.fulfill({status:200,contentType:'application/json',body:'[]'});
  if(p==='/rest/v1/novels'&&r.request().method()==='DELETE'){calls.push({kind:'delete-novel',url:r.request().url()});return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:'novel-1'}])})}
  return r.fulfill({status:200,contentType:'application/json',body:'[]'});
 });
 const page=await context.newPage(),runtime=[];page.on('pageerror',e=>runtime.push(e.message));
 page.on('dialog',async d=>{if(d.type()==='prompt')await d.accept('ELIMINAR');else await d.accept()});
 await page.goto(base+'#home',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__NLOBI_QA__);
 const project={...translation,novels:{...translation.novels,id:'novel-1'}};
 await page.evaluate(state=>{window.__NLOBI_QA__.setState(state);window.__NLOBI_QA__.setView('studio:project:project-1')},{...authBase,studioProject:project,teamMembers});
 await page.locator('#deleteStudioProject').click();await page.waitForTimeout(80);
 if(runtime.length||!calls.some(x=>x.kind==='delete-novel'))failures.push({scenario:'studio-delete-project',runtime,calls,error:'project-delete-not-issued'});
 await context.close();
}


// Calibre-style EPUB: repeated <title>, div-only prose, front matter, NCX boundaries and image-only/continuation pages.
{
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});await prepare(context);
 const page=await context.newPage(),runtime=[];page.on('pageerror',e=>runtime.push(e.message));
 await page.goto(base+'#home',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__NLOBI_QA__?.parseEpub);
 const result=await page.evaluate(async b64=>{
   const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
   const file=new File([bytes],'calibre-structure.epub',{type:'application/epub+zip'});
   const parsed=await window.__NLOBI_QA__.parseEpub(file);
   const sections=window.__NLOBI_QA__.detectImportSections(parsed.blocks,parsed.text);
   return {warnings:parsed.warnings,titles:sections.map(x=>x.title),types:sections.map(x=>x.section_type),blocks:sections.map(x=>x.blocks.map(b=>b.type)),text:parsed.text};
 },'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');
 const expected=['Prólogo','Capítulo 01: Inicio','Historia especial SS - Extra','Posfacio'];
 if(runtime.length||JSON.stringify(result.titles)!==JSON.stringify(expected)||result.text.includes('Créditos editoriales')||!result.warnings.some(x=>x.includes('material preliminar'))||!result.blocks[0].includes('image')||!result.blocks[1].includes('image')){
   failures.push({scenario:'calibre-epub-frontmatter-ncx',runtime,result,error:'calibre-epub-structure-failed'});
 }
 await context.close();
}

// Reader must expose valid illustrations from the rich-block model.
{
 const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});await prepare(context);
 const page=await context.newPage(),runtime=[];page.on('pageerror',e=>runtime.push(e.message));
 await page.goto(base+'#home',{waitUntil:'networkidle'});
 const result=await page.evaluate(async()=>{
  const url='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aGKsAAAAASUVORK5CYII=';
  window.__NLOBI_QA__.setState({view:'reader:test-image',readerSection:{id:'test-image',title:'Ilustración de prueba',novel_title:'QA',volume_number:1,content:[{type:'paragraph',text:'Antes de la ilustración'},{type:'image',url,alt:'Ilustración de prueba'},{type:'paragraph',text:'Después de la ilustración'}],navigation:[]}});
  const img=document.querySelector('.readerPaper figure img');
  if(!img)return {imageFound:false};
  try{await img.decode()}catch{}
  return {imageFound:true,naturalWidth:img.naturalWidth,visible:getComputedStyle(img).display!=='none',src:img.getAttribute('src')?.startsWith('data:image/png')};
 });
 if(runtime.length||!result.imageFound||!result.naturalWidth||!result.visible||!result.src)failures.push({scenario:'reader-rich-block-image-visible',runtime,result,error:'reader-image-not-rendered'});
 await context.close();
}

 // EPUB3 navigation takes priority over the NCX fallback; title pages are not chapters.
 {
  const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});await prepare(context);
  const page=await context.newPage(),runtime=[];page.on('pageerror',e=>runtime.push(e.message));
  await page.goto(base+'#home',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__NLOBI_QA__?.parseEpub);
  const result=await page.evaluate(async raw=>{
   const bytes=Uint8Array.from(atob(raw),x=>x.charCodeAt(0));
   const parsed=await window.__NLOBI_QA__.parseEpub(new File([bytes],'Libro de prueba.epub',{type:'application/epub+zip'}));
   const origin=window.__NLOBI_CONFIG__.supabaseUrl;
   const url=origin+'/storage/v1/object/public/nlobi-media/teams/123/imports/example.jpg';
   return {titles:parsed.sections?.map(x=>x.title),text:parsed.text,media:window.__NLOBI_QA__.mediaUrl(url)};
  },'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');
  if(runtime.length||JSON.stringify(result.titles)!==JSON.stringify(['Prólogo','Capítulo 1'])||result.text.includes('Créditos editoriales')||result.media!=='/media/teams/123/imports/example.jpg'){
   failures.push({scenario:'epub-title-chapter-and-reader-media-path',runtime,result,error:'epub-title-or-media-regression'});
  }
  await context.close();
 }


 // Reader settings remain collapsed; comments belong to volume and completed chapters show in the work view.
 {
  const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});await prepare(context);
  const page=await context.newPage(),runtime=[];page.on('pageerror',e=>runtime.push(e.message));
  await page.goto(base+'#home',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__NLOBI_QA__);
  await page.evaluate(state=>window.__NLOBI_QA__.setState(state),{user:null,readerSection:{...section1,translation_id:'project-1',novel_title:'Obra QA',volume_number:1,navigation:[section1,section2]},view:'reader:section-1'});
  const before=await page.evaluate(()=>({collapsed:!document.querySelector('#readerSettings')?.open,commentInReader:!!document.querySelector('.commentBox'),finish:!!document.querySelector('#finishAndNext'),indent:!!document.querySelector('#readerIndent')}));
  await page.locator('#readerSettings>summary').click();
  await page.locator('[data-reader-quick="theme"][data-reader-value="dark"]').click();
  await page.locator('[data-reader-quick="fontSize"][data-reader-value="21"]').click();
  const readerQuick=await page.evaluate(()=>({
   popup:!!document.querySelector('#readerSettings')?.open,
   dark:!!document.querySelector('.readerExperience.readerSurface-dark'),
   textSize:document.querySelector('.readerExperience .readerPaper')?.style.fontSize,
   chapterHeading:!!document.querySelector('#chapterTitle'),
   progressTrack:!!document.querySelector('#readerProgressFill'),
   advancedSource:!!document.querySelector('#readerFontFamily option[value="original"]'),
   imageControl:!!document.querySelector('#readerImages')
  }));
  await page.locator('#closeReaderSettings').click();
  await page.locator('#readerBookmark').click();
  const readerBookmark=await page.evaluate(()=>!!localStorage.getItem('nlobi_reader_position_guest_section-1'));
  await page.locator('#markReaderDone').click();
  const read=await page.evaluate(()=>JSON.parse(localStorage.getItem('nlobi_read_sections_guest')||'[]').includes('section-1'));
  await page.evaluate(state=>window.__NLOBI_QA__.setState(state),{user:null,view:'detail:project-1',currentDetail:translation});
  await page.locator('[data-open-volume="volume-1"]').click();
  const after=await page.evaluate(()=>({badge:document.body.textContent.includes('✓ Leído'),volumeComments:!!document.querySelector('[data-volume-comments]')}));
  if(runtime.length||!readerQuick.popup||!readerQuick.dark||readerQuick.textSize!=='21px'||!readerQuick.chapterHeading||!readerQuick.progressTrack||!readerQuick.advancedSource||!readerQuick.imageControl||!readerBookmark||!before.collapsed||before.commentInReader||!before.finish||!before.indent||!read||!after.badge||!after.volumeComments)
   failures.push({scenario:'reader-quick-settings-progress-and-chapter-completion',runtime,before,readerQuick,readerBookmark,read,after});
  await context.close();
 }



 // Continuous reading and volume-only settings: load next published chapter, save its position and keep global mode unchanged.
 {
  const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});
  await prepare(context);
  await context.route(/\/rest\/v1\/sections\?/,r=>{
   const url=new URL(r.request().url()),id=url.searchParams.get('id')||'';
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(id.includes('section-2')?[section2]:id.includes('section-1')?[section1]:[])});
  });
  const page=await context.newPage(),runtime=[];page.on('pageerror',e=>runtime.push(e.message));
  await page.goto(base+'#home',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__NLOBI_QA__);
  await page.evaluate(state=>window.__NLOBI_QA__.setState(state),{user:null,view:'detail:project-1',currentDetail:translation});
  await page.locator('[data-open-volume="volume-1"]').click();
  const volumeControls=await page.locator('[data-reader-scope="volume"]').count();
  await page.locator('[data-reader-setting="mode"][data-reader-scope="volume"]').selectOption('continuous');
  await page.locator('[data-reader-setting="theme"][data-reader-scope="volume"]').selectOption('sepia');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('nlobi_reader_settings_guest')||'{}'));
  await page.evaluate(state=>window.__NLOBI_QA__.setState(state),{user:null,readerSection:{...section1,translation_id:'project-1',novel_title:'Obra QA',volume_number:1,navigation:[{...section1,volume_number:1},{...section2,volume_number:1}]},view:'reader:section-1'});
  const continuous=await page.locator('#readerContinuousChapters').count();
  await page.evaluate(()=>{const sentinel=document.getElementById('readerContinuousMore');if(sentinel&&!sentinel.hidden)sentinel.scrollIntoView({block:'end'});});
  await page.waitForSelector('[data-reader-chapter-id="section-2"]',{timeout:12000});
  await page.evaluate(()=>{document.querySelector('[data-reader-chapter-id="section-2"]')?.scrollIntoView({block:'start'});window.dispatchEvent(new Event('scroll'));});
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('nlobi_read_sections_guest')||'[]').includes('section-1'),undefined,{timeout:5000});
  await page.evaluate(()=>document.getElementById('readerBookmark')?.click());
  const active=await page.evaluate(()=>({
   chapter:window.__NLOBI_QA__.getState().readerContinuous?.activeId,
   read:JSON.parse(localStorage.getItem('nlobi_read_sections_guest')||'[]').includes('section-1'),
   position:JSON.parse(localStorage.getItem('nlobi_reader_settings_guest')||'{}').positions?.['volume-1']?.sectionId,
   count:document.querySelectorAll('.readerContinuousChapter').length,
   chapter2:document.body.textContent.includes('Segundo capítulo.')
  }));
  if(runtime.length||volumeControls<6||saved.mode!=='chapter'||saved.volumes?.['volume-1']?.mode!=='continuous'||saved.volumes?.['volume-1']?.theme!=='sepia'||!continuous||!active.read||active.chapter!=='section-2'||active.position!=='section-2'||active.count!==2||!active.chapter2)
   failures.push({scenario:'reader-continuous-per-volume-position-and-completion',runtime,volumeControls,saved,continuous,active});
  await context.close();
 }

 // The work page shows volume covers first, then chapters after selecting a volume.
 {
  const context=await browser.newContext({viewport:{width:1280,height:900},serviceWorkers:'block'});await prepare(context);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#home',{waitUntil:'networkidle'});
  await page.evaluate(state=>window.__NLOBI_QA__.setState(state),{user:null,view:'detail:project-1',currentDetail:translation,detailVolumeId:null,detailVolumeTranslationId:'project-1'});
  const gallery=await page.evaluate(()=>({covers:document.querySelectorAll('[data-open-volume]').length,chapters:document.querySelectorAll('.volumeChapterList .sectionRow').length}));
  await page.locator('[data-open-volume="volume-1"]').click();
  const opened=await page.evaluate(()=>({chapters:document.querySelectorAll('.volumeChapterList .sectionRow').length,comments:document.querySelectorAll('[data-volume-comments]').length,title:document.querySelector('.volumeOpenedHero h2')?.textContent}));
  await page.locator('[data-volume-gallery]').click();
  const back=await page.locator('[data-open-volume]').count();
  if(errors.length||gallery.covers!==1||gallery.chapters!==0||opened.chapters!==2||opened.comments!==1||!opened.title||back!==1)
   failures.push({scenario:'volume-cover-gallery-chapter-navigation',errors,gallery,opened,back});
  await context.close();
 }


 // A valid EPUB stylesheet with an embedded font must retain font metadata.
 {
  const context=await browser.newContext({viewport:{width:375,height:812},serviceWorkers:'block'});await prepare(context);
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'#home',{waitUntil:'networkidle'});await page.waitForFunction(()=>!!window.__NLOBI_QA__?.parseEpub);
  await page.addScriptTag({url:'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js'});
  const result=await page.evaluate(async()=>{
   const zip=new JSZip();
   zip.file('mimetype','application/epub+zip');
   zip.file('META-INF/container.xml','<container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
   zip.file('OEBPS/content.opf','<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Novela de prueba</dc:title></metadata><manifest><item id="css" href="styles/book.css" media-type="text/css"/><item id="font" href="fonts/story.woff2" media-type="font/woff2"/><item id="c1" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="c1"/></spine></package>');
   zip.file('OEBPS/styles/book.css','@font-face { font-family: "Fuente de novela"; src: url("../fonts/story.woff2") format("woff2"); font-weight: 400; } @font-face { font-family: "Fuente de novela"; src: url("../fonts/story-bold.woff2"); font-weight: 700; } @font-face { font-family: "Fuente adicional"; src: url("../fonts/other.otf"); font-style: italic; } body {font-family: "Fuente de novela";}');
   zip.file('OEBPS/fonts/story.woff2',new Uint8Array([119,79,70,50,0,0,0,0]));zip.file('OEBPS/fonts/story-bold.woff2',new Uint8Array([119,79,70,50,0,0,0,0]));zip.file('OEBPS/fonts/other.otf',new Uint8Array([79,84,84,79,0,0,0,0]));
   zip.file('OEBPS/chapter.xhtml','<html xmlns="http://www.w3.org/1999/xhtml"><head><title>Capítulo 1</title></head><body><h1>Capítulo 1</h1><p>Texto de prueba con fuente original.</p></body></html>');
   const blob=await zip.generateAsync({type:'blob'});
   const parsed=await window.__NLOBI_QA__.parseEpub(new File([blob],'fuente.epub',{type:'application/epub+zip'}));
   return {fonts:parsed.epubFonts,warning:parsed.warnings?.some(x=>x.includes('Se detectaron'))};
  });
  const mobile=await page.evaluate(()=>({horizontalOverflow:document.documentElement.scrollWidth>innerWidth,visibleMenu:getComputedStyle(document.querySelector('.mobileNav')).display!=='none',desktopHidden:getComputedStyle(document.querySelector('.bar>.nav')).display==='none'}));
  await page.locator('.mobileNav > summary').click();
  const links=await page.locator('.mobileNav[open] nav a.navLink').count();
  if(errors.length||result.fonts?.length!==3||result.fonts?.[0]?.family!=='Fuente de novela'||result.fonts?.[0]?.path!=='OEBPS/fonts/story.woff2'||result.fonts?.[1]?.weight!=='700'||result.fonts?.[2]?.family!=='Fuente adicional'||result.fonts?.[2]?.style!=='italic'||!result.warning||mobile.horizontalOverflow||!mobile.visibleMenu||!mobile.desktopHidden||links<3){
   failures.push({scenario:'epub-embedded-font-and-mobile-header',errors,result,mobile,links});
  }
  await context.close();
 }

await browser.close();
fs.writeFileSync('quality-results/full-quality-report.json',JSON.stringify({testedAt:new Date().toISOString(),renderedScenarios:report.length,failures,report},null,2));
console.log('Full quality pass: '+report.length+' rendered scenarios; '+failures.length+' failure(s).');
if(failures.length){console.error(JSON.stringify(failures.slice(0,25),null,2));process.exit(1)}
