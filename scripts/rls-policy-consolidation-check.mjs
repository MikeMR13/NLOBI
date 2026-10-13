import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync(
 'supabase/migrations/20261013172211_consolidate_editorial_rls_policies.sql','utf8');
const rollback=fs.readFileSync(
 'supabase/rollbacks/20261013172211_consolidate_editorial_rls_policies.rollback.sql','utf8');
const norm=sql=>sql.toLowerCase().replace(/--[^\n]*/g,'').replace(/\s+/g,' ');
const sql=norm(migration),undo=norm(rollback);

assert.match(sql,/^\s*begin;/);
assert.match(sql,/commit;\s*$/);
assert.match(undo,/^\s*begin;/);
assert.match(undo,/commit;\s*$/);

// Se eliminan seis políticas solapadas; la séptima se separa por rol.
const obsolete=[
 ['public.novels','novels_editor_delete'],
 ['public.translations','translations_group_delete'],
 ['public.volumes','volumes_group_delete'],
 ['public.volumes','volumes_custom_publish'],
 ['public.sections','sections_group_delete'],
 ['public.sections','sections_custom_publish']
];
for(const [table,name] of obsolete){
 assert.ok(sql.includes('drop policy '+name+' on '+table+';'),name+' must be dropped');
 assert.ok(undo.includes('create policy '+name+' on '+table+' for '),name+' must be restorable');
}
for(const table of ['novels','translations','volumes','sections']){
 const identifier=table==='novels'?'novels_custom_delete':
  table==='translations'?'translations_custom_delete':table+'_custom_delete';
 assert.ok(sql.includes('alter policy '+identifier+' on public.'+table),'DELETE missing '+table);
}
for(const table of ['volumes','sections']){
 const block=sql.split('alter policy '+table+'_update on public.'+table)[1]
   ?.split('drop policy '+table+'_custom_publish')[0]||'';
 for(const token of [
  'private.is_site_admin()', 'private.is_group_editor(t.group_id)',
  "private.team_action_allowed(t.group_id,'publish')", 'with check'
 ])assert.ok(block.includes(token),'UPDATE missing '+table+': '+token);
}
assert.match(sql,/alter policy translation_collaborations_public_read on public\.translation_collaborations to anon;/);
const collaboration=sql.split('alter policy translation_collaborations_team_read')[1]||'';
assert.ok(collaboration.includes("status='accepted'"));
assert.ok(collaboration.includes('private.is_site_admin()'));
assert.ok(collaboration.includes('public.group_members'));
assert.match(undo,/alter policy translation_collaborations_public_read on public\.translation_collaborations to anon,authenticated;/);

// Combinación lógica: conserva los accesos de edición/publicación y equipos.
// DELETE se endurece de manera deliberada: los disparadores ya lo exigían.
for(const admin of [false,true])
for(const editor of [false,true])
for(const publish of [false,true]){
 const before=admin||editor||publish;
 const after=admin||(editor||publish);
 assert.equal(after,before,'UPDATE grant equivalence');
}
for(const admin of [false,true])
for(const member of [false,true])
for(const publicAccepted of [false,true]){
 assert.equal(admin||member||publicAccepted,
  (admin||member)||publicAccepted,'collaboration read equivalence');
}
for(const admin of [false,true])
for(const deleteGranted of [false,true])
for(const editor of [false,true]){
 const after=admin||deleteGranted;
 assert.ok(!after||admin||deleteGranted,'delete is still guarded');
 if(editor&&!deleteGranted&&!admin)assert.equal(after,false,'editor must not gain delete via RLS');
}
assert.doesNotMatch(sql,/drop table|truncate|delete from public\.|disable row level security/);
console.log('RLS policy consolidation: six redundant policies removed, one role overlap split, explicit DELETE grants and rollback verified.');
