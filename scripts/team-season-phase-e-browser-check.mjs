import fs from 'node:fs';
import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
const source=fs.readFileSync('scripts/full-quality-check.mjs','utf8');
const first=source.indexOf('const now='),last=source.indexOf('const viewports=');
if(first<0||last<=first)throw Error('Quality fixtures unavailable');
const {scenarios}=new Function(source.slice(first,last)+'\nreturn {scenarios};')();
const fixture=scenarios.find(row=>row[0]==='public-group')?.[2];
assert.ok(fixture?.publicGroup,'Public group QA fixture unavailable');
const iso=dayOffset=>new Date(Date.now()+dayOffset*86400000).toISOString().slice(0,10);
const start=iso(-1),end=iso(1),futureStart=iso(2),futureEnd=iso(4);
for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:840},serviceWorkers:'block',reducedMotion:'reduce'});
   await ctx.route('**/runtime-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',
     body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
   await ctx.route('https://qa.supabase.local/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
   const page=await ctx.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__NLOBI_QA__,null,{timeout:15000});
    const apply=async function(settings){
     await page.evaluate(({base,settings})=>{
      const group={...base.publicGroup,profile_settings:{...(base.publicGroup.profile_settings||{}),...settings}};
      window.__NLOBI_QA__.setState({...base,publicGroup:group,user:null});
      window.__NLOBI_QA__.setView('group:group-1');
     },{base:fixture,settings});
    };
    const settings={team_season:'sakura',team_season_motion:'animated',team_season_density:'suave',
      team_season_mode:'scheduled',team_season_start:start,team_season_end:end,
      team_season_message:'¡Sakura! <img src=x onerror=alert(1)>'};
    await apply(settings);
    await page.waitForSelector('.teamPublicPage.teamSeason-sakura > .teamSeasonLayer');
    const banner=page.locator('.teamPublicPage > .teamSeasonGreeting');
    assert.equal(await banner.count(),1,'Season greeting not rendered');
    assert.equal(await banner.getAttribute('aria-label'),'Mensaje de temporada');
    assert.ok((await banner.textContent()).includes('<img src=x onerror=alert(1)>'),'XSS test text missing');
    assert.equal(await banner.locator('img,script').count(),0,'Untrusted greeting inserted as HTML');
    const initial=await page.locator('.teamPublicPage > .teamSeasonLayer').evaluate(el=>({pointer:getComputedStyle(el).pointerEvents,screenHeight:el.getBoundingClientRect().height}));
    assert.equal(initial.pointer,'none','Decor layer blocks clicks');
    assert.ok(initial.screenHeight>0&&initial.screenHeight<=291,'Decor layer height abnormal');
    const motion=await page.locator('.teamSeasonPiece').first().evaluate(el=>getComputedStyle(el).animationName);
    assert.equal(motion,'none','Reduced-motion preference not respected');
    await apply({...settings,team_season_start:futureStart,team_season_end:futureEnd});
    await page.waitForSelector('.teamPublicPage.teamSeason-none');
    assert.equal(await page.locator('.teamPublicPage > .teamSeasonLayer').count(),0,'Inactive interval still has decor');
    assert.equal(await page.locator('.teamPublicPage > .teamSeasonGreeting').count(),0,'Inactive interval still shows greeting');
    await apply({...settings,team_season:'nieve',team_season_mode:'manual'});
    await page.waitForSelector('.teamPublicPage.teamSeason-nieve > .teamSeasonLayer');
    assert.equal(await page.locator('.teamPublicPage > .teamSeasonGreeting').count(),1,'Legacy manual behavior changed');
    assert.equal(await page.locator('.teamPublicPage > .teamSeasonLayer [aria-hidden]').count(),0,'Unexpected decorative nested roles');
    const widthOk=await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+3);
    assert.ok(widthOk,name+' horizontal overflow at '+width+'px');
    assert.deepEqual(errors,[],name+' page errors');
    console.log('Fase E '+name+' '+width+'px UTC schedule, XSS, no-motion and legacy mode OK');
   }finally{await ctx.close()}
  }
 }finally{await browser.close()}
}
