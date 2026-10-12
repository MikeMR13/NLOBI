import {chromium,webkit} from 'playwright';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./full-quality-check.mjs',import.meta.url),'utf8');
const start=source.indexOf('const now='),end=source.indexOf('const viewports=');
if(start<0||end<=start)throw Error('Fixtures de QA no disponibles');
const {scenarios}=new Function(source.slice(start,end)+'\nreturn {scenarios};')();
const fixture=scenarios.find(([name])=>name==='public-reader');
if(!fixture?.[2]?.readerSection)throw Error('Fixture del lector incompleto');
const css=fs.readFileSync('src/styles.css','utf8'),app=fs.readFileSync('src/app.js','utf8');
for(const term of ['readerPresentation-editorial','readerPresentation-editorial.readerFocused','prefers-reduced-motion:reduce','--reader-paper-shadow']){
 if(!css.includes(term))throw Error('Falta CSS del lector: '+term);
}
for(const term of ["presentation:'classic'","presentation:['classic','editorial']","data-reader-quick=\"presentation\"","readerSettingsFields('volume',volume,['mode','presentation','theme','fontSize'])"]){
 if(!app.includes(term))throw Error('La configuración del lector no incluye '+term);
}
const failures=[];
let evaluated=0;
for(const [browserName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 for(const [width,theme,motion] of [[320,'light','reduce'],[390,'sepia','system'],[768,'dark','system'],[1280,'light','system']]){
  const context=await browser.newContext({viewport:{width,height:850},serviceWorkers:'block',reducedMotion:motion==='reduce'?'reduce':'no-preference'});
  await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
  await context.route('https://qa.supabase.local/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.__NLOBI_QA__&&document.querySelector('#siteStyles')?.media==='all',undefined,{timeout:15000});
   for(const mode of ['chapter','continuous']){
    await page.evaluate(({fixture,mode,theme})=>{
     localStorage.setItem('nlobi_reader_focus','0');
     localStorage.setItem('nlobi_reader_settings_guest',JSON.stringify({
      global:{theme,presentation:'classic',fontFamily:'original'},mode,explicitMode:true,volumes:{},positions:{}
     }));
     window.__NLOBI_QA__.setState({
      ...fixture,readerSection:fixture.readerSection,readerPrefs:{theme,fontSize:18,width:'normal',lineHeight:'comfortable',
       fontFamily:'original',paragraphSpace:'normal',indent:'none',align:'left',contrast:'standard',images:'show',presentation:'classic'},
      readerContinuous:null
     });
     window.__NLOBI_QA__.setView('reader:section-1');
    },{fixture:fixture[2],mode,theme});
    await page.waitForSelector('.readerExperience.readerPresentation-classic .readerPaper');
    const before=await page.evaluate(()=>{
      const paper=document.querySelector('.readerPaper');
      return {markup:paper?.querySelector('#readerContinuousChapters')?.innerHTML||paper?.innerHTML,
       family:getComputedStyle(paper).fontFamily,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth)};
    });
    const actualContinuous=await page.locator('#readerContinuousChapters').count();
    if(actualContinuous!==(mode==='continuous'?1:0))throw Error('Modo '+mode+' alterado: '+actualContinuous);
    if(before.overflow>2)throw Error('Desbordamiento lector inicial: '+before.overflow);
    await page.locator('#readerSettings > summary').click();
    await page.locator('[data-reader-quick="presentation"][data-reader-value="editorial"]').click();
    await page.waitForSelector('.readerExperience.readerPresentation-editorial');
    const after=await page.evaluate(()=>{
      const root=document.querySelector('.readerExperience'),paper=document.querySelector('.readerPaper');
      const style=getComputedStyle(paper),data=JSON.parse(localStorage.getItem('nlobi_reader_settings_guest')||'{}');
      return {markup:paper?.querySelector('#readerContinuousChapters')?.innerHTML||paper?.innerHTML,
       family:style.fontFamily,background:style.backgroundImage,border:style.borderTopWidth,
       saved:data.volumes?.['volume-1']?.presentation,overflow:Math.max(0,document.documentElement.scrollWidth-innerWidth),
       focus:root?.classList.contains('readerFocused')};
    });
    evaluated++;
    if(after.saved!=='editorial'||!after.background.includes('gradient')||parseFloat(after.border)<1||
       before.family!==after.family||before.markup!==after.markup||after.overflow>2||after.focus){
      failures.push({browserName,width,mode,error:'Presentación no preserva contenido o preferencias',
       saved:after.saved,markupEqual:before.markup===after.markup,fontEqual:before.family===after.family,
       border:after.border,overflow:after.overflow});
    }
    await page.locator('#readerFocusToggle').click();
    if(!await page.locator('.readerExperience.readerFocused').count()||
       !await page.locator('.readerFocusExit').isVisible())throw Error('Se perdió modo enfoque');
    const focus=await page.locator('.readerPaper').evaluate(e=>({background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderTopWidth}));
    if(parseFloat(focus.border)!==0)throw Error('El enfoque muestra marco editorial');
    await page.locator('#readerFocusExit').click();
    if(await page.locator('.readerExperience.readerFocused').count())throw Error('Enfoque no se desactiva');
    await page.locator('#readerSettings > summary').click();
    await page.locator('[data-reader-quick="presentation"][data-reader-value="classic"]').click();
    await page.waitForSelector('.readerExperience.readerPresentation-classic');
    if((await page.locator('#readerContinuousChapters').count())!==actualContinuous)throw Error('El modo de lectura cambió al restaurar Clásico');
   }
   if(errors.length)failures.push({browserName,width,errors:errors.slice(0,4)});
  }catch(e){failures.push({browserName,width,error:String(e)})}
  finally{await context.close()}
 }
 await browser.close();
}
console.log('Global reader phase 4',JSON.stringify({cases:evaluated,failures:failures.length}));
if(failures.length){console.error(JSON.stringify(failures.slice(0,22),null,2));process.exit(1)}
