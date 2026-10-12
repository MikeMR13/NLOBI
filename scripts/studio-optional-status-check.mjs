import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium} from 'playwright';

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/20261011214500_optional_editorial_metadata_statuses.sql',import.meta.url),'utf8');
for(const [source,label,pattern] of [
 [migration,'No se asigna estado original predeterminado',/alter column status drop default/i],
 [migration,'No se asigna estado de secuela predeterminado',/alter column sequel_status drop default/i],
 [migration,'Las secuelas aceptan NULL',/alter column sequel_status drop not null/i],
 [migration,'El RPC editorial permite original NULL',/p_novel_status is not null and p_novel_status not in/i],
 [migration,'El RPC editorial permite secuela NULL',/v_sequel_status is not null and v_sequel_status not in/i],
 [migration,'El RPC de creación ya no presupone En publicación',/coalesce\(p_tags,'\{\}'\),null,null/i]
])assert.match(source,pattern,label);
assert.doesNotMatch(migration,/^\s*update public\.novels\s+set\s+status='ongoing'/im,'No modificar clasificaciones anteriores');

const project={
 id:'project-qa',title:'Obra QA',status:'active',group_id:'group-qa',language_code:'es',
 novels:{id:'novel-qa',title:'Obra sin situación verificada',status:null,sequel_status:null,novel_type:'light_novel',genres:['Fantasía'],tags:[]},
 translator_groups:{id:'group-qa',name:'Equipo de prueba',slug:'equipo-qa'},
 volumes:[]
};
const browser=await chromium.launch({headless:true});
try{
 for(const width of [390,1280]){
  const context=await browser.newContext({viewport:{width,height:900},serviceWorkers:'block'});
  await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
  await context.route('https://qa.supabase.local/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.__NLOBI_QA__);
  await page.evaluate(p=>window.__NLOBI_QA__.setState({
   user:{id:'user-qa',email:'owner@example.test'},profile:{id:'user-qa',display_name:'Editor QA'},
   accountPermissionsReady:true,groups:[{role:'owner',translator_groups:{id:'group-qa',name:'Equipo de prueba'}}],
   studioTranslations:[p],studioProject:p,catalog:[p],notes:[],admin:false
  }),project);
  await page.evaluate(()=>window.__NLOBI_QA__.setView('studio:new'));
  assert.equal(await page.locator('#newNovelStatus').inputValue(),'','Creación: novela original sin dato confirmado');
  assert.equal(await page.locator('#newSequelStatus').inputValue(),'','Creación: secuela sin dato confirmado');
  assert.equal(await page.locator('#newTranslationStatus').inputValue(),'active','La traducción tiene un estado operativo');
  await page.evaluate(()=>window.__NLOBI_QA__.setView('studio:project:project-qa'));
  assert.equal(await page.locator('#projectNovelStatus').inputValue(),'');
  assert.equal(await page.locator('#projectSequelStatus').inputValue(),'');
  await page.locator('.studioProjectStatusSummary').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('.studioProjectStatusSummary dt').allTextContents().then(x=>x.map(y=>y.trim()).join('|')),'Traducción','Resumen: no inventar la situación original ni de la secuela');
  await page.locator('#projectNovelStatus').selectOption('ongoing');
  await page.locator('#projectNovelStatus').selectOption('');
  assert.equal(await page.locator('#projectNovelStatus').inputValue(),'','El estado original puede limpiarse');
  await page.locator('#projectSequelStatus').selectOption('unconfirmed');
  await page.locator('#projectSequelStatus').selectOption('');
  assert.equal(await page.locator('#projectSequelStatus').inputValue(),'','La secuela puede quedar sin determinar');
  await page.evaluate(()=>window.__NLOBI_QA__.setView('explore'));
  assert.equal(await page.locator('.catalogOriginalStatus').count(),0,'Explorar: sin indicador especulativo');
  await page.evaluate(()=>window.__NLOBI_QA__.setView('detail:project-qa'));
  // Rutas de detalle utilizan los datos de la novela cargados en S.currentDetail.
  await page.evaluate(p=>window.__NLOBI_QA__.setState({currentDetail:p}),project);
  assert.equal(await page.locator('.detailHero .badge').filter({hasText:'Original:'}).count(),0,'Detalle público: sin estado original desconocido');
  await page.evaluate(p=>window.__NLOBI_QA__.setState({currentDetail:{...p,novels:{...p.novels,status:'ongoing',sequel_status:'unconfirmed'}}}),project);
  assert.equal(await page.locator('.detailHero .badge').filter({hasText:'Original:'}).count(),1,'Detalle: etiqueta confirmada visible');
  assert.ok((await page.locator('.detailHero').innerText()).includes('Sin secuela confirmada'),'Se muestra la secuela solo cuando se establece expresamente');
  assert.deepEqual(errors,[],errors.join('; '));
  await context.close();
  console.log('Estados opcionales OK a '+width+' px: creación, edición, catálogo y detalle público');
 }
}finally{await browser.close()}
