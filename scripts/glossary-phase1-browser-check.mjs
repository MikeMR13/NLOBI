import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';

for(const [name,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.route('**/assets/app.js*',route=>route.fulfill({status:200,contentType:'text/javascript',body:''}));
 await context.route('**/runtime-config.js',route=>route.fulfill({status:200,contentType:'application/javascript',body:''}));
 const page=await context.newPage(),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
  await page.evaluate(async()=>{
   await import('/assets/glossary-phase1.js');
   document.body.innerHTML='<main class="readerExperience"><article class="readerPaper"><p id="glossaryTest">Alicia <strong>habla con Alicia</strong> y <em>Alícia</em>.</p><p><ruby>Alicia<rt>アリシア</rt></ruby></p></article></main>';
   const terms=[{id:'t1',term:'Alicia',category:'Personaje',definition:'Protagonista, sin spoilers.'}];
   window.testGlossary=window.createGlossaryPhase1({
    S:{},jreq:async()=>terms,esc:v=>String(v),toast:()=>{},teamCan:()=>false
   });
   await window.testGlossary.decorateReader({translation_id:'00000000-0000-4000-8000-000000000001'});
  });
  await page.waitForFunction(()=>document.querySelectorAll('.nlobiGlossaryTerm').length===2,{timeout:3000});
  assert.equal(await page.locator('#glossaryTest strong').count(),1,name+' debe conservar negritas');
  assert.equal(await page.locator('#glossaryTest em').count(),1,name+' debe conservar cursivas');
  assert.equal(await page.locator('.readerPaper ruby').count(),1,name+' debe conservar ruby');
  assert.equal(await page.locator('.readerPaper rt').innerText(),'アリシア');
  await page.locator('.nlobiGlossaryTerm').first().click();
  await page.waitForSelector('dialog.nlobiGlossaryDialog[open]');
  assert.equal(await page.locator('dialog.nlobiGlossaryDialog p').innerText(),'Protagonista, sin spoilers.');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('dialog.nlobiGlossaryDialog').count(),0,name+' debe cerrar con Escape');
  await page.evaluate(()=>{
   document.querySelector('.readerPaper').innerHTML='<div id="readerContinuousChapters"><section class="readerContinuousChapter"><p>Alicia vuelve en lectura continua.</p></section></div>';
  });
  await page.waitForFunction(()=>document.querySelectorAll('.nlobiGlossaryTerm').length===1,{timeout:3000});
  assert.deepEqual(errors,[],name+': errores de JavaScript');
  console.log(name+': lector glosario, diálogo, formato EPUB y continuo OK');
 }finally{await context.close();await browser.close();}
}
