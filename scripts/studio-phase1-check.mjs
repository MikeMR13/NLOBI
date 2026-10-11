import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../supabase/migrations/20261010222100_studio_phase1_foundations.sql',import.meta.url),'utf8');

// Parse the entire application before running focused Studio checks.
new Function(app);

function definition(name){
 const start=app.search(new RegExp('(?:async )?function '+name+'\\s*\\('));
 assert.ok(start>=0,'Missing function: '+name);
 const rest=app.slice(start+1), next=rest.search(/\n(?:async )?function\s+[\w$]+\s*\(/);
 assert.ok(next>=0,'Missing next function boundary: '+name);
 return app.slice(start,start+1+next);
}
const readOnly=definition('studioProjectReadOnlyView');
const makeView=new Function('nav','status','esc','teamCan','studioSectionReview','novelTypeLabel','translationStatusLabel',readOnly+';return studioProjectReadOnlyView;');
const project={
 id:'example', group_id:'team',novels:{title:'Prueba de novela'},
 translator_groups:{name:'Equipo de prueba'},status:'active',
 volumes:[{id:'volume',volume_number:1,status:'draft',sections:[
  {id:'chapter',title:'Capítulo 1',status:'review',section_type:'chapter'}]}]
};
const escapeHtml=s=>String(s);
const reviewerView=makeView(()=>'',()=>'',escapeHtml,(_id,action)=>action==='review',sec=>'<aside data-review-id="'+sec.id+'">Revisar</aside>',()=> 'Novela ligera',()=> 'Activa');
const collaboratorView=makeView(()=>'',()=>'',escapeHtml,()=>false,()=>{throw new Error('Collaborator must not render review controls')},()=> 'Novela ligera',()=> 'Activa');
assert.match(reviewerView(project),/data-review-id="chapter"/,'Corrector should see review actions');
assert.doesNotMatch(collaboratorView(project),/data-review-id/,'Collaborator cannot review');
assert.doesNotMatch(reviewerView(project),/data-edit-section/,'Read-only review must not enable content editing');

const atomicSave=definition('saveStudioSection');
assert.match(atomicSave,/backupEditorialDraft\(\)/);
assert.match(atomicSave,/save_studio_section_atomic/);
assert.match(atomicSave,/p_expected_updated_at:sec\.updated_at/);
assert.match(atomicSave,/STUDIO_EDIT_CONFLICT/);
assert.ok(!atomicSave.includes('/rest/v1/section_revisions'),'Must save revisions only through atomic RPC');

assert.match(app,/baseUpdatedAt:sec\.updated_at/,'Local draft should remember the base version');
assert.match(app,/if\(draft\.baseUpdatedAt\)sec\.updated_at=draft\.baseUpdatedAt/,'Restore base version for conflict check');
assert.match(app,/translator_groups\(id,name,review_required\)/);
assert.doesNotMatch(app,/id="teamPanel-identity"[^>]*id="teamProfileSettings"/);

assert.match(sql,/security invoker/i);
assert.match(sql,/for update;/i,'Prevent concurrent edits');
assert.match(sql,/STUDIO_EDIT_CONFLICT/);
assert.match(sql,/insert into public\.section_revisions/);
assert.match(sql,/revoke all on function public\.save_studio_section_atomic/i);
assert.match(sql,/grant execute on function public\.save_studio_section_atomic[\s\S]*to authenticated, service_role/i);
for(const value of ['light_novel','web_novel','original','active','paused','abandoned','complete','awaiting_sequel','no_sequel_confirmed','is_final_volume']){
 assert.ok(sql.includes(value),'Missing expected metadata value: '+value);
}
console.log('Studio Phase 1 checks OK: reviewer scopes, local drafts, optimistic saves, schema preparation.');
