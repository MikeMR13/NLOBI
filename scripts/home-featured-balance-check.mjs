import {chromium,webkit} from 'playwright';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./full-quality-check.mjs',import.meta.url),'utf8');
const begin=source.indexOf('const now='),end=source.indexOf('const viewports=');
if(begin<0||end<=begin)throw Error('Faltan datos QA de novelas');
const {scenarios}=new Function(source.slice(begin,end)+'\nreturn {scenarios};')();
const scenario=scenarios.find(row=>row[0]==='public-home-carousel');
if(!scenario)throw Error('Falta escenario de carrusel destacado');
const cases=[
 {width:320,height:812,label:'320',motion:'reduce'},
 {width:390,height:844,label:'390',motion:'system'},
 {width:768,height:1024,label:'768',motion:'system'},
 {width:1185,height:780,label:'1185',motion:'system'}
];
const failures=[],results=[];
fs.mkdirSync('visual-results/home-featured', {recursive:true});
for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch(engineName==='Chromium'?{headless:true,args:['--no-sandbox']}:{headless:true});
 for(const test of cases){
  const context=await browser.newContext({viewport:{width:test.width,height:test.height},
   reducedMotion:test.motion==='reduce'?'reduce':'no-preference',serviceWorkers:'block'});
  await context.addInitScript(motion=>localStorage.setItem('nlobi_site_appearance',
   JSON.stringify({theme:'amber',mode:'dark',scale:100,density:'normal',corners:'normal',motion})),test.motion);
  await context.route('**/runtime-config.js',route=>route.fulfill({status:200,
   contentType:'application/javascript',
   body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
  await context.route('https://qa.supabase.local/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
  await context.route('https://example.test/**',route=>route.fulfill({status:200,contentType:'image/png',
   body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZpTQAAAAASUVORK5CYII=','base64')}));
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.__NLOBI_QA__,undefined,{timeout:16000});
   await page.evaluate(data=>{
    window.__NLOBI_QA__.setState(data);
    window.__NLOBI_QA__.setView('home');
   },scenario[2]);
   const measure=()=>page.evaluate(()=>{
    const root=document.querySelector('[data-home-featured]');
    const book=root?.querySelector('.homeFeaturedBook');
    const title=root?.querySelector('.homeFeaturedSlideInfo h2');
    const cover=root?.querySelector('.homeFeaturedVisual');
    const info=root?.querySelector('.homeFeaturedInfo');
    const r=el=>{const b=el?.getBoundingClientRect();return b&&{x:b.left,y:b.top,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};
    return {card:r(root),cover:r(book),visual:r(cover),info:r(info),title:r(title),
      fullTitle:title?.textContent||'',titleClipped:!!title&&title.scrollHeight>title.clientHeight+2,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
      arrows:[...root.querySelectorAll('[data-featured-step]')].map(x=>r(x)),
      active:root.querySelector('[data-featured-count]')?.textContent
    };
   });
   const before=await measure();
   const desktop=test.width>=641;
   if(before.overflow>2)failures.push({engineName,label:test.label,error:'desbordamiento',before});
   if(before.titleClipped)failures.push({engineName,label:test.label,error:'título recortado',before});
   if(!before.cover||!before.title||!before.card||!before.visual)failures.push({engineName,label:test.label,error:'falta contenido',before});
   if(before.cover?.right>before.visual?.right+2||before.cover?.bottom>before.visual?.bottom+2)
    failures.push({engineName,label:test.label,error:'portada cortada',before});
   if(desktop&&!(before.visual.right<=before.info.x+2&&before.card.h<=530&&before.cover.w<=198))
    failures.push({engineName,label:test.label,error:'escritorio sin dos columnas o tamaños excesivos',before});
   if(!desktop&&!(before.visual.bottom<=before.info.y+2&&before.card.h<=680&&before.cover.w<=125))
    failures.push({engineName,label:test.label,error:'tamaño móvil excesivo',before});
   if(before.arrows.some(x=>!x||x.h<43||x.w<43))
    failures.push({engineName,label:test.label,error:'controles pequeños',before});
   if(engineName==='Chromium'&&(test.width===390||test.width===1185)){
    await page.locator('[data-home-featured]').screenshot({path:'visual-results/home-featured/'+test.label+'.png',animations:'disabled'});
   }
   await page.locator('[data-featured-step="1"]').click();
   const after=await measure();
   if(after.fullTitle===before.fullTitle||after.titleClipped||after.overflow>2||Math.abs(after.card.h-before.card.h)>2)
    failures.push({engineName,label:test.label,error:'cambio de novela provoca salto o título recortado',before:{height:before.card?.h,title:before.fullTitle},after:{height:after.card?.h,title:after.fullTitle,overflow:after.overflow}});
   await page.locator('[data-featured-step="-1"]').click();
   const restored=await measure();
   if(restored.fullTitle!==before.fullTitle)failures.push({engineName,label:test.label,error:'la flecha anterior no restaura novela'});
   if(errors.length)failures.push({engineName,label:test.label,error:'errores JS',errors});
   results.push({engine:engineName,width:test.width,cardHeight:before.card?.h,coverWidth:before.cover?.w,coverHeight:before.cover?.h,titleClipped:before.titleClipped});
  }catch(error){failures.push({engineName,label:test.label,error:String(error)})}
  finally{await context.close()}
 }
 await browser.close();
}
fs.writeFileSync('visual-results/home-featured/report.json',JSON.stringify({results,failures},null,2));
console.log('Featured carousel sizing and motion:',JSON.stringify({tested:results.length,failures:failures.length,results}));
if(failures.length){console.error(JSON.stringify(failures.slice(0,12),null,2));process.exit(1)}
