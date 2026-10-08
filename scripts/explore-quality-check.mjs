import { chromium, webkit } from 'playwright';
const failures=[];
for(const [browserName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 for(const width of [320,390,430,768,1280]){
  const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
  await context.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
  await context.route('https://qa.supabase.local/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
  const page=await context.newPage();
  try{
   await page.goto('http://127.0.0.1:4173/#explore',{waitUntil:'networkidle'});
   await page.waitForSelector('#exploreTitle');
   await page.locator('[data-explore-view="list"]').click();
   if(!await page.locator('.exploreNovelGrid.exploreListView').count())throw Error('Vista lista ausente');
   await page.reload({waitUntil:'networkidle'});
   if(!await page.locator('.exploreNovelGrid.exploreListView').count())throw Error('Preferencia de vista no persistente');
   await page.locator('[data-explore-view="grid"]').click();
   if(await page.locator('.exploreNovelGrid.exploreListView').count())throw Error('No vuelve a portadas');
   const filters=page.locator('#exploreFilters');
   await filters.locator(':scope > summary').click();
   if(!await filters.evaluate(e=>e.open))throw Error('Filtros no abren');
   await page.locator('#catalogStatus').selectOption('complete');
   if(!await page.locator('[data-clear-explore="searchStatus"]').count())throw Error('Filtro activo no visible');
   await page.locator('[data-clear-explore="searchStatus"]').click();
   if(await page.locator('[data-clear-explore="searchStatus"]').count())throw Error('No elimina filtro');
   if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Desbordamiento horizontal');
  }catch(e){failures.push({browser:browserName,width,error:String(e)})}
  await context.close();
 }
 await browser.close();
}
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1)}
console.log('Explore mobile E2E OK: both engines, 5 viewports, list/grid persistence, filters, no overflow');
