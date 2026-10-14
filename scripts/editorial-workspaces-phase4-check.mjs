import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';

const css=fs.readFileSync('src/styles.css','utf8');
const app=fs.readFileSync('src/app.js','utf8');
const phase=css.split('/* OBI EDITORIAL WORKSPACES — FASE 4')[1];
assert.ok(phase,'Falta bloque de la fase 4 editorial');
for(const name of ['.studioV3 .studioV3PageHeading','.studioV3 .studioV3Stat',
 '.readerProfileHero','.publicReaderHero','.teamPublicPage .teamPublicNav',
 '.teamSettingsTab.active','.adminWorkspace .adminWorkspaceHeader',
 '.adminWorkspace .adminSideLink']){
 assert.ok(phase.includes(name),'Falta área '+name);
}
for(const [cls] of [['studioV3BrandMark'],['adminSidebarLogo'],['readerProfileMark']]){
 assert.ok(app.includes('<span class="'+cls+'" aria-hidden="true">帯</span>'),
  'El sello editorial 帯 no está en '+cls);
}
assert.doesNotMatch(phase,/\.readerPaper|\.readerExperience|NLOBI-EPUB|data-epub-family|@import|url\(\s*['"]?https?:/i);
assert.match(phase,/body\.dark/);
assert.match(phase,/prefers-reduced-motion:reduce/);
assert.match(phase,/forced-colors:active/);
assert.ok(app.includes('if(!S.user||!S.admin)'), 'No alterar guardas de administración');
assert.ok(app.includes('isCurrentGroupManager(G.id)'), 'No alterar permisos de equipo');
assert.ok(app.includes('teamPublicStyle(customization)'), 'Conservar identidad visual propia del equipo');
const fixture="<!doctype html><html lang=\"es\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><link rel=\"stylesheet\" href=\"/assets/styles.css\"></head><body>\n<main class=\"wrap studioV3\" id=\"studio\"><header class=\"studioV3PageHeading\"><div><span class=\"studioV3Kicker\">STUDIO / ESPACIO EDITORIAL</span><h1>Tu Studio</h1></div></header><div class=\"studioV3Layout\"><aside class=\"studioV3Sidebar\" aria-label=\"Navegación de Studio\"><div class=\"studioV3Brand\"><span class=\"studioV3BrandMark\" aria-hidden=\"true\">帯</span><div><strong>STUDIO</strong><small>El Obi del Lector</small></div></div><div class=\"studioV3NavBlock\"><span class=\"studioV3NavLabel\">ESPACIO EDITORIAL</span><button class=\"studioV3NavItem active\" data-studio-jump=\"studioOverview\" aria-current=\"page\" type=\"button\">Resumen</button><button class=\"studioV3NavItem\" type=\"button\">Mis obras</button></div></aside><div class=\"studioV3Content\"><section class=\"studioV3Overview\" id=\"studioOverview\"><div class=\"studioV3SectionEyebrow\">RESUMEN EDITORIAL</div><div class=\"studioV3OverviewHeader\"><h2>Tu mesa de trabajo</h2></div><div class=\"studioV3StatGrid\"><div class=\"studioV3Stat\"><span class=\"studioV3StatSymbol\">▦</span><strong>4</strong><span>Proyectos</span></div></div><div class=\"studioV3Insight\"><h3>Actividad editorial</h3><p>Una colección de ejemplo</p></div></section></div></div></main>\n<main class=\"wrap\" id=\"readerProfile\"><section class=\"readerProfileHero\" aria-labelledby=\"readerProfileName\"><div class=\"readerProfileTopline\"><span>EL OBI DEL LECTOR / MI CUENTA</span><span class=\"readerProfileMark\" aria-hidden=\"true\">帯</span></div><div class=\"readerProfileIdentity\"><div class=\"readerProfileAvatar\" aria-hidden=\"true\">L</div><div class=\"readerProfileInfo\"><h1 id=\"readerProfileName\">Perfil de lector</h1><p>Tu próxima historia</p></div></div></section><nav class=\"readerProfileNav\" aria-label=\"Secciones de perfil\"><button type=\"button\" class=\"readerProfileNavItem active\" aria-current=\"page\">Mi actividad</button></nav><div class=\"readerEditLayout\"><div class=\"readerEditMain\"><div class=\"readerSettingsPanel\"><div class=\"readerEditCard\"><span class=\"readerEditStep\">01 / IDENTIDAD</span><h3>Información personal</h3><label for=\"profileName\">Nombre público</label><input id=\"profileName\" value=\"Lector de prueba\"></div></div></div></div></main>\n<main class=\"wrap publicReaderProfile\" id=\"publicReader\"><header class=\"publicReaderHero\"><div class=\"publicReaderBanner\"></div><div class=\"publicReaderKicker\">EL OBI DEL LECTOR / PERFIL PÚBLICO</div><div class=\"publicReaderIdentity\"><div class=\"publicReaderAvatar\">L</div><div><h1>Perfil público</h1><p>Biblioteca compartida</p></div></div></header><section class=\"publicReaderHighlights\"><div class=\"publicReaderStats\"><div><strong>4</strong><span>Obras compartidas</span></div></div></section><section class=\"publicReaderSection\"><div class=\"publicReaderSectionHeader\"><div><h2>Historias favoritas</h2></div></div><div class=\"publicReaderBooks\"><article class=\"publicReaderBook\"><button class=\"publicReaderBookButton\" type=\"button\">Ver obra</button></article></div></section></main>\n<main class=\"wrap teamPublicPage teamTheme-automatico\" id=\"teamPublic\" style=\"--team-accent:#a44888\"><section class=\"teamIdentityHero\"><div class=\"teamIdentityBanner\" style=\"background-color:#a44888\"><h1>Equipo traductor</h1></div></section><nav class=\"teamPublicNav\" aria-label=\"Secciones del equipo\"><a href=\"#teamWorks\">Traducciones</a><a href=\"#teamLatest\">Novedades</a></nav><div class=\"teamPublicOverview\"><div class=\"teamPublicStat\"><strong>3</strong><span>Obras publicadas</span></div><div class=\"teamPublicIntro\"><strong>Nuestro equipo</strong></div></div><section class=\"teamPublicSection\"><div class=\"sectionHead\"><h2>Traducciones</h2></div><div class=\"teamPublicLinks\"><a class=\"teamPublicLink\" href=\"#support\">Visitar publicaciones</a></div></section><nav class=\"teamSettingsNav\" role=\"tablist\" aria-label=\"Configuración del equipo\"><button class=\"teamSettingsTab active\" role=\"tab\" type=\"button\" aria-selected=\"true\" aria-controls=\"teamPanel-identity\">Identidad</button><button class=\"teamSettingsTab\" role=\"tab\" type=\"button\" aria-selected=\"false\" aria-controls=\"teamPanel-reader\">Lector</button></nav></main>\n<main class=\"wrap adminWorkspace\" id=\"admin\"><header class=\"adminWorkspaceHeader\"><div><span class=\"adminWorkspaceEyebrow\">EL OBI DEL LECTOR / ADMINISTRACIÓN GLOBAL</span><h1>Panel de administración</h1><p>Gestión de la plataforma</p></div><span class=\"adminAccessMark\">Acceso global</span></header><div class=\"adminWorkspaceLayout\"><aside class=\"adminWorkspaceSidebar\" aria-label=\"Navegación de administración\"><div class=\"adminSidebarTitle\"><span class=\"adminSidebarLogo\" aria-hidden=\"true\">帯</span><strong>Consola global</strong></div><nav><button class=\"adminSideLink isActive\" type=\"button\" aria-current=\"page\">Resumen</button><button class=\"adminSideLink\" type=\"button\">Equipos</button></nav></aside><section class=\"adminWorkspaceMain\"><div class=\"adminMobileNav\"><label for=\"adminTab\">Sección</label><select id=\"adminTab\"><option>Resumen</option></select></div><div class=\"adminCurrentHead\"><h2>Resumen general</h2></div><div class=\"adminWorkspaceContent\"><div class=\"adminGrid\"><div class=\"panel\"><h3>Solicitudes</h3><p>Sin incidencias</p></div></div></div></section></div></main>\n</body></html>";
let verified=0;
for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,1280]){
   const context=await browser.newContext({
    viewport:{width,height:860},reducedMotion:'reduce',serviceWorkers:'block'
   });
   await context.route('**/obi-workspaces-phase4-fixture',route=>route.fulfill({
    status:200,contentType:'text/html; charset=utf-8',body:fixture
   }));
   const page=await context.newPage();
   const errors=[];page.on('pageerror',err=>errors.push(String(err)));
   try{
    await page.goto('http://127.0.0.1:4173/obi-workspaces-phase4-fixture',{waitUntil:'load'});
    for(const theme of ['light','dark']){
     for(const id of ['studio','readerProfile','publicReader','teamPublic','admin']){
      const result=await page.evaluate(({id,dark})=>{
       document.body.classList.toggle('dark',dark);
       for(const el of document.querySelectorAll('main'))el.style.display=el.id===id?'':'none';
       const style=s=>getComputedStyle(document.querySelector(s));
       const computed=selector=>getComputedStyle(document.querySelector(selector));
       const visible=document.getElementById(id);
       return{
        viewport:document.documentElement.clientWidth,
        width:document.documentElement.scrollWidth,
        page:visible.id,
        mark:visible.querySelector('.studioV3BrandMark,.readerProfileMark,.adminSidebarLogo')?.textContent.trim()||null,
        rule:id==='studio'?computed('.studioV3PageHeading').borderBottomStyle:
             id==='admin'?computed('.adminWorkspaceHeader').borderBottomStyle:'solid',
        paper:id==='studio'?style('.studioV3Stat').backgroundColor:
              id==='readerProfile'?style('.readerEditCard').backgroundColor:
              id==='teamPublic'?style('.teamPublicStat').backgroundColor:
              id==='admin'?style('.adminWorkspaceSidebar').backgroundColor:
              style('.publicReaderStats>div').backgroundColor,
        teamBanner:style('.teamIdentityBanner').backgroundColor,
        focused:!!visible.querySelector('button[aria-current="page"],button[aria-selected="true"]'),
        tabRole:document.querySelector('.teamSettingsTab')?.getAttribute('role'),
        logoDecorative:visible.querySelector('.studioV3BrandMark,.readerProfileMark,.adminSidebarLogo')?.getAttribute('aria-hidden')||null,
        mobileSidebar:id==='admin'?style('.adminWorkspaceSidebar').display:null,
        metaColor:style('.readerProfileTopline').color
       };
      },{id,dark:theme==='dark'});
      assert.ok(result.width<=result.viewport+2,
       engineName+' '+width+' '+theme+' '+id+': desbordamiento '+result.width+'/'+result.viewport);
      assert.equal(result.page,id);
      if(['studio','readerProfile','admin'].includes(id)){
       assert.equal(result.mark,'帯');
       assert.equal(result.logoDecorative,'true');
      }
      if(['studio','admin'].includes(id))assert.equal(result.rule,'solid');
      if(id==='admin'&&width<=740)assert.equal(result.mobileSidebar,'none');
      if(id==='teamPublic')assert.equal(result.tabRole,'tab');
      assert.ok(result.paper.length>0);
      if(id!=='publicReader')assert.ok(result.focused,'Estado seleccionado: '+id);
      verified++;
     }
    }
    assert.deepEqual(errors,[],engineName+' JavaScript');
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}
console.log('OBI editorial workspaces phase 4:',JSON.stringify({scenarios:verified,failures:0}));
