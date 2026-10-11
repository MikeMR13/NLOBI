import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('src/app.js'),sql=read('supabase/migrations/20261011181500_studio_team_status_edit_permissions.sql');
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
 searchQuery:'',searchStatus:'all',searchNovelStatus:'all',searchLanguage:'all',
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

for(const term of [
 'id="catalogStatus"','id="catalogNovelStatus"','Estado de la traducción',
 'Estado de la novela original','searchNovelStatus:e.target.value',
 "S.searchNovelStatus='all'",
 "['searchNovelStatus','Obra original'",
 "['searchStatus','Traducción'",
 'id="studioProjectFilter"','id="studioNovelPublicationFilter"',
 'id="saveTranslationStatus"','id="saveNovelPublicationStatus"',
 'data-studio-project-jump="studioNovelPublicationStatusPanel"',
 'data-studio-project-jump="studioProjectStatusPanel"',
 'novels(id,title,title_original,author_name,cover_url,novel_type,genres,status)',
 'status),translator_groups(id,name)'
]) assert.ok(app.includes(term),'Missing status integration: '+term);

assert.ok(sql.includes('private.team_action_allowed(group_id,\'edit\')'),'Update RLS must follow team editorial edit permissions');
assert.ok(sql.includes('private.team_action_allowed(t.group_id,\'edit\')'),'Novel update RLS must be restricted to an editor team');
assert.ok(sql.includes("tg_table_name in ('sections','volumes')"),'Section/volume publication must remain protected');
assert.ok(sql.includes("action_name := 'publish'"),'Publication workflow needs separate permission');
assert.ok(sql.includes("action_name := 'edit'"),'Translation status should be editable without publishing rights');
assert.ok(sql.includes("to_jsonb(new) - 'status' - 'updated_at'"),'Only novel status update gets multi-team exception');
assert.ok(sql.includes("for responsible in"),'Shared metadata must still require rights for all translation teams');
assert.ok(!sql.includes('grant select, update on public.translations'),'Should not broaden table grants');
assert.ok(sql.includes('with check ('),'RLS must enforce both pre- and post-update ownership');

console.log('Studio and Explore dual-status filters OK: independent filters, combined searches, team editing policies and safe shared metadata.');
