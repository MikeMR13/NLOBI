import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser=await chromium.launch({headless:true});
const context=await browser.newContext({serviceWorkers:'block'});
await context.route('**/runtime-config.js',route=>route.fulfill({
 status:200,contentType:'application/javascript',
 body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa'};"
}));
await context.route('https://qa.supabase.local/**',route=>route.fulfill({status:200,contentType:'application/json',body:'[]'}));
const page=await context.newPage(),loaded=[];
page.on('request',request=>{if(request.url().includes('/assets/studio-phase'))loaded.push(request.url())});
try{
 await page.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('#mainContent',{timeout:15000});
 await page.waitForTimeout(500);
 assert.equal(loaded.length,0,'Studio se descargó al abrir Inicio: '+loaded.join(','));
 await page.evaluate(()=>{location.hash='#studio'});
 await page.waitForFunction(()=>typeof window.createStudioPhase7==='function'&&typeof window.createStudioPhase6==='function'&&typeof window.createStudioPhase5==='function',{timeout:15000});
 assert.equal(new Set(loaded.map(url=>new URL(url).pathname)).size,3,'No se cargaron los tres módulos de Studio al entrar');
 console.log('Studio lazy browser check: OK');
}finally{await context.close();await browser.close()}
