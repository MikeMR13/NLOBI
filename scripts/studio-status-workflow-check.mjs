import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
new Function(app);
const extract=(start,end)=>{
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Missing function region '+start);
 return app.slice(a,b);
};
for(const key of ['id="projectNovelStatus"','id="projectTranslationStatus"','id="projectSequelStatus"',
 'id="saveEditorialStates"','id="projectEditorialMode"','id="saveEditorialMode"',
 'data-studio-section-stage','data-studio-project-jump="studioProjectWorkflow"']){
 assert.ok(app.includes(key),'Missing independent editorial control '+key);
}
const novelOptions=[['ongoing','En publicación'],['completed','Completada'],['hiatus','En pausa'],['cancelled','Cancelada']];
const translationOptions=[['active','Activa'],['paused','En pausa'],['abandoned','Abandonada'],['complete','Completada'],['withdrawn','Retirada']];
const sequelOptions=[['unspecified','Sin definir'],['awaiting','En espera'],['unconfirmed','Sin secuela confirmada'],['announced','Anunciada'],['publishing','En publicación'],['completed','Completada']];
const P={id:'translation',group_id:'team',editorial_mode:false,novels:{id:'novel',status:'ongoing'},volumes:[{sections:[{id:'c1',status:'draft'}]}]};
const S={studioProject:P,revisionHistory:[1],revisionPreview:{note:true}};
const controls={
 '#projectNovelStatus':{value:'completed'},'#projectTranslationStatus':{value:'paused'},
 '#projectSequelStatus':{value:'awaiting'},'#saveEditorialStates':{disabled:false,isConnected:true},
 '#projectEditorialMode':{value:'advanced',isConnected:true},'#saveEditorialMode':{disabled:false,isConnected:true}
};
const $=id=>controls[id]||null;
const toasts=[],requests=[];
const toast=(message,type)=>toasts.push({message,type});
const request=async(path,options)=>{requests.push({path,options});return []};
const refresh=async()=>{};
const saveFactory=new Function('S','$','jreq','toast','friendlyError','teamCan',
 'NOVEL_PUBLICATION_STATES','TRANSLATION_EDITORIAL_STATES','SEQUEL_EDITORIAL_STATES',
 'loadStudioData','loadCatalog','refreshStudioProject',
 extract('async function saveEditorialStates(){','\nasync function saveTranslationStatus(')+';return saveEditorialStates;');
const save=saveFactory(S,$,request,toast,e=>e.message,()=>true,novelOptions,translationOptions,sequelOptions,refresh,refresh,refresh);
await save();
assert.equal(requests.length,1);
assert.equal(requests[0].path,'/rest/v1/rpc/update_editorial_states');
assert.deepEqual(JSON.parse(requests[0].options.body),{
 p_translation_id:'translation',p_novel_status:'completed',p_translation_status:'paused',p_sequel_status:'awaiting'
});
assert.ok(toasts.some(x=>x.type==='ok'));
controls['#projectTranslationStatus'].value='awaiting_sequel';
requests.length=0;toasts.length=0;
await save();
assert.equal(requests.length,0,'Legacy sequel states must never be saved as translation state');
assert.ok(toasts.some(x=>x.type==='bad'));
controls['#projectTranslationStatus'].value='paused';
const modeFactory=new Function('S','$','jreq','toast','friendlyError','teamCan','refreshStudioProject','loadStudioData',
 extract('async function setEditorialMode(enabled){','\nasync function loadRevisionHistory(')+';return setEditorialMode;');
let modeRows=[{id:'translation',editorial_mode:true}];
const modeCalls=[];
const setMode=modeFactory(S,$,async(path,opts)=>{modeCalls.push({path,opts});return modeRows},toast,e=>e.message,()=>true,refresh,refresh);
await setMode(true);
assert.equal(JSON.parse(modeCalls[0].opts.body).editorial_mode,true);
assert.ok(toasts.some(x=>x.type==='ok'));
modeRows=[];modeCalls.length=0;toasts.length=0;
await setMode(true);
assert.equal(controls['#projectEditorialMode'].value,'simple');
assert.ok(toasts.some(x=>x.type==='bad'));
const stageFactory=new Function('S','document','jreq','toast','friendlyError','teamCan','refreshStudioProject',
 extract('async function setStudioSectionStage(id,next){','\nasync function setStudioSectionStatus(')+';return setStudioSectionStage;');
const stageRequests=[];
const setStage=stageFactory(S,{querySelector:()=>({disabled:false,isConnected:true})},async(path,opts)=>{
 stageRequests.push({path,opts});return [{id:'c1',status:'review'}]
},toast,e=>e.message,()=>true,refresh);
await setStage('c1','review');
assert.equal(JSON.parse(stageRequests[0].opts.body).status,'review');
await setStage('c1','published');
assert.equal(stageRequests.length,1,'Publishing must use a separate protected flow');
console.log('Studio editorial flow: 3 independent states, validation, RPC, mode save, RLS confirmation, review stage OK');
