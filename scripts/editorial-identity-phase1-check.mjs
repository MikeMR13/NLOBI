import assert from 'node:assert/strict';
import fs from 'node:fs';
import {composeEditorialCss} from './compose-editorial-css-phase6.mjs';
import {chromium,webkit} from 'playwright';

const css=composeEditorialCss(fs.readFileSync('src/styles.css','utf8'),name=>fs.readFileSync('src/styles/'+name+'.css','utf8'));
const app=fs.readFileSync('src/app.js','utf8');
const html=fs.readFileSync('src/index.html','utf8');
const phase=css.split('/* OBI EDITORIAL IDENTITY — FASE 1')[1]?.split('/* OBI EDITORIAL COLLECTIONS — FASE 2')[0];
assert.ok(phase,'Falta la identidad editorial de fase 1');
assert.match(phase,/--obi-display:/);
assert.match(phase,/--obi-rule:/);
assert.match(phase,/\.homeEyebrow::before/);
assert.match(phase,/prefers-reduced-motion:reduce/);
assert.match(phase,/forced-colors:active/);
assert.doesNotMatch(phase,/@import|url\(\s*['"]?https?:/i,'Fase 1: no descargar tipografías o estilos externos');
for(const source of [app,html]){
 assert.ok(source.includes('<span class="brandMark" aria-hidden="true">帯</span>'),
  'El sello 帯 debe estar en el encabezado inicial y dinámico.');
}
assert.ok(!phase.includes('.readerPaper'),'No modificar directamente tipografías EPUB del lector');

const fixture=`<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="/assets/styles.css"></head><body>
<header class="top"><div class="bar">
<a class="brand" href="#home" aria-label="El Obi del Lector, ir al inicio">
<span class="brandMark" aria-hidden="true">帯</span>
<span class="brandFull">El Obi del Lector</span>
<span class="brandCompact" aria-hidden="true">El Obi</span></a>
<nav class="nav"><button type="button">Inicio</button><button type="button">Explorar</button></nav>
</div></header>
<main class="wrap homeEditorial">
<section class="homeShowcase"><div class="homeShowcaseCopy">
<span class="homeEyebrow">BIBLIOTECA DE NOVELAS LIGERAS</span>
<h1>Abre un libro. Entra en otra historia.</h1></div></section>
<div class="sectionHead"><div><h2>Nuevas lecturas</h2><p class="muted">Selecciona una novela.</p></div></div>
<button type="button" class="btn primary">Explorar novelas</button>
</main></body></html>`;
const results=[];
for(const [engineName,engine] of [['Chromium',chromium],['WebKit',webkit]]){
 const browser=await engine.launch({headless:true});
 try{
  for(const width of [320,390,1280]){
   const context=await browser.newContext({viewport:{width,height:850},reducedMotion:'reduce'});
   await context.route('**/editorial-identity-fixture',route=>route.fulfill({
    status:200,contentType:'text/html; charset=utf-8',body:fixture}));
   const page=await context.newPage();
   try{
    await page.goto('http://127.0.0.1:4173/editorial-identity-fixture',{waitUntil:'load'});
    for(const theme of ['light','dark']){
     const result=await page.evaluate(dark=>{
      document.body.classList.toggle('dark',dark);
      const style=selector=>getComputedStyle(document.querySelector(selector));
      return {
       font:style('.sectionHead h2').fontFamily,
       japanese:getComputedStyle(document.querySelector('.homeEyebrow'),'::before').content,
       japaneseDisplay:getComputedStyle(document.querySelector('.homeEyebrow'),'::before').display,
       accent:getComputedStyle(document.body).getPropertyValue('--accent').trim(),
       mark:document.querySelector('.brandMark').textContent.trim(),
       markBorder:style('.brandMark').borderTopStyle,
       sectionRule:style('.sectionHead').borderBottomStyle,
       accentRule:getComputedStyle(document.querySelector('.sectionHead'),'::after').backgroundColor,
       title:document.querySelector('h1').textContent.trim(),
       focusLabel:document.querySelector('.brand').getAttribute('aria-label'),
       btnTransition:style('.btn.primary').transitionDuration,
       brandBand:getComputedStyle(document.querySelector('.brandFull'),'::after').display,
       scroll:document.documentElement.scrollWidth,
       viewport:document.documentElement.clientWidth
      };
     },theme==='dark');
     assert.ok(result.font.includes('Georgia'),engineName+': título editorial sin serif');
     assert.equal(result.mark,'帯');
     assert.equal(result.markBorder,'solid');
     assert.equal(result.sectionRule,'solid');
     assert.ok(result.japanese.includes('翻訳図書館'));
     assert.ok(result.accent.length>0);
     assert.equal(result.focusLabel,'El Obi del Lector, ir al inicio');
     assert.ok(result.scroll<=result.viewport+1,
      engineName+' '+width+' '+theme+': desbordamiento horizontal '+result.scroll+'/'+result.viewport);
     assert.ok(width<=640?result.japaneseDisplay==='none':result.japaneseDisplay!=='none',
      'La etiqueta japonesa debe ocultarse solo en móviles compactos');
     assert.equal(result.brandBand,width<=1100?'none':'block');
     assert.ok(result.btnTransition.split(',').every(value=>parseFloat(value)<=0.001),
      'Movimiento reducido debe anular las transiciones perceptibles');
     results.push({engine:engineName,width,theme,overflow:false,seal:result.mark});
    }
   }finally{await context.close()}
  }
 }finally{await browser.close()}
}
console.log('OBI editorial identity phase 1:',JSON.stringify({scenarios:results.length,failures:0}));
