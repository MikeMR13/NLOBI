import assert from 'node:assert/strict';
import fs from 'node:fs';

const migration=fs.readFileSync('supabase/migrations/20261013205819_private_security_definer_rpc_phase2.sql','utf8');
const rollback=fs.readFileSync('supabase/rollbacks/20261013205819_private_security_definer_rpc_phase2.rollback.sql','utf8');
const names=[
 'admin_review_purchase_link','admin_review_team_application','create_translation_project',
 'find_team_member_by_email','get_admin_review_reports','get_discoverable_readers',
 'get_followed_reader_activity','get_public_collection_save_counts','get_public_reader_reviews',
 'get_public_translator_group_stats','get_reader_social_counts',
 'get_translation_rating_distribution','get_translation_rating_summaries',
 'get_translation_reviews','invite_translation_collaboration',
 'moderate_translation_review_report','respond_translation_collaboration',
 'revoke_translation_collaboration'
];
const anon=[
 'get_discoverable_readers','get_public_collection_save_counts','get_public_reader_reviews',
 'get_public_translator_group_stats','get_reader_social_counts',
 'get_translation_rating_distribution','get_translation_rating_summaries',
 'get_translation_reviews'
];
const publicNames=[...migration.matchAll(/create or replace function public\.([a-z_]+)\(/g)].map(x=>x[1]);
const innerNames=[...migration.matchAll(/CREATE OR REPLACE FUNCTION rpc_internal\.([a-z_]+)\(/g)].map(x=>x[1]);
assert.deepEqual(publicNames,names,'18 public RPC signatures must remain');
assert.deepEqual(innerNames,names,'18 internal copies must preserve order');
assert.match(migration,/^--[\s\S]*?\nbegin;/);
assert.match(migration,/\ncommit;\s*$/);
assert.match(rollback,/\nbegin;/);
assert.match(rollback,/\ncommit;\s*$/);
assert.match(migration,/revoke all on schema rpc_internal from public;/);
assert.match(migration,/grant usage on schema rpc_internal to anon,authenticated,service_role;/);
assert.match(migration,/rpc_internal NO se debe añadir a Data API/i);
// Las operaciones de moderación preexistentes sí pueden usar DELETE dentro de su función.
assert.doesNotMatch(migration,/(drop table|disable row level security|truncate public\.)/i);
for(const name of names){
 const start=migration.indexOf('CREATE OR REPLACE FUNCTION rpc_internal.'+name+'(');
 const next=migration.indexOf('\n-- ',start+1);
 const chunk=migration.slice(start,next<0?undefined:next);
 assert.match(chunk,/SECURITY DEFINER[\s\S]*SET search_path TO ''/,'must preserve definer SQL');
 assert.match(chunk,new RegExp('revoke all on function rpc_internal\\.'+name+'\\('));
 assert.match(chunk,new RegExp('grant execute on function rpc_internal\\.'+name+'\\('));
 assert.match(chunk,new RegExp('create or replace function public\\.'+name+'\\('));
 assert.match(chunk,/language sql (?:stable|volatile) security invoker/);
 assert.match(chunk,/set search_path to ''/);
 assert.match(chunk,new RegExp('(?:select \\* from|select) rpc_internal\\.'+name+'\\('));
 if(anon.includes(name)){
   assert.match(chunk,/to anon,authenticated,service_role;/,'public reader endpoints must remain callable anonymously');
 }else{
   assert.match(chunk,/to authenticated,service_role;/,'authenticated-only endpoints must remain restricted');
   assert.doesNotMatch(chunk,/to anon,authenticated,service_role;/);
 }
 assert.ok(rollback.includes('CREATE OR REPLACE FUNCTION public.'+name+'('),'must restore original '+name);
 assert.ok(rollback.includes('drop function if exists rpc_internal.'+name+'('),'must remove helper on rollback');
}
assert.match(rollback,/drop schema if exists rpc_internal restrict;/);
assert.equal((migration.match(/SECURITY DEFINER/g)||[]).length,names.length+1); // 18 implementations + descriptive comment
assert.equal((migration.match(/security invoker/g)||[]).length,names.length);
console.log('RPC Phase 2: 18 API wrappers, 18 internal definer implementations, 8 anonymous and 10 authenticated grants, rollback checked.');
