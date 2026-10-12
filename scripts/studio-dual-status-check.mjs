import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('src/app.js'),sql=read('supabase/migrations/20261011190500_editorial_status_permission_alignment.sql');
new Function(app);

// Search: the original work and its translation have different lifecycle states.
const start=app.indexOf('function filteredCatalog(){');
const end=app.indexOf('\nfunction ratingSummary(',start);
assert.ok(start>=0&&end>start,'Catalog filtering is available');
const factory=new Function('S','visibleCatalog','titleOf',app.slice(start,end)+';return filteredCatalog;');
const records=[
 {id:'originalDone',status:'active',language_code:'es',novels:{title:'Original concluida',status:'completed',novel_type:'light_novel',genres:['Fantasía']},updated_at:'2026-10-11T12:00:00Z'},
 {id:'translationDone',status:'complete',language_code:'es',novels:{title:'Traducción terminada',status:'ongoing',novel_type:'web_novel',genres:['Romance']},updated_at:'2026-10-10T12:00:00Z'},
 {id:'hiatus',status:'paused',language_code:'es',novels:{title:'En pausa',status:'hiatus',novel_type:'light_novel',genres:['Acción']},updated_at:'2026-10-09T12:00:00Z'},
 {id:'cancelled',status:'abandoned',language_code:'es',novels:{title:'Cancelada',status:'cancelled',novel_type:'original',genres:['Drama']},updated_at:'2026-10-08T12:00:00Z'}
];
const all={
 searchQuery:'',searchStatus:'all',searchNovelStatus:'all',searchSequelStatus:'all',searchLanguage:'all',
 searchNovelType:'all',searchGenre:'all',searchTag:'all',searchDemography:'all',
 searchTeam:'all',searchAvailability:'all',searchSort:'updated',publishedVolumes:[]
};
function filtered(state={}){
 const S={...all,...state};
 const fn=factory(S,()=>records,x=>x.novels?.title||x.title||'');
 return fn().map(r=>r.id);
}
assert.deepEqual(filtered(),['originalDone','translationDone','hiatus','cancelled']);
assert.deepEqual(filtered({searchNovelStatus:'completed'}),['originalDone']);
assert.deepEqual(filtered({searchStatus:'complete'}),['translationDone']);
assert.deepEqual(filtered({searchNovelStatus:'ongoing',searchStatus:'complete'}),['translationDone']);
assert.deepEqual(filtered({searchNovelStatus:'completed',searchStatus:'complete'}),[]);
assert.deepEqual(filtered({searchNovelStatus:'hiatus',searchStatus:'paused'}),['hiatus']);
assert.deepEqual(filtered({searchNovelStatus:'cancelled'}),['cancelled']);
assert.deepEqual(filtered({searchNovelStatus:'completed',searchGenre:'Romance'}),[]);
assert.deepEqual(filtered({searchNovelStatus:'completed',searchGenre:'Fantasía',searchNovelType:'light_novel'}),['originalDone']);

// Controls for all three lifecycle states must coexist in the same interface.
for(const term of [
 'id="catalogStatus"', 'id="catalogNovelStatus"', 'id="catalogSequelStatus"',
 'Estado de la traducción', 'Estado de la novela original',
 'searchNovelStatus', 'searchSequelStatus',
 'id="projectNovelStatus"', 'id="projectTranslationStatus"',
 'id="projectSequelStatus"', 'id="saveEditorialStates"',
 'data-studio-project-jump="studioProjectStatusPanel"',
 'update_editorial_states'
]) assert.ok(app.includes(term),'Missing status integration: '+term);

// Neither translation statuses nor novel statuses require publication rights.
// Only a status/sequel-status-only update is exempt from ALL-teams metadata approval.
for(const term of [
 "private.team_action_allowed(t.group_id,'edit')",
 "private.team_action_allowed(group_id,'edit')",
 "to_jsonb(new) - 'status' - 'sequel_status' - 'updated_at'",
 'for responsible in',
 'with check('
]) assert.ok(sql.includes(term),'Missing scoped editorial policy: '+term);
assert.ok(!sql.includes('grant select, update on public.translations'),
 'Status updates must not open broad anonymous or authenticated privileges');

console.log('Studio and Explore dual-status filters OK: independent filters, combined searches, team editing policies and safe shared metadata.');
