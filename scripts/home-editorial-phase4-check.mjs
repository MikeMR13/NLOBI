import { chromium, webkit } from 'playwright';
import fs from 'node:fs';

const fixture=fs.readFileSync(new URL('./full-quality-check.mjs',import.meta.url),'utf8');
const from=fixture.indexOf('const now='),to=fixture.indexOf('const viewports=');
if(from<0||to<=from)throw Error('Faltan muestras de novela del proyecto');
const {scenarios}=new Function(fixture.slice(from,to)+'\nreturn {scenarios};')();
const original=scenarios.find(([name])=>name==='public-home')?.[2]?.catalog?.[0];
if(!original)throw Error('Falta muestra pública de novela');

const titles=[
 'La novela ligera con un título extremadamente largo para probar el ancho y las tarjetas',
 'Romance', 'La magia de los libros', 'Entre páginas y sueños',
 'Crónicas de la biblioteca', 'Una segunda oportunidad', 'Aventura fantástica', 'El último capítulo'
];
const books=titles.map((title,i)=>({
 ...original,id:'home4-book-'+i,title,status:i===4?'complete':'active',
 popularity_score:100-i,
 updated_at:new Date(Date.now()-i*3600000).toISOString(),
 novels:{...original.novels,id:'home4-novel-'+i,title,
  cover_url:i%3===0?'https://example.test/book-'+i+'.png':null,
  genres:i===0?['Romance','Comedia']:['Fantasía','Aventura']},
 latestPublishedVolume:i===0?{volume_number:3,published_at:new Date().toISOString()}:null
}));
const volume={id:'home4-volume-new',translation_id:books[0].id,
 volume_number:3,title:'El volumen que llegó hoy',
 published_at:new Date().toISOString(),status:'published',cover_url:null};
const tests=[
 {name:'telefono-320',width:320,height:800,theme:'graphite',mode:'dark',scale:135,density:'compact',corners:'soft',motion:'reduce'},
 {name:'telefono-375',width:375,height:812,theme:'amber',mode:'light',scale:100,density:'normal',corners:'normal',motion:'system'},
 {name:'telefono-390',width:390,height:844,theme:'amber',mode:'light',scale:100,density:'normal',corners:'normal',motion:'system'},
 {name:'telefono-430',width:430,height:932,theme:'graphite',mode:'dark',scale:120,density:'comfortable',corners:'soft',motion:'system'},
 {name:'tableta-768',width:768,height:1024,theme:'forest',mode:'dark',scale:135,density:'comfortable',corners:'square',motion:'reduce'},
 {name:'tableta-1024',width:1024,height:768,theme:'amber',mode:'light',scale:110,density:'normal',corners:'normal',motion:'system'},
 {name:'escritorio-1280',width:1280,height:900,theme:'amber',mode:'dark',scale:100,density:'normal',corners:'normal',motion:'system'},
 {name:'escritorio-1440',width:1440,height:900,theme:'graphite',mode:'light',scale:135,density:'comfortable',corners:'square',motion:'reduce'}
];
const results=[],failures=[];
const snapDir='visual-results/home-phase4';
fs.mkdirSync(snapDir,{recursive:true});
for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch(engineName==='Chromium'?{headless:true,args:['--no-sandbox']}:{headless:true});
 for(const config of tests.filter(x=>engineName==='Chromium'||['telefono-320','telefono-390','tableta-768'].includes(x.name))){
  const context=await browser.newContext({
   viewport:{width:config.width,height:config.height},
   serviceWorkers:'block',
   reducedMotion:config.motion==='reduce'?'reduce':'no-preference'
  });
  await context.addInitScript(settings=>{
   localStorage.setItem('nlobi_site_appearance',JSON.stringify({
    theme:settings.theme,mode:settings.mode,scale:settings.scale,
    density:settings.density,corners:settings.corners,motion:settings.motion
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
  const page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
   await page.waitForFunction(()=>!!window.__NLOBI_QA__,undefined,{timeout:16000});
   await page.evaluate(data=>{
    window.__NLOBI_QA__.setState({
     catalog:data.books,catalogLoaded:true,catalogLoading:false,
     publishedVolumes:[data.volume],publishedSections:[]
    });
    window.__NLOBI_QA__.setView('home');
   },{books,volume});
   await page.waitForFunction(()=>document.querySelectorAll('.discoverShelfTrack .homeNovelTile').length>=8);
   // La hoja de estilos se activa de forma diferida; WebKit puede pintar el HTML
   // antes de que aplique la escala del usuario. Exigimos el tamaño real.
   await page.waitForFunction(expected=>
    Math.abs(parseFloat(getComputedStyle(document.documentElement).fontSize)-expected)<.7,
    16*config.scale/100,{timeout:8000});
   const measurement=await page.evaluate(()=>{
    const root=document.documentElement,main=document.querySelector('main.homeEditorial');
    const rect=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {x:r.left,right:r.right,y:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    const hero=rect(main?.querySelector('.homeShowcase'));
    const tiles=[...main.querySelectorAll('.homeNovelTile')];
    const covers=tiles.map(tile=>{
      const el=tile.querySelector('.catalogCoverButton,.homeBookCoverLink');
      const r=rect(el);return r&&{width:r.width,height:r.height,ratio:r.height/r.width};
    }).filter(Boolean);
    const buttons=[...main.querySelectorAll('.shelfArrow,.homeShowcaseActions .btn,.volumeReleaseOpen,.homeBookOpen')].map(el=>({...rect(el),name:el.textContent.trim().slice(0,22)}));
    const shelves=[...main.querySelectorAll('.discoverShelf')].map(el=>{
      const track=el.querySelector('.discoverShelfTrack');
      const arrows=[...el.querySelectorAll('.shelfArrow')];
      return {max:Math.max(0,track.scrollWidth-track.clientWidth),
       trackId:track.id,arrowTargets:arrows.map(x=>x.getAttribute('aria-controls')),
       states:arrows.map(x=>x.disabled)};
    });
    return {
     overflow:root.scrollWidth-root.clientWidth,
     theme:root.dataset.siteTheme,mode:document.body.classList.contains('dark')?'dark':'light',
     corners:root.dataset.siteCorners,density:root.dataset.siteDensity,motion:root.dataset.siteMotion,
     scale:parseFloat(getComputedStyle(root).fontSize),
     hero,tiles:tiles.length,covers,buttons,shelves,
     releases:main.querySelectorAll('.volumeReleaseCard').length,
     headings:main.querySelectorAll('h1').length,
     broken:document.body.innerText.includes('no pudo mostrar esta vista')
    };
   });
   const fail=(error,details)=>failures.push({engineName,name:config.name,error,...details});
   if(measurement.broken||measurement.overflow>2||measurement.headings!==1||measurement.tiles<8||
     measurement.releases!==1||!measurement.hero){
    fail('falta contenido o hay desbordamiento',{measurement});
   }
   if(measurement.covers.some(x=>x.ratio<1.41||x.ratio>1.59))
    fail('proporciones de las portadas inconsistentes',{covers:measurement.covers});
   if(measurement.buttons.some(x=>x.height<42||x.width<40))
    fail('controles táctiles demasiado pequeños',{buttons:measurement.buttons.filter(x=>x.height<42||x.width<40)});
   if(measurement.shelves.some(x=>x.arrowTargets.some(t=>t!==x.trackId)))
    fail('flechas sin referencia a la estantería',{shelves:measurement.shelves});
   if(measurement.theme!==config.theme||measurement.mode!==config.mode||
     measurement.corners!==config.corners||measurement.density!==config.density||
     measurement.motion!==config.motion||
     Math.abs(measurement.scale-16*config.scale/100)>.7)
    fail('preferencias de apariencia no respetadas',{measurement});
   if(config.name==='telefono-390'&&measurement.hero.height>750&&config.scale===100)
    fail('hero demasiado alto para primer pantallazo',{hero:measurement.hero});
   if(config.width<=430){
    const rail=page.locator('.discoverShelfTrack').first();
    const next=page.locator('.discoverShelf .shelfArrow[data-direction="1"]').first();
    const previous=page.locator('.discoverShelf .shelfArrow[data-direction="-1"]').first();
    if(await previous.isDisabled()===false||await next.isDisabled()===true){
     fail('estantería móvil no parte con flechas correctas',{});
    }else{
     await next.click();
     await page.waitForFunction(()=>{
      const t=document.querySelector('.discoverShelfTrack');
      const b=document.querySelector('.discoverShelf .shelfArrow[data-direction="-1"]');
      return t&&t.scrollLeft>5&&b&&!b.disabled;
     },undefined,{timeout:4500});
    }
   }
   if(['telefono-390','tableta-768','escritorio-1280'].includes(config.name)&&engineName==='Chromium'){
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
    await page.screenshot({path:snapDir+'/'+config.name+'-'+config.mode+'.png',animations:'disabled'});
   }
   results.push({engine:engineName,case:config.name,overflow:measurement.overflow,
     heroHeight:Math.round(measurement.hero?.height||0),cards:measurement.tiles,
     releaseCards:measurement.releases,shelves:measurement.shelves.length});
  }catch(error){failures.push({engineName,name:config.name,error:String(error)})}
  finally{if(errors.length)failures.push({engineName,name:config.name,error:'javascript',errors});await context.close()}
 }
 await browser.close();
}
const report={inspected:results.length,cases:tests.length,failures,results};
fs.writeFileSync(snapDir+'/report.json',JSON.stringify(report,null,2));
console.log('Home Fase 4 responsive QA:',JSON.stringify({inspected:results.length,failures:failures.length}));
if(failures.length){console.error(JSON.stringify(failures.slice(0,15),null,2));process.exit(1)}
