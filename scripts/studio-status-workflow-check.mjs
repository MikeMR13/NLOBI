import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
new Function(app);

function extract(start,end){
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Missing function body: '+start);
 return app.slice(a,b);
}
for(const key of [
 'id="studioProjectStatusPanel"','id="projectTranslationStatus"','id="saveTranslationStatus"',
 'id="studioNovelPublicationStatusPanel"','id="projectNovelPublicationStatus"',
 'id="saveNovelPublicationStatus"','id="studioProjectWorkflow"','id="projectEditorialMode"',
 'id="saveEditorialMode"','data-studio-section-stage',
 'data-studio-project-jump="studioNovelPublicationStatusPanel"'
])assert.ok(app.includes(key),'Missing UI control: '+key);

const P={
 id:'translation',group_id:'team',status:'active',editorial_mode:false,
 studioPhase2Ready:false,novels:{id:'novel1',status:'ongoing'},
 volumes:[{sections:[{id:'c1',status:'draft'}]}]
};
const S={studioProject:P,revisionHistory:[1],revisionPreview:{note:true}};
const elements={
 '#projectTranslationStatus':{value:'paused',isConnected:true},
 '#saveTranslationStatus':{disabled:false,isConnected:true},
 '#projectEditorialMode':{value:'advanced',isConnected:true},
 '#saveEditorialMode':{disabled:false,isConnected:true},
 '#projectNovelPublicationStatus':{value:'completed',isConnected:true},
 '#saveNovelPublicationStatus':{disabled:false,isConnected:true}
};
const $=selector=>elements[selector]||null;
const toasts=[];
const toast=(message,type)=>toasts.push({message,type});
const friendlyError=error=>error?.message||String(error);
const allowed=()=>true,refresh=async()=>{},reload=async()=>{};
const translationOptions=[
 ['active','Activa'],['paused','En pausa'],['abandoned','Abandonada'],
 ['complete','Completada'],['awaiting_sequel','En espera de secuela'],
 ['no_sequel_confirmed','Sin secuela confirmada']
];
const novelOptions=[
 ['ongoing','En publicación'],['completed','Completada'],
 ['hiatus','En pausa'],['cancelled','Cancelada']
];
const label=options=>key=>Object.fromEntries(options)[key]||key;

let responses=[{id:'translation',status:'paused'}],requests=[];
const request=async(url,options)=>{requests.push({url,options});return responses};
const statusFactory=new Function(
 'S','$','jreq','toast','friendlyError','teamCan','TRANSLATION_STATUS_OPTIONS',
 'translationStatusLabel','loadStudioData','loadCatalog','refreshStudioProject',
 extract('async function saveTranslationStatus(){','\nasync function saveNovelPublicationStatus(')
 +';return saveTranslationStatus;'
);
const saveStatus=statusFactory(
 S,$,request,toast,friendlyError,allowed,translationOptions,label(translationOptions),reload,reload,refresh
);
await saveStatus();
assert.equal(requests.length,1);
assert.equal(JSON.parse(requests[0].options.body).status,'paused');
assert.ok(!Object.hasOwn(JSON.parse(requests[0].options.body),'auto_status_source_volume_id'));
assert.equal(requests[0].options.headers.Prefer,'return=representation');
assert.ok(toasts.some(x=>x.type==='ok'));

requests=[];toasts.length=0;
elements['#projectTranslationStatus'].value='awaiting_sequel';
await saveStatus();
assert.equal(requests.length,0,'Do not save sequel states before phase 2 migration');
assert.ok(toasts.some(x=>x.type==='bad'));

responses=[];requests=[];toasts.length=0;
elements['#projectTranslationStatus'].value='complete';
await saveStatus();
assert.ok(toasts.some(x=>x.type==='bad'),'Zero-row RLS update must not report success');
assert.equal(elements['#projectTranslationStatus'].value,'active');

P.studioPhase2Ready=true;responses=[{id:'translation',status:'complete'}];requests=[];
elements['#projectTranslationStatus'].value='complete';
await saveStatus();
const payload=JSON.parse(requests[0].options.body);
assert.equal(payload.auto_status_source_volume_id,null);
assert.equal(payload.auto_status_previous_status,null);

const modeFactory=new Function(
 'S','$','jreq','toast','friendlyError','teamCan',
 'refreshStudioProject','loadStudioData',
 extract('async function setEditorialMode(enabled){','\nasync function loadRevisionHistory(')
 +';return setEditorialMode;'
);
let modeResponse=[{id:'translation',editorial_mode:true}],modeRequests=[];
const saveMode=modeFactory(
 S,$,async(u,o)=>{modeRequests.push({u,o});return modeResponse},
 toast,friendlyError,allowed,refresh,reload
);
await saveMode(true);
assert.equal(JSON.parse(modeRequests[0].o.body).editorial_mode,true);
modeResponse=[];modeRequests=[];toasts.length=0;
await saveMode(true);
assert.equal(elements['#projectEditorialMode'].value,'simple');
assert.ok(toasts.some(x=>x.type==='bad'));

const novelFactory=new Function(
 'S','$','jreq','toast','friendlyError','teamCan','NOVEL_PUBLICATION_STATUS_OPTIONS',
 'novelPublicationStatusLabel','loadStudioData','loadCatalog','refreshStudioProject',
 extract('async function saveNovelPublicationStatus(){','\nasync function saveDiscoveryMeta(')
 +';return saveNovelPublicationStatus;'
);
let novelResponse=[{id:'novel1',status:'completed'}],novelRequests=[];
const saveNovel=novelFactory(
 S,$,async(u,o)=>{novelRequests.push({u,o});return novelResponse},
 toast,friendlyError,allowed,novelOptions,label(novelOptions),reload,reload,refresh
);
await saveNovel();
assert.equal(novelRequests.length,1);
assert.ok(novelRequests[0].u.includes('/rest/v1/novels?id=eq.novel1'));
assert.equal(JSON.parse(novelRequests[0].o.body).status,'completed');
novelResponse=[];novelRequests=[];toasts.length=0;
elements['#projectNovelPublicationStatus'].value='hiatus';
await saveNovel();
assert.equal(elements['#projectNovelPublicationStatus'].value,'ongoing');
assert.ok(toasts.some(x=>x.type==='bad'));

const stageFactory=new Function(
 'S','document','jreq','toast','friendlyError','teamCan','refreshStudioProject',
 extract('async function setStudioSectionStage(id,next){','\nasync function setStudioSectionStatus(')
 +';return setStudioSectionStage;'
);
const documentStub={querySelector:()=>({disabled:false,isConnected:true})};
const stageRequests=[];
const saveStage=stageFactory(
 S,documentStub,async(u,o)=>{stageRequests.push({u,o});return [{id:'c1',status:'review'}]},
 toast,friendlyError,allowed,refresh
);
await saveStage('c1','review');
assert.equal(JSON.parse(stageRequests[0].o.body).status,'review');
await saveStage('c1','published');
assert.equal(stageRequests.length,1,'Publication requires protected publish flow');

console.log('Studio status and editorial workflow regression passed: original, translation, mode, team permissions, RLS zero-row checks and chapter stages.');
