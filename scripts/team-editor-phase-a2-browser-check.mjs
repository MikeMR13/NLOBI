import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from 'playwright';
const src=fs.readFileSync('scripts/full-quality-check.mjs','utf8');
const first=src.indexOf('const now='),last=src.indexOf('const viewports=');
if(first<0||last<=first)throw Error('Quality fixtures missing');
const {scenarios}=new Function(src.slice(first,last)+'\nreturn {scenarios};')();
const preset=scenarios.find(row=>row[0]==='creator-team-custom')?.[2];
const guest=scenarios.find(row=>row[0]==='public-group')?.[2]?.publicGroup;
assert.ok(preset?.studioTeam&&guest,'Expected QA fixtures');
for(const [name,type] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await type.launch({headless:true});
 try{
  for(const width of [390,1280]){
   const ctx=await browser.newContext({viewport:{width,height:860},serviceWorkers:'block'});
   await ctx.route('**/runtime-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',
    body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
   await ctx.route('https://qa.supabase.local/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
   const page=await ctx.newPage(),errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   try{
    await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>!!window.__NLOBI_QA__,null,{timeout:12000});
    await page.evaluate(({preset,guest})=>{
     window.__NLOBI_QA__.setState({...preset,publicGroup:guest,teamPreviewPublicData:guest,teamSettingsTab:'custom',
       teamDesignPreviewMode:'quick',teamDesignDevice:'desktop'});
     window.__NLOBI_QA__.setView('studio:team:group-1');
    },{preset,guest});
    await page.waitForSelector('#teamPreviewFull');
    assert.equal(await page.locator('#teamCustomPreview .teamPreviewCanvas').count(),1,'Quick preview regressed');
    assert.equal(await page.locator('#saveTeamCustom').textContent(),'Guardar borrador privado');
    await page.locator('#teamPreviewFull').click();
    await page.waitForSelector('#teamDesignFrame');
    const frame=page.locator('#teamDesignFrame');
    assert.equal(await frame.getAttribute('sandbox'),'','Full preview must be sandboxed');
    const full=await frame.getAttribute('srcdoc');
    assert.ok(full.includes('teamPublicPage'),'Public profile template not reused');
    assert.ok(full.includes('Equipo traductor'),'Team identity missing');
    assert.equal(await page.locator('#teamPreviewFull').getAttribute('aria-pressed'),'true');
    await page.locator('[data-team-preview-device="mobile"]').click();
    const res=await frame.evaluate(el=>({width:el.getAttribute('style'),sandbox:el.getAttribute('sandbox')}));
    assert.ok(res.width.includes('390px'),'Mobile viewport not applied');
    assert.equal(res.sandbox,'');
    const text=await page.locator('#teamDesignDifference').textContent();
    assert.equal(text.trim(),'','Unexpected warning before compare');
    await page.locator('#teamDesignCompareCurrent').click();
    await page.waitForSelector('#teamDesignDifference h4');
    assert.equal(await page.locator('.teamDesignDiffList .teamDesignDiffRow').count(),0,'Comparing unchanged form should be empty');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);
    assert.ok(overflow<=3,'Horizontal overflow at '+width+'px: '+overflow);
    await page.locator('#teamPreviewQuick').click();
    assert.equal(await page.locator('#teamCustomPreview .teamPreviewCanvas').count(),1,'Quick preview did not restore');
    assert.deepEqual(errors,[],name+' uncaught errors');
    console.log(name+' Phase A.2 '+width+'px: full public preview, viewport switching, compare and quick mode OK');
   }finally{await ctx.close()}
  }
 }finally{await browser.close()}
}
