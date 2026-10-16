import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';
const src=fs.readFileSync('scripts/full-quality-check.mjs','utf8');
const first=src.indexOf('const now='),last=src.indexOf('const viewports=');
if(first<0||last<=first)throw Error('Quality fixtures unavailable');
const {scenarios}=new Function(src.slice(first,last)+'\nreturn {scenarios};')();
const original=scenarios.find(row=>row[0]==='public-group')?.[2];
assert.ok(original?.publicGroup,'QA team fixture unavailable');
for(const [name,type] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await type.launch({headless:true});
 try{
  for(const [width,animatedExpected,reducedMotion] of [[390,false,'no-preference'],[1280,true,'no-preference'],[1280,false,'reduce']]){
   const context=await browser.newContext({viewport:{width,height:840},reducedMotion,serviceWorkers:'block'});
   await context.route('**/runtime-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
   await context.route('https://qa.supabase.local/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
   const page=await context.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__NLOBI_QA__,null,{timeout:15000});
    await page.evaluate(data=>{
     const group={...data.publicGroup,profile_settings:{...(data.publicGroup.profile_settings||{}),team_season:'sakura',team_season_motion:'animated',team_season_density:'normal'}};
     window.__NLOBI_QA__.setState({...data,publicGroup:group,user:null});
     window.__NLOBI_QA__.setView('group:group-1');
    },original);
    await page.waitForSelector('.teamPublicPage.teamSeason-sakura .teamSeasonLayer');
    // La app puede actualizar el DOM mientras termina de cargar CSS y datos de Home.
    // Esperar un nodo conectado y la propiedad real evita leer estilos de un nodo descartado.
    await page.waitForFunction(()=>{
     const layer=document.querySelector('.teamPublicPage.teamSeason-sakura > .teamSeasonLayer');
     return !!layer?.isConnected&&getComputedStyle(layer).pointerEvents==='none'&&layer.getBoundingClientRect().height>0;
    },null,{timeout:12000});
    const count=await page.locator('.teamPublicPage .teamSeasonPiece').count();
    assert.equal(count,8, name+' should show bounded amount of petals');
    const decor=page.locator('.teamPublicPage .teamSeasonLayer');
    assert.equal(await decor.getAttribute('aria-hidden'),'true',name+' decor must be decorative for screen readers');
    const values=await page.evaluate(()=>{
     const layer=document.querySelector('.teamPublicPage.teamSeason-sakura > .teamSeasonLayer');
     const el=layer?.querySelector('.teamSeasonPiece');
     if(!layer?.isConnected||!el?.isConnected)return null;
     return {animation:getComputedStyle(el).animationName,pointer:getComputedStyle(layer).pointerEvents,layerHeight:layer.getBoundingClientRect().height,hidden:getComputedStyle(el).display};
    });
    assert.ok(values,name+' overlay detached before inspection');
    assert.equal(values.animation==='none',!animatedExpected,name+' animation mode incorrect width='+width+' reduce='+reducedMotion);
    assert.equal(values.pointer,'none',name+' overlay blocks taps');
    assert.ok(values.layerHeight<=291,name+' overlay too tall');
    assert.deepEqual(errors,[],name+' javascript errors');
    if(width===1280&&!animatedExpected){
     await page.evaluate(()=>document.documentElement.dataset.siteMotion='reduce');
     assert.equal(await page.locator('.teamSeasonPiece').first().evaluate(el=>getComputedStyle(el).animationName),'none',name+' OS motion reduction violated');
    }
    if(width===1280&&animatedExpected){
     await page.evaluate(()=>document.documentElement.dataset.siteMotion='reduce');
     assert.equal(await page.locator('.teamSeasonPiece').first().evaluate(el=>getComputedStyle(el).animationName),'none',name+' site motion reduction ignored');
     await page.evaluate(()=>delete document.documentElement.dataset.siteMotion);
    }
    if(width===390){
     for(const season of ['nieve','momiji','matsuri']){
      await page.evaluate(value=>{
       const state=window.__NLOBI_QA__.getState(),group={...state.publicGroup,profile_settings:{...state.publicGroup.profile_settings,team_season:value}};
       window.__NLOBI_QA__.setState({publicGroup:group});window.__NLOBI_QA__.setView('group:group-1');
      },season);
      await page.waitForSelector('.teamPublicPage.teamSeason-'+season+' .teamSeasonLayer');
      assert.equal(await page.locator('.teamSeasonPiece').count(),8,name+' overlay missing for '+season);
     }
     await page.evaluate(()=>{
      const state=window.__NLOBI_QA__.getState(),group={...state.publicGroup,profile_settings:{...state.publicGroup.profile_settings,team_season:'none'}};
      window.__NLOBI_QA__.setState({publicGroup:group});window.__NLOBI_QA__.setView('group:group-1');
     });
     await page.waitForSelector('.teamPublicPage.teamSeason-none');
     assert.equal(await page.locator('.teamSeasonLayer').count(),0,name+' default season should not add DOM elements');
    }
    console.log(name+' Phase C '+width+'px reduced='+reducedMotion+' seasonal overlay OK');
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}
