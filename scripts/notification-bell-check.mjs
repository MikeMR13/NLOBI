import assert from 'node:assert/strict';
import {chromium} from 'playwright';

const browser=await chromium.launch({headless:true});
const api='https://qa.supabase.local',uid='11111111-1111-4111-8111-111111111111';
const originals=[
 {id:'22222222-2222-4222-8222-222222222222',user_id:uid,notification_type:'system',title:'Aviso del sistema',body:'Información importante',translation_id:null,volume_id:null,section_id:null,read_at:null,created_at:'2026-10-11T20:35:00Z'},
 {id:'33333333-3333-4333-8333-333333333333',user_id:uid,notification_type:'team_application',title:'Equipo aprobado',body:'Ya puedes administrar el equipo',translation_id:null,volume_id:null,section_id:null,read_at:null,created_at:'2026-10-11T20:30:00Z'},
 {id:'44444444-4444-4444-8444-444444444444',user_id:uid,notification_type:'new_publication',title:'Volumen actualizado',body:'Nuevo capítulo publicado',translation_id:null,volume_id:null,section_id:null,read_at:'2026-10-11T20:00:00Z',created_at:'2026-10-11T20:00:00Z'}
];
try{
 for(const width of [390,900,1280]){
  const rows=structuredClone(originals),requests=[],runtime=[];
  let failRefresh=false;
  const context=await browser.newContext({viewport:{width,height:820},serviceWorkers:'block'});
  await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:`window.__NLOBI_CONFIG__={supabaseUrl:'${api}',supabasePublishableKey:'qa',qaMode:true};`}));
  await context.route(api+'/**',r=>{
   const request=r.request(),url=new URL(request.url());
   if(url.pathname==='/rest/v1/notifications'){
    if(request.method()==='GET'){
     requests.push('GET');
     return r.fulfill({status:failRefresh?503:200,contentType:'application/json',body:failRefresh?'{"message":"simulated notification outage"}':JSON.stringify(rows)});
    }
    if(request.method()==='PATCH'){
     requests.push('PATCH');
     const id=url.searchParams.get('id')?.slice(3);
     const row=rows.find(x=>x.id===id);
     if(row)row.read_at=request.postDataJSON()?.read_at||new Date().toISOString();
     return r.fulfill({status:204,body:''});
    }
   }
   return r.fulfill({status:200,contentType:'application/json',body:'[]'});
  });
  const page=await context.newPage();
  page.on('pageerror',e=>runtime.push(e.message));
  await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.__NLOBI_QA__);
  await page.evaluate(({uid,rows})=>window.__NLOBI_QA__.setState({user:{id:uid,email:'creator@example.test'},profile:{id:uid,display_name:'Cuenta de prueba'},notes:rows,notificationBellOpen:'',notificationLoading:false,notificationError:''}),{uid,rows});
  const surface=width>=1101?'desktop':'mobile';
  const box=page.locator('[data-bell-surface="'+surface+'"]');
  const summary=box.locator('summary');
  assert.equal(await summary.isVisible(),true,'Visible notification bell at '+width);
  assert.match(await summary.getAttribute('aria-label'),/2 sin leer/);
  await summary.click();
  await page.waitForFunction(()=>window.__NLOBI_QA__.getState().notificationLoading===false);
  assert.equal(await box.getAttribute('open')!==null,true,'Bell remains open after refreshing at '+width);
  assert.equal(await summary.getAttribute('aria-expanded'),'true');
  assert.equal(await box.locator('.headerNotificationItem').count(),3);
  assert.equal(requests.filter(x=>x==='GET').length,1);
  const geometry=await box.locator('.headerNotificationPanel').boundingBox();
  assert.ok(geometry&&geometry.x>=-2&&geometry.x+geometry.width<=width+2,'Panel fits viewport at '+width);
  await page.keyboard.press('Escape');
  assert.equal(await box.getAttribute('open'),null,'Escape closes bell');
  await summary.click();
  await page.waitForFunction(()=>window.__NLOBI_QA__.getState().notificationLoading===false);
  await box.locator('[data-bell-open="'+originals[0].id+'"]').click();
  await page.waitForURL('**/#beta');
  assert.equal(requests.filter(x=>x==='PATCH').length,1,'Opening notification marks it read');
  assert.ok(rows[0].read_at,'Only clicked notification was updated in the database');
  assert.ok(!rows[1].read_at,'Unopened notification stays unread');
  assert.equal(await page.evaluate(()=>window.__NLOBI_QA__.getState().notes.filter(x=>!x.read_at).length),1);
  await page.evaluate(()=>window.__NLOBI_QA__.setView('home'));
  await page.locator('[data-bell-surface="'+surface+'"] > summary').click();
  await page.waitForFunction(()=>window.__NLOBI_QA__.getState().notificationLoading===false);
  failRefresh=true;
  await page.locator('[data-bell-surface="'+surface+'"] [data-bell-refresh]').click();
  await page.waitForFunction(()=>window.__NLOBI_QA__.getState().notificationLoading===false);
  assert.match(await page.locator('[data-bell-surface="'+surface+'"] .headerNotificationMessage').textContent(),/No se pudieron actualizar/);
  assert.equal(await page.locator('[data-bell-surface="'+surface+'"] .headerNotificationItem').count(),3,'Transient error must not erase messages');
  failRefresh=false;
  await page.locator('[data-bell-surface="'+surface+'"] [data-bell-refresh]').click();
  await page.waitForFunction(()=>window.__NLOBI_QA__.getState().notificationLoading===false);
  assert.equal(await page.locator('[data-bell-surface="'+surface+'"] .headerNotificationMessage').count(),0,'Recovery clears error');
  await page.locator('[data-bell-surface="'+surface+'"] .headerNotificationAll').click();
  await page.waitForURL('**/#notifications');
  assert.equal(await page.locator('h1#notificationsTitle').count(),1,'All notifications button navigates');
  assert.equal(runtime.length,0,'Browser exceptions: '+runtime.join('; '));
  await context.close();
  console.log('Bell QA OK at '+width+'px: load, open, Escape, read, navigation, retry and no horizontal clipping');
 }
}finally{await browser.close()}
