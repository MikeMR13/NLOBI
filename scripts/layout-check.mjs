import { chromium } from 'playwright';
import fs from 'node:fs';

const base='http://127.0.0.1:4173/';
const routes=['#home','#explore','#library','#auth','#detail:demo-netoge','#collection:popular'];
const viewports=[
  {name:'mobile-320',width:320,height:900},
  {name:'mobile-390',width:390,height:900},
  {name:'tablet-768',width:768,height:1024},
  {name:'desktop-1280',width:1280,height:900}
];

fs.mkdirSync('visual-results',{recursive:true});
const browser=await chromium.launch({headless:true});
const issues=[];

for(const vp of viewports){
  for(const route of routes){
    const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},colorScheme:'light'});
    const page=await context.newPage();
    await page.goto(base+route,{waitUntil:'networkidle'});
    await page.waitForTimeout(150);
    const result=await page.evaluate(()=>{
      const root=document.documentElement;
      const overflow=root.scrollWidth-root.clientWidth;
      const visible=[...document.querySelectorAll('main button,main a,main input,main select,main textarea')]
        .filter(el=>{
          const r=el.getBoundingClientRect(),cs=getComputedStyle(el);
          return cs.display!=='none'&&cs.visibility!=='hidden'&&r.width>0&&r.height>0;
        });
      const clipped=visible.map(el=>{
        const r=el.getBoundingClientRect();
        return {tag:el.tagName,text:(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,80),left:r.left,right:r.right,width:r.width};
      }).filter(x=>x.left<-2||x.right>root.clientWidth+2);
      const tiny=visible.map(el=>{
        const r=el.getBoundingClientRect();
        return {tag:el.tagName,text:(el.textContent||el.getAttribute('aria-label')||'').trim().slice(0,80),width:r.width,height:r.height};
      }).filter(x=>['BUTTON','A','SELECT'].includes(x.tag)&&(x.width<40||x.height<40));
      return {overflow,clipped,tiny,title:document.title};
    });
    if(result.overflow>2)issues.push({route,viewport:vp.name,type:'horizontal-overflow',detail:result.overflow});
    if(result.clipped.length)issues.push({route,viewport:vp.name,type:'clipped-controls',detail:result.clipped.slice(0,8)});
    if(result.tiny.length)issues.push({route,viewport:vp.name,type:'small-targets',detail:result.tiny.slice(0,8)});
    if(vp.name==='mobile-390'||vp.name==='desktop-1280'){
      const safe=route.slice(1).replace(/[^a-z0-9]+/gi,'-');
      await page.screenshot({path:`visual-results/${vp.name}-${safe}.png`,fullPage:true});
    }
    await context.close();
  }
}

// Dark mode smoke check at representative desktop/mobile routes.
for(const vp of [viewports[1],viewports[3]]){
  const context=await browser.newContext({viewport:{width:vp.width,height:vp.height},colorScheme:'dark'});
  const page=await context.newPage();
  await page.goto(base+'#home',{waitUntil:'networkidle'});
  await page.evaluate(()=>document.body.classList.add('dark'));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
  if(overflow>2)issues.push({route:'#home-dark',viewport:vp.name,type:'horizontal-overflow',detail:overflow});
  await page.screenshot({path:`visual-results/${vp.name}-home-dark.png`,fullPage:true});
  await context.close();
}

await browser.close();
fs.writeFileSync('visual-results/layout-report.json',JSON.stringify({issues},null,2));
if(issues.length){
  console.error(JSON.stringify(issues,null,2));
  process.exit(1);
}
console.log('Visual layout QA OK');
