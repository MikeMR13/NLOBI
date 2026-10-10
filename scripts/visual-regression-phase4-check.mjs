import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

// Phase 4: visual regression matrix covering theme, mode, font scale, breakpoint,
// and both collapsed/expanded navigation states without affecting production.
const themes=['amber','indigo','forest','wine','ocean','graphite'];
const modes=['light','dark'];
const scales=[90,100,110,120,135];
const viewports=[{name:'mobile',width:320,height:800},{name:'tablet',width:820,height:1024},{name:'desktop',width:1280,height:900}];
const results=[],failures=[],screenshots=[];
const snapshots=path.resolve('visual-results','phase4-snapshots');
fs.mkdirSync(snapshots,{recursive:true});

function luminosity(rgb){
 const srgb=rgb.map(n=>{const c=n/255;return c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4});
 return .2126*srgb[0]+.7152*srgb[1]+.0722*srgb[2];
}
function parseRgb(value){
 const match=String(value).match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
 return match?[+match[1],+match[2],+match[3]]:null;
}
function contrast(foreground,background){
 const a=parseRgb(foreground),b=parseRgb(background);
 if(!a||!b)return null;
 const high=Math.max(luminosity(a),luminosity(b)),low=Math.min(luminosity(a),luminosity(b));
 return (high+.05)/(low+.05);
}
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
for(const theme of themes){
 for(const mode of modes){
  for(const scale of scales){
   const ctx=await browser.newContext({viewport:{width:320,height:800},serviceWorkers:'block',reducedMotion:'reduce'});
   await ctx.addInitScript(pref=>{
    localStorage.setItem('nlobi_site_appearance',JSON.stringify(pref));
   },{theme,mode,scale,contrast:'normal',density:'normal',corners:'normal'});
   await ctx.route('**/runtime-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',
    body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
   await ctx.route('https://qa.supabase.local/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
   const page=await ctx.newPage();const errors=[];
   page.on('pageerror',error=>errors.push(error.message));
   try{
    await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded',timeout:12000});
    await page.waitForFunction(()=>!!window.__NLOBI_QA__,null,{timeout:12000});
    await page.evaluate(()=>window.__NLOBI_QA__.setState({
     user:{id:'phase4-reader',email:'qa@example.test'},profile:{id:'phase4-reader',display_name:'QA Lector'},notes:[],admin:true
    }));
    for(const viewport of viewports){
     await page.setViewportSize({width:viewport.width,height:viewport.height});
     await page.evaluate(()=>window.scrollTo(0,0));
     const key={theme,mode,scale,viewport:viewport.name};
     const closed=await page.evaluate(()=>{
      const root=document.documentElement,brand=document.querySelector('.top .brand'),
       bar=document.querySelector('.top .bar'),menu=document.querySelector('.mobileNav');
      const rect=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {width:r.width,height:r.height,x:r.x,y:r.y}};
      return {overflow:root.scrollWidth-root.clientWidth,theme:root.dataset.siteTheme,
       mode:document.body.classList.contains('dark')?'dark':'light',
       fontPx:parseFloat(getComputedStyle(root).fontSize),bar:rect(bar),brand:rect(brand),
       mobileMenuVisible:getComputedStyle(menu).display!=='none',
       mobileOpen:menu.open,main:document.querySelector('main')?.innerText.length||0};
     });
     let open=null,closedAgain=null;
     if(closed.overflow>2)failures.push({...key,state:'closed',error:'horizontal overflow',px:closed.overflow});
     if(closed.theme!==theme||closed.mode!==mode)failures.push({...key,error:'appearance preference mismatch',closed});
     if(Math.abs(closed.fontPx-(16*scale/100))>.6)failures.push({...key,error:'font scaling mismatch',fontPx:closed.fontPx});
     if(!closed.brand||closed.brand.width<60||closed.main<30)failures.push({...key,error:'missing content or brand',closed});
     if(viewport.width<=1100){
      if(!closed.mobileMenuVisible||closed.bar.height>95)failures.push({...key,error:'incorrect responsive header',closed});
      await page.locator('.mobileNav > summary').click();
      await page.waitForFunction(()=>document.body.classList.contains('mobileNavOpen'),null,{timeout:3000});
      open=await page.evaluate(()=>{
       const menu=document.querySelector('.mobileNav'),panel=document.querySelector('.mobileNavPanel'),
        toggle=menu.querySelector(':scope > summary'),active=panel.querySelector('.navLink.active'),
        action=panel.querySelector('#installPwaMobile'),close=panel.querySelector('.mobileNavClose');
       const rect=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};
       const colors=el=>{if(!el)return null;const c=getComputedStyle(el);return {fg:c.color,bg:c.backgroundColor}};
       return {dialog:rect(panel),toggle:rect(toggle),active:rect(active),close:rect(close),
        open:menu.open,expanded:toggle.getAttribute('aria-expanded'),
        locked:document.body.style.position==='fixed',backdropVisible:getComputedStyle(document.querySelector('.mobileNavBackdrop')).display!=='none',
        activeColors:colors(active),toggleColors:colors(toggle),actionColors:colors(action),action:rect(action),
        theme:document.documentElement.dataset.siteTheme,
        navLinks:[...panel.querySelectorAll('#nlobiMobileMenu .navLink')].filter(el=>el.getClientRects().length).length
       };
      });
      if(!open.open||open.expanded!=='true'||!open.locked||!open.backdropVisible)failures.push({...key,state:'open',error:'modal state and scroll lock',open});
      if(!open.dialog||open.dialog.x<0||open.dialog.right>viewport.width+2||open.dialog.bottom>viewport.height+2)failures.push({...key,state:'open',error:'panel outside viewport',dialog:open.dialog});
      if(open.navLinks<5)failures.push({...key,state:'open',error:'navigation links missing',open});
      for(const [label,colors] of Object.entries({menu:open.toggleColors,active:open.activeColors,install:open.actionColors})){
       if(!colors)continue;
       const r=contrast(colors.fg,colors.bg);
       if(r!==null&&r<4.5)failures.push({...key,state:'open',error:label+' contrast too low',ratio:+r.toFixed(2)});
      }
      const snapshot=(scale===100 && mode==='dark' && ((theme==='graphite'&&viewport.name==='mobile')||(theme==='indigo'&&viewport.name==='tablet')));
      if(snapshot){
       const name=theme+'-'+viewport.name+'-menu-open.png';
       await page.screenshot({path:path.join(snapshots,name),animations:'disabled'});
       screenshots.push(name);
      }
      await page.keyboard.press('Escape');
      closedAgain=await page.evaluate(()=>({
       open:document.querySelector('.mobileNav').open,
       expanded:document.querySelector('.mobileNav>summary').getAttribute('aria-expanded'),
       lock:document.body.style.position==='fixed',
       focused:document.activeElement===document.querySelector('.mobileNav>summary')
      }));
      if(closedAgain.open||closedAgain.expanded!=='false'||closedAgain.lock||!closedAgain.focused)failures.push({...key,state:'dismissed',error:'Escape failed to restore menu state',closedAgain});
     }else{
      if(closed.mobileMenuVisible||closed.bar.height>180)failures.push({...key,error:'desktop header regression',closed});
      if(scale===100&&mode==='light'&&theme==='amber'){
       const name='amber-desktop.png';await page.screenshot({path:path.join(snapshots,name),animations:'disabled'});screenshots.push(name);
      }
     }
     if(errors.length)failures.push({...key,error:'browser exception',messages:[...errors]});
     results.push({...key,collapsed:closed,expanded:open,dismissed:closedAgain});
    }
   }catch(error){
    failures.push({theme,mode,scale,error:String(error)});
   }finally{await ctx.close()}
  }
 }
}
await browser.close();
const report={timestamp:new Date().toISOString(),matrix:{themes:themes.length,modes:modes.length,scales:scales.length,viewports:viewports.length},
 inspected:results.length,expanded:results.filter(x=>!!x.expanded).length,failures,screenshots};
fs.writeFileSync(path.resolve('visual-results','phase4-appearance-matrix.json'),JSON.stringify(report,null,2));
console.log('Phase 4 visual matrix:',JSON.stringify({inspected:report.inspected,expanded:report.expanded,failures:failures.length,screenshots:screenshots.length}));
if(failures.length){console.error(JSON.stringify(failures.slice(0,35),null,2));process.exitCode=1}
