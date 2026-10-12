import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';

mkdirSync('quality-results',{recursive:true});
const browser=await chromium.launch({headless:true});
const api='https://qa.supabase.local';
const project={
 id:'project-1',group_id:'group-1',title:'Proyecto de novela ligera',
 status:'active',editorial_mode:false,language_code:'es',updated_at:'2026-10-11T10:00:00Z',
 novels:{id:'novel-1',title:'¿Pensaste que la esposa online no era una chica?',novel_type:'light_novel',status:'ongoing',sequel_status:'unconfirmed',genres:['Comedia'],tags:[],synopsis:'Un ejemplo de novela japonesa',author_name:'Autor QA'},
 translator_groups:{id:'group-1',name:'Equipo traductor QA'},
 volumes:[{id:'volume-18',volume_number:18,title:'Volumen dieciocho',status:'published',is_final_volume:false,sections:[]}]
};
try {
 for (const width of [320,390,768,1008,1280,1600]) {
  const context=await browser.newContext({viewport:{width,height:850},serviceWorkers:'block',colorScheme:'dark'});
  await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:`window.__NLOBI_CONFIG__={supabaseUrl:'${api}',supabasePublishableKey:'qa',qaMode:true};`}));
  await context.route(api+'/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'networkidle'});
  await page.waitForFunction(()=>!!window.__NLOBI_QA__);
  await page.evaluate(project=>{
   window.__NLOBI_QA__.setState({
    user:{id:'user-1',email:'qa@example.test'},profile:{id:'user-1',display_name:'OX-MRADMIN'},
    groups:[{role:'owner',translator_groups:{id:'group-1',name:'Equipo traductor QA'}}],
    accountPermissionsReady:true,studioProject:project,studioTranslations:[project],
    studioEditVolumeId:'volume-18',admin:false,notes:[]
   });
   window.__NLOBI_QA__.setView('studio:project:project-1');
  },project);
  const container=page.locator('#studioProjectOverview');
  await container.waitFor({state:'visible'});
  const box=page.locator('#newVolumeIsFinalVolume');
  await box.waitFor({state:'attached'});
  const dimensions=await page.evaluate(()=>{
   const input=document.getElementById('newVolumeIsFinalVolume');
   const label=input.closest('.radio');
   const rect=input.getBoundingClientRect(),boundary=label.getBoundingClientRect();
   return {inputWidth:rect.width,inputHeight:rect.height,labelWidth:boundary.width,
    labelLeft:boundary.left,textRight:label.querySelector('span').getBoundingClientRect().right,
    labelRight:boundary.right,pageWidth:document.documentElement.scrollWidth};
  });
  assert.ok(dimensions.inputWidth>=18&&dimensions.inputWidth<=25,`Checkbox width invalid at ${width}: ${JSON.stringify(dimensions)}`);
  assert.ok(dimensions.inputHeight>=18&&dimensions.inputHeight<=25,`Checkbox height invalid at ${width}: ${JSON.stringify(dimensions)}`);
  assert.ok(dimensions.textRight<=dimensions.labelRight+2,`Checkbox label clipped at ${width}`);
  assert.ok(dimensions.pageWidth<=width+2,`Horizontal overflow at ${width}: ${JSON.stringify(dimensions)}`);
  assert.equal(await page.locator('#newVolumeFinalStatus').isDisabled(),true);
  assert.match(await page.locator('#newVolumeFinalHint').textContent(),/Mientras esté desmarcada/);
  await box.check();
  assert.equal(await page.locator('#newVolumeFinalStatus').isEnabled(),true);
  assert.match(await page.locator('#newVolumeFinalHint').textContent(),/se marcará como completada/);
  await box.uncheck();
  assert.equal(await page.locator('#newVolumeFinalStatus').isDisabled(),true);
  assert.equal(await page.locator('#editVolumeFinalStatus').isDisabled(),true);
  await page.locator('#editVolumeIsFinalVolume').check();
  assert.equal(await page.locator('#editVolumeFinalStatus').isEnabled(),true);
  assert.equal(await page.locator('.studioProjectStatusSummary dt').allInnerTexts().then(x=>x.join('|')),'Novela original|Traducción|Secuela');
  assert.match(await page.locator('.studioProjectStatusSummary dd').allInnerTexts().then(x=>x.join('|')),/En publicación\|Activa\|Sin secuela confirmada/);
  await container.screenshot({path:`quality-results/studio-final-volume-${width}.png`});
  const sidebar=await page.locator('.top .bar>.nav').evaluate(el=>getComputedStyle(el).display);
  if(width<=1100)assert.equal(sidebar,'none','Desktop menu should not extend beyond the viewport');
  await page.locator('[data-studio-project-jump="studioEditorialStates"]').click();
  assert.ok(await page.locator('#studioEditorialStates').isVisible());
  assert.deepEqual(errors,[],`Browser errors at ${width}`);
  await context.close();
  console.log(`Studio volume form OK: ${width}px, checkbox ${dimensions.inputWidth}×${dimensions.inputHeight}px; no overflow`);
 }
} finally {await browser.close()}
