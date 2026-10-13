import {chromium} from 'playwright';
const browser=await chromium.launch({headless:true});
for(const id of ['1ed25d06-436c-49bd-8972-3150f94a3648','8ca0311f-77d8-4efe-a024-c1e2caf2e07b']){
 const page=await browser.newPage({serviceWorkers:'block'});
 await page.goto('https://nlobi.vercel.app/#reader:'+id,{waitUntil:'domcontentloaded'});
 await page.locator('#chapterTitle').waitFor({timeout:30000});
 await page.waitForTimeout(3500);
 const x=await page.evaluate(()=>{
  const a=document.querySelector('#chapterTitle'),p=document.querySelector('.readerPaper'),b=document.querySelector('.readerHeading');
  return {attr:a?.getAttribute('data-epub-family'),font:a&&getComputedStyle(a).fontFamily,classes:p?.className,body:b&&getComputedStyle(b).fontFamily,faces:[...document.fonts].filter(f=>f.family.includes('NLOBI')).map(f=>({family:f.family,status:f.status}))};
 });
 console.log('LIVE FONT '+id+' '+JSON.stringify(x));
 await page.close();
}
await browser.close();
