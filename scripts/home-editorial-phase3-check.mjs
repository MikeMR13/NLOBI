import { chromium } from 'playwright';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('./full-quality-check.mjs',import.meta.url),'utf8');
const from=source.indexOf('const now='),to=source.indexOf('const viewports=');
if(from<0||to<=from)throw Error('No se pudieron extraer las muestras QA');
const {scenarios}=new Function(source.slice(from,to)+'\nreturn {scenarios};')();
const scenario=scenarios.find(([name])=>name==='public-home-carousel');
if(!scenario)throw Error('Falta muestra de portada destacada en Home');
const modes=[
 {label:'escritorio',width:1280,height:900,siteMotion:'system',osMotion:'no-preference'},
 {label:'movil',width:390,height:844,siteMotion:'system',osMotion:'no-preference'},
 {label:'movil-accesible',width:320,height:800,siteMotion:'reduce',osMotion:'reduce'},
 {label:'escritorio-accesible',width:1280,height:900,siteMotion:'reduce',osMotion:'reduce'}
];
const failures=[];
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
for(const config of modes){
 const context=await browser.newContext({
  viewport:{width:config.width,height:config.height},
  reducedMotion:config.osMotion,
  serviceWorkers:'block'
 });
 await context.addInitScript(settings=>{
  localStorage.setItem('nlobi_site_appearance',JSON.stringify({
   theme:'amber',mode:'light',scale:100,corners:'normal',motion:settings.siteMotion
  }));
 },config);
 await context.route('**/runtime-config.js',r=>r.fulfill({
  status:200,contentType:'application/javascript',
  body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"
 }));
 await context.route('https://qa.supabase.local/**',r=>r.fulfill({
  status:200,contentType:'application/json',body:'[]'
 }));
 await context.route('https://example.test/**',r=>r.fulfill({
  status:200,contentType:'image/png',
  body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZpTQAAAAASUVORK5CYII=','base64')
 }));
 const page=await context.newPage();
 const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__NLOBI_QA__,undefined,{timeout:16000});
  await page.evaluate(state=>{
   window.__NLOBI_QA__.setState(state);
   window.__NLOBI_QA__.setView('home');
  },scenario[2]);
  const sizes=await page.evaluate(()=>{
   const featured=document.querySelector('.homeFeaturedBook');
   const novel=document.querySelector('.homeNovelTile');
   const article=document.querySelector('.homeBookGrid .homeNovelTile');
   const cover=article?.querySelector('.homeBookCoverLink');
   const rect=article?.getBoundingClientRect();
   return {
    hasFeatured:!!featured,
    hasNovel:!!novel,
    hasCover:!!cover,
    articleWidth:rect?.width||0,
    articleHeight:rect?.height||0,
    featuredTransition:featured?getComputedStyle(featured).transitionDuration:'',
    cardTransition:cover?getComputedStyle(cover).transitionDuration:'',
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth,
    motionSetting:document.documentElement.dataset.siteMotion,
    errorView:document.body.innerText.includes('no pudo mostrar esta vista')
   };
  });
  if(!sizes.hasFeatured||!sizes.hasNovel||!sizes.hasCover||sizes.errorView||
     sizes.overflow>2||sizes.articleWidth<90||sizes.articleHeight<150){
   failures.push({config,error:'contenido o dimensiones invalidas',sizes});
  }
  if(sizes.motionSetting!==config.siteMotion)failures.push({config,error:'preferencia de movimiento ignorada',sizes});
  if(config.osMotion==='reduce'){
   const actual=await page.evaluate(()=>{
    const featured=document.querySelector('.homeFeaturedBook');
    const sections=[...document.querySelectorAll('.homeMotionPending')];
    return {transition:getComputedStyle(featured).transitionDuration,pending:sections.length};
   });
   if(actual.transition!=='0s'||actual.pending!==0)failures.push({config,error:'el movimiento reducido no se respeto',actual});
  }else{
   await page.locator('.homeBookGrid .homeBookCoverLink').first().hover();
   const after=await page.evaluate(()=>{
    const article=document.querySelector('.homeBookGrid .homeNovelTile');
    const rect=article?.getBoundingClientRect();
    return {width:rect?.width||0,height:rect?.height||0,
      overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth};
   });
   if(Math.abs(after.width-sizes.articleWidth)>1||after.overflow>2)failures.push({config,error:'microinteraccion causa cambio de ancho',before:sizes,after});
   await page.locator('.homeShowcase').scrollIntoViewIfNeeded();
   const root=page.locator('[data-home-featured]');
   await root.locator('[data-featured-step="1"]').click();
   const cover=await root.locator('.homeFeaturedCoverLink').getAttribute('href');
   if(!cover?.includes('#detail:'))failures.push({config,error:'enlace de obra destacada roto'});
   await page.evaluate(()=>window.scrollTo(0,document.documentElement.scrollHeight));
   await page.waitForTimeout(520);
   const below=await page.evaluate(()=>({
    hidden:[...document.querySelectorAll('.homeMotionPending')].filter(x=>{
     const r=x.getBoundingClientRect();
     return r.bottom>0&&r.top<innerHeight&&!x.classList.contains('homeMotionShown');
    }).length,
    overflow:document.documentElement.scrollWidth-document.documentElement.clientWidth
   }));
   if(below.hidden||below.overflow>2)failures.push({config,error:'seccion visible oculta tras scroll',below});
  }
 }catch(error){failures.push({config,error:String(error)})}
 finally{
  if(errors.length)failures.push({config,error:'errores javascript',messages:errors.slice(0,5)});
  await context.close();
 }
}
await browser.close();
console.log('Home fase 3 microinteracciones:',JSON.stringify({modes:modes.length,failures:failures.length}));
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1)}
