import {chromium} from 'playwright';

const base='http://127.0.0.1:4173/';
const cases=[
 {width:320,scale:100},{width:375,scale:100},{width:390,scale:100},
 {width:390,scale:135},{width:430,scale:100},{width:768,scale:135},
 {width:820,scale:135},{width:1024,scale:135},{width:1100,scale:135},
 {width:1280,scale:100}
];
const failures=[];
const browser=await chromium.launch({headless:true});
for(const view of cases){
 const context=await browser.newContext({viewport:{width:view.width,height:844},serviceWorkers:'block'});
 await context.addInitScript(options=>{
  localStorage.setItem('nlobi_site_appearance',JSON.stringify({theme:'graphite',mode:'dark',scale:options.scale}));
 },view);
 await context.route('**/runtime-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
 await context.route('https://qa.supabase.local/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
 const page=await context.newPage();
 const runtime=[];page.on('pageerror',e=>runtime.push(e.message));
 try{
  await page.goto(base+'#home',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__NLOBI_QA__,null,{timeout:12000});
  await page.evaluate(()=>window.__NLOBI_QA__.setState({user:{id:'phase2-admin',email:'qa@example.test'},profile:{id:'phase2-admin',display_name:'OX-MRADMIN'},admin:true,notes:[]}));
  const initial=await page.evaluate(()=>{
   const header=document.querySelector('.top');
   return {height:header.getBoundingClientRect().height,overflow:document.documentElement.scrollWidth-innerWidth,mobileVisible:getComputedStyle(document.querySelector('.mobileNav')).display!=='none'};
  });
  if(initial.overflow>2)throw Error('Header horizontal overflow: '+initial.overflow);
  if(view.width<=1100){
   if(!initial.mobileVisible)throw Error('Mobile/tablet navigation hidden');
   if(initial.height>90)throw Error('Header too tall: '+initial.height+'px');
   await page.evaluate(()=>window.scrollTo(0,Math.min(300,document.body.scrollHeight-innerHeight)));
   const savedScroll=await page.evaluate(()=>window.scrollY);
   const toggle=page.locator('.mobileNav > summary');
   await toggle.click();
   await page.waitForFunction(()=>document.body.classList.contains('mobileNavOpen'));
   const menu=page.locator('.mobileNavPanel');
   if(!await menu.isVisible())throw Error('Menu panel invisible');
   if(!await page.locator('.mobileNavBackdrop').isVisible())throw Error('Backdrop invisible');
   if(await toggle.getAttribute('aria-expanded')!=='true')throw Error('aria-expanded is not true');
   const locked=await page.evaluate(()=>({position:document.body.style.position,overflow:document.documentElement.scrollWidth-innerWidth,activeInPanel:document.querySelector('.mobileNavPanel').contains(document.activeElement)}));
   if(locked.position!=='fixed'||!locked.activeInPanel||locked.overflow>2)throw Error('Missing body lock, focus placement or horizontal overflow '+JSON.stringify(locked));
   await page.keyboard.press('Escape');
   await page.waitForFunction(()=>!document.querySelector('.mobileNav').open);
   if(await page.evaluate(()=>document.body.style.position==='fixed'))throw Error('Body lock retained after Escape');
   if(!await toggle.evaluate(el=>el===document.activeElement))throw Error('Focus not restored after Escape');
   const restored=await page.evaluate(()=>window.scrollY);
   if(Math.abs(restored-savedScroll)>2)throw Error('Scroll position not restored: '+savedScroll+' / '+restored);
   await toggle.click();
   await page.waitForFunction(()=>document.body.classList.contains('mobileNavOpen'));
   await page.locator('.mobileNavBackdrop').click({position:{x:4,y:250}});
   await page.waitForFunction(()=>!document.querySelector('.mobileNav').open);
   await toggle.click();
   await page.waitForFunction(()=>document.body.classList.contains('mobileNavOpen'));
   const search=page.locator('.mobileNav .quickSearchMenu > summary');
   await search.click();
   if(!await page.locator('#quickSearchMobile').isVisible())throw Error('Search cannot be opened');
   await search.click();
   const account=page.locator('.mobileNav .accountDropdown > summary');
   await account.click();
   if(!await page.locator('.mobileNav .accountDropdownPanel [data-account-action="edit"]').isVisible())throw Error('Account submenu cannot be opened');
   await account.click();
   await page.locator('#nlobiMobileMenu [data-v="explore"]').click();
   await page.waitForFunction(()=>window.__NLOBI_QA__.getState().view==='explore');
   if(await page.evaluate(()=>document.body.classList.contains('mobileNavOpen')||document.body.style.position==='fixed'))throw Error('Menu stayed open after navigating');
   const pref=await page.evaluate(()=>JSON.parse(localStorage.getItem('nlobi_site_appearance')||'{}'));
   if(pref.theme!=='graphite'||pref.mode!=='dark')throw Error('Appearance preferences reset');
   if(view.width===390&&view.scale===135){
    await page.locator('#themeMobileQuick').click();
    const current=await page.evaluate(()=>JSON.parse(localStorage.getItem('nlobi_site_appearance')||'{}'));
    if(current.theme!=='graphite'||current.mode!=='light')throw Error('Theme quick toggle failed');
   }
  }else if(initial.mobileVisible)throw Error('Desktop must use full nav');
  if(runtime.length)throw Error('JavaScript '+runtime.join('; '));
  console.log('NAV_QA_OK '+JSON.stringify({width:view.width,scale:view.scale,headerHeight:initial.height}));
 }catch(e){failures.push({view,error:String(e),runtime})}
 await context.close();
}
await browser.close();
console.log('NAV_QA_RESULT '+JSON.stringify({cases:cases.length,failures:failures.length}));
if(failures.length){console.error(JSON.stringify(failures,null,2));process.exit(1)}
