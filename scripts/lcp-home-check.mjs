import {chromium} from 'playwright';

// Delaying the API must never delay or remount the largest above-the-fold heading.
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
const page=await context.newPage();
try{
 await page.route('**/rest/v1/**',async route=>{
  await new Promise(resolve=>setTimeout(resolve,1000));
  await route.continue();
 });
 await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
 const title=page.locator('main.homeEditorial .homeShowcaseCopy h1');
 await title.waitFor({timeout:6000});
 if(!(await title.innerText()).includes('Abre un libro.'))throw new Error('El encabezado del inicio no aparece durante la carga.');
 await page.evaluate(()=>{window.__nlobiFirstHero=document.querySelector('main.homeEditorial .homeShowcaseCopy h1')});
 if(!await page.locator('main.homeEditorial[aria-busy="true"]').count())throw new Error('El título se mostró solamente después de cargar los datos.');
 await page.waitForFunction(()=>{
  const main=document.querySelector('main.homeEditorial');
  return !!main&&!main.hasAttribute('aria-busy');
 },null,{timeout:20000});
 const stable=await page.evaluate(()=>window.__nlobiFirstHero===document.querySelector('main.homeEditorial .homeShowcaseCopy h1'));
 if(!stable)throw new Error('La hidratación reemplazó el H1, retrasando el LCP.');
 if(await page.locator('main.homeEditorial .homeFeaturedLoading').count())throw new Error('La portada sigue en carga tras hidratar.');
 console.log('Home LCP hydration OK: hero visible during slow API and H1 retained after catalog load.');
}finally{await browser.close()}
