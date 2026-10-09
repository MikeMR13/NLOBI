import { chromium, webkit } from 'playwright';

const base='http://127.0.0.1:4173/';
const api='https://qa.supabase.local';
const novel={id:'test-book',title:'Libro de prueba',status:'active',language_code:'es',updated_at:new Date().toISOString(),novels:{id:'book',title:'Libro de prueba',synopsis:'Novela de prueba',cover_url:null,genres:['Fantasía'],tags:[]},translator_groups:{id:'team',name:'Equipo de prueba'}};
const failures=[];
for(const [name,type] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await type.launch({headless:true});
 for(const width of [320,375,390,430]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await context.route('**/runtime-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'"+api+"',supabasePublishableKey:'qa',qaMode:true};"}));
  await context.route(api+'/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const page=await context.newPage();
  try{
   await page.goto(base+'#home',{waitUntil:'networkidle'});
   await page.waitForFunction(()=>window.__NLOBI_QA__&&document.querySelector('.mobileNav'));
   // The first-paint hero heading must retain DOM identity as the catalog finishes loading.
   await page.evaluate(n=>{
    const qa=window.__NLOBI_QA__;
    qa.setState({catalog:[n],catalogLoaded:false,catalogLoading:true});
    const firstHeading=document.querySelector('.homeShowcaseCopy h1');
    qa.setState({catalog:[n],catalogLoaded:true,catalogLoading:false});
    if(!firstHeading||document.querySelector('.homeShowcaseCopy h1')!==firstHeading)throw Error('LCP: título reemplazado durante la carga');
   },novel);
   await page.evaluate(n=>window.__NLOBI_QA__.setState({catalog:[n],catalogLoaded:true,catalogLoading:false}),novel);
   const menu=page.locator('.mobileNav');
   await menu.locator(':scope > summary').click();
   if(!await menu.evaluate(el=>el.open))throw Error('Menú no abre');
   if(!await page.locator('#nlobiMobileMenu a[data-v="explore"]').isVisible())throw Error('Enlaces del menú invisibles');
   await menu.locator(':scope > summary').click();
   if(await menu.evaluate(el=>el.open))throw Error('Menú no cierra');
   const initial=await page.locator('body').evaluate(el=>el.classList.contains('dark'));
   await page.locator('#themeMobileQuick').click();
   const toggled=await page.locator('body').evaluate(el=>el.classList.contains('dark'));
   if(toggled===initial)throw Error('Control de tema no cambia el modo');
   await page.locator('a.catalogCoverButton').first().click();
   await page.waitForURL(/#detail:test-book/);
   await page.goto(base+'#home',{waitUntil:'networkidle'});
   await page.evaluate(n=>window.__NLOBI_QA__.setState({catalog:[n],catalogLoaded:true,catalogLoading:false}),novel);
   await page.locator('a.catalogTitleLink').first().click();
   await page.waitForURL(/#detail:test-book/);
  }catch(e){failures.push({browser:name,width,error:String(e)})}
  await context.close();
 }
 await browser.close();
}
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1)}
console.log('Mobile interactions OK: Chromium + WebKit; menu, theme, cover, title at 320/375/390/430px');
