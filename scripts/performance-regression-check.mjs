import assert from 'node:assert/strict';
import fs from 'node:fs';

const app=fs.readFileSync('src/app.js','utf8');
const sw=fs.readFileSync('public/sw.js','utf8');
const sql=fs.readFileSync('supabase/migrations/20261013001000_performance_catalog_indexes_and_rls.sql','utf8');
const html=fs.readFileSync('src/index.html','utf8');

// Las pantallas privadas solo deben solicitarse al acceder a sus rutas.
assert.match(app,/if\(route==='admin'\).*loadAdminData\(\)/);
assert.match(app,/if\(route==='beta'\).*loadBetaFeedback\(\)/);
assert.match(app,/if\(S\.admin&&S\.view==='admin'\).*loadAdminData\(\)/);
assert.match(app,/if\(S\.view==='beta'\).*loadBetaFeedback\(\)/);
assert.equal((app.match(/loadRatings\(\)/g)||[]).length,4,'Revisar llamadas duplicadas de valoraciones');

// El SW no debe forzar volver a transferir recursos con cache:no-store.
assert.doesNotMatch(sw,/fetch\(req,\{cache:'no-store'\}\)/);
assert.match(sw,/networkFirst\(req,req,'default'\)/);
assert.match(sw,/cacheMode='no-cache'/);
assert.match(html,/rel="preconnect" href="https:\/\/hfbpsizgwzvvznrktiuq.supabase.co"/);

// Verifica las garantías de rendimiento de la migración.
for(const key of ['translations_status_updated_perf_idx','volumes_status_published_perf_idx',
 'sections_status_published_perf_idx','reader_annotations_section_perf_idx',
 'editorial_publication_events_volume_perf_idx','drop index if exists public.volume_schedule_one_pending_per_volume']){
 assert.ok(sql.includes(key),'Falta optimización SQL: '+key);
}
for(const policy of ['Readers view own UI preferences','Readers insert own UI preferences','Readers update own UI preferences']){
 assert.ok(sql.includes(policy),'Falta RLS: '+policy);
}
assert.match(sql,/\(select auth\.uid\(\)\)/);
console.log('Performance regression audit: OK');
