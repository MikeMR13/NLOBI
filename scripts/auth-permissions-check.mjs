import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
new Function(source);
const start=source.indexOf('async function loadUser(){');
const end=source.indexOf('async function loadAdminData()',start);
assert.ok(start>=0&&end>start);
const loaderSource=source.slice(start,end);
const uid='840c2245-c50e-4bc4-8750-c6ee3b83afb9';

async function scenario(failedPath=''){
 const S={token:'valid',user:null,profile:null,groups:[],admin:false};
 const errors=[],renders=[];
 const jreq=async(path)=>{
  if(path.includes(failedPath)&&failedPath)throw new Error('Test: rejected '+failedPath);
  if(path==='/auth/v1/user')return {id:uid};
  if(path.includes('/profiles?'))return [{id:uid,account_type:'reader_translator'}];
  if(path.includes('/group_members?'))return [{role:'owner',permissions:{},translator_groups:{id:'team-id',name:'OX-MR TRADUCCIONES'}}];
  if(path.includes('/site_admins?'))return [{user_id:uid}];
  if(path.includes('/reading_history?')){throw new Error('History failed unexpectedly');}
  return [];
 };
 const safeOptionalLoad=async(label,promise)=>{try{return await promise}catch(error){errors.push(label);return null}};
 const empty=async()=>[];
 const maker=new Function('S','jreq','jreqAllRows','safeOptionalLoad','hydrateReaderSettings','syncReaderUiPreferences','render','toast','loadMyCollections','loadPublicCollections','loadStudioData','loadBetaFeedback','loadFollows','loadReaderSocialFollows','loadAdminData','clearSession',loaderSource+';return loadUser;');
 const load=maker(S,jreq,empty,safeOptionalLoad,()=>{},empty,()=>renders.push({admin:S.admin,groups:S.groups.length}),()=>{},empty,empty,empty,empty,empty,empty,empty,()=>{});
 await load();
 return {S,errors,renders};
}
const result=await scenario();
assert.equal(result.S.groups.length,1,'History failure must not unlink team');
assert.equal(result.S.groups[0].role,'owner');
assert.equal(result.S.admin,true,'History failure must not revoke admin');
assert.equal(result.S.accountPermissionsReady,true);
assert.equal(result.S.adminPermissionsReady,true);
assert.deepEqual(result.S.readingHistory,[],'History failure should not block the account');
assert.ok(result.renders.some(x=>x.admin&&x.groups===1),'Permissions must render before secondary data');
const unavailable=await scenario('/group_members?');
assert.equal(unavailable.S.admin,true,'Team query failure must not affect platform admin');
assert.equal(unavailable.S.accountPermissionsReady,false,'Unverified team data must not be treated as no memberships');
assert.equal(unavailable.S.adminPermissionsReady,true);
assert.ok(source.includes('S.accountPermissionsReady&&!S.groups.length'),'Team application must be hidden until membership verified');
assert.ok(source.includes('El catálogo no impide recuperar la cuenta'),'Catalog failure must not prevent session boot');
assert.ok(!source.includes('S.admin=false;S.catalogLoading=true;'),'Boot must not erase an already-verified admin flag');
console.log('Permissions regression OK: team owner and platform admin survive secondary query failures.');
