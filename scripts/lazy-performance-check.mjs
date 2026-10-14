import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('src/index.html','utf8');
const html=fs.readFileSync('dist/index.html','utf8');
const sw=fs.readFileSync('dist/sw.js','utf8');
const app=fs.readFileSync('src/app.js','utf8');

assert.doesNotMatch(src,/<script[^>]+src="\/assets\/studio-phase[567]\.js/);
assert.ok(src.includes('home-cover-hint.js'));
assert.ok(src.includes('initial-home.js'));
assert.match(src,/nlobi-studio-lazy-assets/);
assert.match(app,/async function ensureStudioModules\(\)/);
assert.match(app,/if\(route==='studio'\|\|route\.startsWith\('studio:'\)\)await ensureStudioModules\(\)/);
assert.match(app,/async function loadReaderTranslationMeta\(id\)/);
assert.match(app,/const trId=vol\.translation_id,tr=await loadReaderTranslationMeta\(trId\)/);

for(const file of ['app.js','styles.css','activate-styles.js','home-cover-hint.js','initial-home.js']){
 const pattern=new RegExp('/assets/'+file.replaceAll('.','\\.')+'\\?v=([a-f0-9]{12})');
 const match=html.match(pattern);
 assert.ok(match,'Falta versión de /assets/'+file);
 assert.ok(sw.includes('/assets/'+file+'?v='+match[1]),'SW no precarga el asset versionado '+file);
}
assert.match(sw,/nlobi-shell-v19-40-[a-f0-9]{12}/);
assert.doesNotMatch(sw,/const CORE=\[[^\n]+studio-phase[567]\.js/);
console.log('Optimización de carga y fingerprint de assets: OK');
