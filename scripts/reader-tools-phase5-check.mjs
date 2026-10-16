import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

const app=fs.readFileSync('src/app.js','utf8');
const reader=fs.readFileSync('src/reader-tools-phase5.js','utf8');
const css=fs.readFileSync('src/reader-tools-phase5.css','utf8');
const build=fs.readFileSync('scripts/build.mjs','utf8');
const sw=fs.readFileSync('public/sw.js','utf8');
const workflow=fs.readFileSync('.github/workflows/ci.yml','utf8');

execFileSync(process.execPath,['--check','src/app.js']);
execFileSync(process.execPath,['--check','src/reader-tools-phase5.js']);
for(const [label,test] of [
 ['lazy reader only',app.includes("loadScriptOnce('/assets/reader-tools-phase5.js'")],
 ['mount after render',app.includes("mountReaderToolsPhase5();")],
 ['reader portal',app.includes('id="readerPhase5Tools"')],
 ['private annotation table',reader.includes('/rest/v1/reader_annotations?user_id=eq.')],
 ['no unauthenticated annotations',reader.includes('if(!S.user?.id||!navigator.onLine)return')],
 ['annotation ownership on delete',reader.includes("'&user_id=eq.'+encodeURIComponent(S.user.id)")],
 ['no public comment writes',!reader.includes('/rest/v1/comments')],
 ['server owner checks apply',reader.includes('user_id:uid,translation_id:r.translation_id,section_id:r.id')],
 ['existing cache reused',reader.includes('cacheReaderChapter(r)')],
 ['cache success shown honestly',reader.includes('if(cacheReaderChapter(r))toast(')],
 ['cache bounded',app.includes('while(next.length>30)remove();')],
 ['private note text export',reader.includes('mis-notas-')&&reader.includes('text/plain;charset=utf-8')],
 ['official download links preserved',reader.includes("go('detail:'+r.translation_id)")],
 ['CSS opt-in loading',reader.includes("link.href='/assets/reader-tools-phase5.css'")],
 ['mobile layout',css.includes('max-width:460px')],
 ['reduced motion',css.includes('prefers-reduced-motion')],
 ['build JS',build.includes('src", "reader-tools-phase5.js')],
 ['build CSS',build.includes('src", "reader-tools-phase5.css')],
 ['service-worker fetch network-first',sw.includes("'/assets/reader-tools-phase5.js'")],
 ['workflow regression',workflow.includes('scripts/reader-tools-phase5-check.mjs')],
]){assert.ok(test,'Fase 5: '+label)}
console.log('OX-MR lector fase 5: regresiones estáticas y sintaxis OK.');
