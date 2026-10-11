import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
new Function(app);
function extract(start,end){const a=app.indexOf(start),b=app.indexOf(end,a+start.length);assert.ok(a>=0&&b>a,'Missing '+start);return app.slice(a,b)}
for(const term of ['id="studioProjectStatusPanel"','id="saveTranslationStatus"','id="projectEditorialMode"','id="saveEditorialMode"','id="studioProjectWorkflow"','id="studioProjectWorkflowTitle"','data-studio-section-stage','id="studioProjectFilter"','id="studioWorkflowFilter"','Estado de traducción (filtro)','Estado de capítulos (filtro)','studioPhase2Ready'])assert.ok(app.includes(term),'Missing UI '+term);
assert.ok(!app.includes("id=\"editorialModeToggle\""),'Old unverified toggle should be replaced');
assert.ok(css.includes('.studioWorkflowEditorControls')&&css.includes('.studioProjectStatusPanel'));

const P={id:'translation',group_id:'team',status:'active',editorial_mode:false,studioPhase2Ready:false,volumes:[{sections:[{id:'c1',status:'draft'}]}]};
const S={studioProject:P,revisionHistory:[1],revisionPreview:{a:1}},records=[],toasts=[];
const element={
 '#projectTranslationStatus':{value:'paused',isConnected:true},
 '#saveTranslationStatus':{disabled:false,isConnected:true},
 '#projectEditorialMode':{value:'advanced',isConnected:true},
 '#saveEditorialMode':{disabled:false,isConnected:true},
};
const $=id=>element[id]||null;
const toast=(message,type)=>toasts.push({message,type});
const friendlyError=(e)=>e.message||String(e);
let calls=[],savedRows=[{id:'translation',status:'paused'}];
const jreq=async (path,opts)=>{calls.push({path,opts});return savedRows};
const factory=new Function('S','$','jreq','toast','friendlyError','teamCan','TRANSLATION_STATUS_OPTIONS','translationStatusLabel','loadStudioData','loadCatalog','refreshStudioProject',extract('async function saveTranslationStatus(){','\nasync function saveDiscoveryMeta(')+';return saveTranslationStatus;');
const statuses=[['active','Activa'],['paused','En pausa'],['abandoned','Abandonada'],['complete','Completada'],['awaiting_sequel','En espera de secuela'],['no_sequel_confirmed','Sin secuela confirmada']];
const saveStatus=factory(S,$,jreq,toast,friendlyError,()=>true,statuses,v=>Object.fromEntries(statuses)[v],async()=>{},async()=>{},async()=>{});
await saveStatus();
assert.equal(calls.length,1);assert.equal(calls[0].opts.method,'PATCH');
assert.equal(JSON.parse(calls[0].opts.body).status,'paused');
assert.ok(!Object.hasOwn(JSON.parse(calls[0].opts.body),'auto_status_source_volume_id'),'Legacy databases cannot accept final-volume columns');
assert.ok(calls[0].opts.headers.Prefer==='return=representation');
assert.ok(toasts.some(t=>t.type==='ok'));

calls=[];toasts=[];element['#projectTranslationStatus'].value='awaiting_sequel';
await saveStatus();
assert.equal(calls.length,0,'Extended status must not be sent before schema update');
assert.ok(toasts.some(t=>t.type==='bad'));

element['#projectTranslationStatus'].value='complete';savedRows=[];toasts=[];await saveStatus();
assert.ok(toasts.some(t=>t.type==='bad'),'Empty affected rows must not report success');
assert.equal(element['#projectTranslationStatus'].value,'active','Status must roll back after unconfirmed update');
P.studioPhase2Ready=true;element['#projectTranslationStatus'].value='complete';calls=[];savedRows=[{id:'translation',status:'complete'}];
await saveStatus();const extendedBody=JSON.parse(calls[0].opts.body);
assert.equal(extendedBody.auto_status_source_volume_id,null);
assert.equal(extendedBody.auto_status_previous_status,null);

const flowFactory=new Function('S','$','jreq','toast','friendlyError','teamCan','refreshStudioProject','loadStudioData',extract('async function setEditorialMode(enabled){','\nasync function loadRevisionHistory(')+';return setEditorialMode;');
let flowRows=[{id:'translation',editorial_mode:true}],flowCalls=[];
const flowJreq=async (url,opts)=>{flowCalls.push({url,opts});return flowRows};
const saveFlow=flowFactory(S,$,flowJreq,toast,friendlyError,()=>true,async()=>{},async()=>{});
await saveFlow(true);assert.equal(flowCalls.length,1);
assert.equal(JSON.parse(flowCalls[0].opts.body).editorial_mode,true);
assert.equal(flowCalls[0].opts.headers.Prefer,'return=representation');
flowRows=[];toasts=[];flowCalls=[];await saveFlow(true);
assert.equal(element['#projectEditorialMode'].value,'simple');
assert.ok(toasts.some(t=>t.type==='bad'),'Flow must reject silent zero-row updates');

const stageSource=extract('async function setStudioSectionStage(id,next){','\nasync function setStudioSectionStatus(');
const stageFactory=new Function('S','document','jreq','toast','friendlyError','teamCan','refreshStudioProject',stageSource+';return setStudioSectionStage;');
const doc={querySelector:()=>({disabled:false,isConnected:true})};
let stages=[{id:'c1',status:'review'}],stageCalls=[];
const stage=stageFactory(S,doc,async(u,o)=>{stageCalls.push({u,o});return stages},toast,friendlyError,()=>true,async()=>{});
await stage('c1','review');assert.equal(stageCalls.length,1);
assert.equal(JSON.parse(stageCalls[0].o.body).status,'review');
assert.equal(JSON.parse(stageCalls[0].o.body).published_at,null);
await stage('c1','published');assert.equal(stageCalls.length,1,'Publishing must use separate protected flow');
assert.ok(app.includes('id="studioNovelPublicationStatusPanel"'));
assert.ok(app.includes('id="studioNovelPublicationFilter"'));
assert.ok(app.includes('id="saveNovelPublicationStatus"'));
assert.ok(app.includes("novels(id,title,title_original,author_name,cover_url,novel_type,genres,status)"),'Real Studio catalog must load original novel status');
assert.ok(app.includes("novelPublicationStatusLabel(novel.status)"),'Search needs the original novel state');

P.novels={id:'novel1',status:'ongoing'};
const novelElement={value:'completed',isConnected:true};
element['#projectNovelPublicationStatus']=novelElement;
element['#saveNovelPublicationStatus']={disabled:false,isConnected:true};
const novelStatusFactory=new Function('S',','friendlyError','teamCan','NOVEL_PUBLICATION_STATUS_OPTIONS','novelPublicationStatusLabel','loadStudioData','loadCatalog','refreshStudioProject',
 extract('async function saveNovelPublicationStatus(){','\nasync function saveDiscoveryMeta(')+';return saveNovelPublicationStatus;');
let savedNovel=[{id:'novel1',status:'completed'}],novelCalls=[];
const novelJreq=async(url,opts)=>{novelCalls.push({url,opts});return savedNovel};
const statusesNovel=[['ongoing','En publicación'],['completed','Completada'],['hiatus','En pausa'],['cancelled','Cancelada']];
const saveNovel=novelStatusFactory(S,$,novelJreq,toast,friendlyError,()=>true,statusesNovel,
 v=>Object.fromEntries(statusesNovel)[v],async()=>{},async()=>{},async()=>{});
await saveNovel();
assert.equal(novelCalls.length,1);
assert.ok(novelCalls[0].url.includes('/rest/v1/novels?id=eq.novel1'));
assert.equal(JSON.parse(novelCalls[0].opts.body).status,'completed');
savedNovel=[];novelCalls=[];novelElement.value='hiatus';toasts=[];
await saveNovel();
assert.equal(novelElement.value,'ongoing','Original novel status must roll back on unconfirmed update');
assert.ok(toasts.some(t=>t.type==='bad'),'Refuse silent RLS zero-row response');
console.log('Studio status/workflow regression OK: editable controls, legacy migration guard, verified PATCH, rollback and draft/review stage.');
,'jreq','toast','friendlyError','teamCan','NOVEL_PUBLICATION_STATUS_OPTIONS','novelPublicationStatusLabel','loadStudioData','loadCatalog','refreshStudioProject',
 extract('async function saveNovelPublicationStatus(){','\nasync function saveDiscoveryMeta(')+';return saveNovelPublicationStatus;');
let savedNovel=[{id:'novel1',status:'completed'}],novelCalls=[];
const novelJreq=async(url,opts)=>{novelCalls.push({url,opts});return savedNovel};
const statusesNovel=[['ongoing','En publicación'],['completed','Completada'],['hiatus','En pausa'],['cancelled','Cancelada']];
const saveNovel=novelStatusFactory(S,$,novelJreq,toast,friendlyError,()=>true,statusesNovel,
 v=>Object.fromEntries(statusesNovel)[v],async()=>{},async()=>{},async()=>{});
await saveNovel();
assert.equal(novelCalls.length,1);
assert.ok(novelCalls[0].url.includes('/rest/v1/novels?id=eq.novel1'));
assert.equal(JSON.parse(novelCalls[0].opts.body).status,'completed');
savedNovel=[];novelCalls=[];novelElement.value='hiatus';toasts=[];
await saveNovel();
assert.equal(novelElement.value,'ongoing','Original novel status must roll back on unconfirmed update');
assert.ok(toasts.some(t=>t.type==='bad'),'Refuse silent RLS zero-row response');
console.log('Studio status/workflow regression OK: editable controls, legacy migration guard, verified PATCH, rollback and draft/review stage.');
