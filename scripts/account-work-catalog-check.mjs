import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
new Function(src);
const embedded='volumes!volumes_translation_id_fkey(';
const reverse='translations!volumes_translation_id_fkey(';
for(const [name,fragment] of [
 ['Studio owned catalog','group_id=in.(${ids.join(\',\')})&select=id,title,status,updated_at'],
 ['Studio work details',"const full=base+'&select="],
 ['Reader translation details','async function loadTranslationDetail(id)'],
 ['Studio cleanup','async function loadNovelDeletionSnapshot(novelId)']
]){assert.ok(src.includes(fragment),`Missing ${name}`)}
const getFunction=(start,end)=>{const i=src.indexOf(start),j=src.indexOf(end,i+start.length);assert.ok(i>=0&&j>i,'Missing function '+start);return src.slice(i,j)};
const loaderSource=getFunction('async function loadStudioData(){','function importCanonicalText(');
const loadProjectSource=getFunction('async function loadStudioProject(id){','async function refreshStudioProject()');
assert.ok(loaderSource.includes(embedded));
assert.ok(loadProjectSource.includes(embedded));
assert.ok(src.includes('No pudimos cargar todas tus obras.'));
assert.ok(src.includes("S.view==='studio'||S.view.startsWith('studio:')||S.view==='admin'"));
const data=[
 {id:'work-1',title:'Primera obra',group_id:'team-1',status:'active',novels:{title:'Primera obra'},volumes:[{id:'vol-1',status:'published',sections:[{id:'ch-1',status:'published'}]}]},
 {id:'work-2',title:'Segunda obra',group_id:'team-1',status:'paused',novels:{title:'Segunda obra'},volumes:[{id:'vol-2',status:'draft',sections:[]},{id:'vol-3',status:'published',sections:[{id:'ch-2',status:'published'}]}]}
];
let teamCalls=0;
const S={groups:[{role:'owner',translator_groups:{id:'team-1'}}],studioTranslations:[],studioCollaborationInvites:[],studioLoadError:'',admin:true};
const jreqAllRows=async path=>{
 if(path.startsWith('/rest/v1/translations?')){teamCalls++;assert.ok(path.includes(embedded),'Ambiguous volumes relationship');assert.ok(path.includes('group_id=in.(team-1)'));return data}
 if(path.startsWith('/rest/v1/translation_collaborations?'))return [];
 throw Error('Unexpected Studio path: '+path);
};
const loadData=new Function('S','jreqAllRows','friendlyError','console',loaderSource+';return loadStudioData;')(S,jreqAllRows,e=>e.message,console);
await loadData();
assert.equal(teamCalls,1);assert.equal(S.studioTranslations.length,2);
assert.equal(S.studioTranslations.reduce((n,t)=>n+t.volumes.length,0),3);
assert.equal(S.studioLoadError,'');
const failed={...S,studioTranslations:data.slice(),studioLoadError:''};
const broken=new Function('S','jreqAllRows','friendlyError','console',loaderSource+';return loadStudioData;')(failed,async p=>{if(p.includes('/rest/v1/translations?'))throw Error('PGRST201');return []},e=>e.message,{warn:()=>{}});
await assert.rejects(broken(),/PGRST201/);
assert.equal(failed.studioTranslations.length,2,'Do not discard previously loaded works on transient error');
assert.equal(failed.studioLoadError,'PGRST201');
const detailUrls=[];
const jreq=async path=>{
 detailUrls.push(path);
 if(path.includes('/rest/v1/translations?id=')){assert.ok(path.includes(embedded));return [{id:'work-1',group_id:'team-1',novels:{id:'novel-1'},volumes:[{id:'vol-1',sections:[{id:'chapter-1'}]}]}]}
 return [];
};
const loadProject=new Function('jreq',loadProjectSource+';return loadStudioProject;')(jreq);
const p=await loadProject('work-1');
assert.equal(p.volumes[0].sections[0].id,'chapter-1');
assert.equal(p.group_id,'team-1');
assert.equal(p.studioPhase2Ready,true);
assert.ok(src.includes('volumes(id,volume_number,title),sections(id,title,section_number)'),'Reading progress uses the one valid direct volumes FK');
assert.ok((src.match(/translations!volumes_translation_id_fkey\(/g)||[]).length>=3,'Admin and reading history must use explicit FK');
assert.ok((src.match(/volumes!volumes_translation_id_fkey\(/g)||[]).length>=6,'Every translations-to-volumes embed should disambiguate');
console.log('Account-to-Studio integrity OK: owner => 2 novels, 3 volumes, project detail and retry/error safeguards.');
