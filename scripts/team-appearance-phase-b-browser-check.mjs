import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const base='http://127.0.0.1:4173/';
for(const [name,browserType] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await browserType.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.route('**/runtime-config.js',route=>route.fulfill({
  status:200,contentType:'application/javascript',
  body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"
 }));
 await context.route('https://qa.supabase.local/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
 const page=await context.newPage();
 try{
  await page.goto(base+'#home',{waitUntil:'domcontentloaded'});
  const report=await page.evaluate(async()=>{
   const api=await import('/assets/team-appearance-phase-b.js');
   const frame=document.createElement('div');
   frame.innerHTML='<main class="teamPublicPage teamTheme-claro teamPattern-asanoha teamFont-japonesa teamCover-obi" style="--team-pattern-opacity:.12;--team-profile-accent:#bb3260">'+
    '<section class="teamIdentityCopy"><h1>Grupo de prueba</h1></section><section class="teamPublicSection"><h2>Traducciones</h2><div class="teamWorkCard"><article class="novelCard"><a class="catalogCoverButton"><span class="catalogBookArt"><img alt="Novela" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E"></span></a></article></div></section></main>'+
    '<section id="teamPanel-custom">'+
    '<input data-team-setting="section_order" value="presentacion,destacados,fijadas,estadisticas,traducciones,novedades,apoyo">'+
    '<select data-team-setting="team_pattern"><option>none</option><option selected>asanoha</option></select>'+
    '<select data-team-setting="team_font"><option>japonesa</option></select>'+
    '<select data-team-setting="team_cover_style"><option>obi</option></select>'+
    '<input data-team-setting="team_pattern_intensity" value="12">'+
    '<input id="teamBThemeName" value="Equipo Sakura">'+
    '<button id="teamBSavePreset">Guardar</button><button id="teamBExport">Exportar</button>'+
    '<select id="teamBStored"></select><button id="teamBApplyStored">Aplicar</button><button id="teamBDeleteStored">Eliminar</button>'+
    '<textarea id="teamBThemeJSON"></textarea><button id="teamBImport">Importar</button><button id="teamBCopy">Copiar</button>'+
    '<output id="teamBStrength">12</output><div id="teamBOrderList"></div><p id="teamBMessage"></p></section>';
   document.body.append(frame);
   const profile=frame.querySelector('main'),title=profile.querySelector('h1'),cover=profile.querySelector('.catalogBookArt');
   const content=getComputedStyle(profile,'::before').content;
   const opacity=Number(getComputedStyle(profile,'::before').opacity);
   const coverObi=getComputedStyle(cover,'::after').content;
   const font=getComputedStyle(title).fontFamily;
   let previewCalls=0;
   const panel=frame.querySelector('#teamPanel-custom');
   const readSettings=()=>Object.fromEntries([...panel.querySelectorAll('[data-team-setting]')].map(el=>[el.dataset.teamSetting,el.value]));
   api.bindTeamAppearanceB({userId:'phase-b-e2e',readSettings,refreshPreview:()=>{previewCalls++}});
   const rows=frame.querySelectorAll('.teamBOrderItem').length;
   const up=frame.querySelector('[data-team-b-move="destacados"][data-direction="-1"]');
   up.click();const newOrder=panel.querySelector('[data-team-setting="section_order"]').value;
   frame.querySelector('#teamBSavePreset').click();
   const stored=frame.querySelector('#teamBStored').options.length;
   frame.querySelector('#teamBExport').click();
   const text=frame.querySelector('#teamBThemeJSON').value;
   panel.querySelector('[data-team-setting="team_pattern"]').value='none';
   frame.querySelector('#teamBStored').value='0';
   frame.querySelector('#teamBApplyStored').click();
   const restored=panel.querySelector('[data-team-setting="team_pattern"]').value;
   frame.querySelector('#teamBImport').click();
   const valid=api.importTeamAppearance(text).appearance;
   frame.remove();
   return {content,opacity,coverObi,font,rows,newOrder,stored,text,restored,previewCalls,valid};
  });
  assert.notEqual(report.content,'none',name+' sin patrón de fondo');
  assert.ok(report.opacity>=.1&&report.opacity<=.13,name+' opacidad inesperada');
  assert.ok(report.coverObi.includes('EL OBI'),name+' faltó el obi');
  assert.match(report.font,/Noto Serif|Yu Mincho|Georgia/,name+' fuente editorial ausente');
  assert.equal(report.rows,7,name+' orden incompleto');
  assert.ok(report.newOrder.startsWith('destacados,presentacion'),name+' ordenar no funciona');
  assert.equal(report.stored,2,name+' biblioteca local no guardó');
  assert.equal(report.restored,'asanoha',name+' tema guardado no restaurado');
  assert.ok(report.text.includes('"obi_team_theme": 1'),name+' exportación incorrecta');
  assert.ok(report.previewCalls>=2,name+' la vista previa no se actualizó');
  assert.equal(report.valid.team_cover_style,'obi');
  console.log(name+' Fase B: CSS decorativo, temas JSON y orden visual OK');
 }finally{await browser.close()}
}
