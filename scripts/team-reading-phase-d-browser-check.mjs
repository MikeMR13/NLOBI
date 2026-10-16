import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
for(const [name,type] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await type.launch({headless:true});
 try{
  for(const width of [390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});
   await ctx.route('**/runtime-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',
    body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
   await ctx.route('https://qa.supabase.local/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
   const page=await ctx.newPage();
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
    const report=await page.evaluate(async()=>{
     const api=await import('/assets/team-reading-metrics-phase-d.js');
     const root=document.createElement('section');
     root.className='teamReadingMetrics';root.id='testPhaseD';
     root.innerHTML='<div id="teamReadingMetricsData" data-team-reading-group="11111111-1111-4111-8111-111111111111"></div>';
     document.body.append(root);
     const div=root.querySelector('#teamReadingMetricsData');
     let calls=0;
     await api.bindTeamReadingMetrics({request:async(url,opts)=>{
      calls++;if(url!=='/rest/v1/rpc/team_reading_snapshot'||opts.method!=='POST')throw Error('Incorrect endpoint');
      const args=JSON.parse(opts.body);if(args.p_days!==30||args.p_group_id!=='11111111-1111-4111-8111-111111111111')throw Error('Invalid scoped request');
      return {qualified:true,unique_readers:8,chapter_completions:13,
       daily:[{date:'2026-10-10',completions:8,readers:7},{date:'2026-10-11',completions:5,readers:5}],
       chapters:[{title:'<img src=x onerror=alert(1)>',novel_title:'Título de obra',volume_number:1,completions:8}]};
     }});
     const text=div.textContent;
     const links=div.querySelectorAll('img,script').length;
     const bars=div.querySelectorAll('.teamReadingBar').length;
     const noScroll=document.documentElement.scrollWidth<=window.innerWidth+3;
     api.renderReadingSnapshot(div,{qualified:false,unique_readers:null,chapter_completions:null,daily:[],chapters:[]});
     const suppressed=div.textContent.includes('al menos cinco')&&div.querySelectorAll('.teamReadingBar').length===0;
     root.remove();return {calls,text,links,bars,noScroll,suppressed};
    });
    assert.equal(report.calls,1,name+' unauthorized extra RPC');
    assert.ok(report.text.includes('Lectores distintos')&&report.text.includes('13'),name+' missing totals');
    assert.ok(report.text.includes('<img src=x'),name+' text is not escaped or disappeared');
    assert.equal(report.links,0,name+' possible HTML injection');
    assert.equal(report.bars,2,name+' missing daily bars');
    assert.ok(report.noScroll,name+' horizontal layout overflow at '+width);
    assert.ok(report.suppressed,name+' insufficient readers should hide report');
    assert.deepEqual(errors,[],name+' uncaught exceptions');
    console.log('Fase D '+name+' '+width+'px: private metrics, responsive view, empty-state and XSS check OK');
   }finally{await ctx.close()}
  }
 }finally{await browser.close()}
}
