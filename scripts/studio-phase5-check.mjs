import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const app=read('src/app.js'),engine=read('src/studio-phase5.js');
const css=read('src/styles.css'),html=read('src/index.html');
const build=read('scripts/build.mjs'),sw=read('public/sw.js');
const migration=read('supabase/migrations/20261010231000_studio_phase5_editorial_tasks.sql');

new Function(app);
const root={};new Function('window',engine)(root);
assert.equal(typeof root.createStudioPhase5,'function');
assert.match(app,/'studio:work'/);
assert.match(app,/studioWorkflow\?\.view/);
assert.match(app,/studioWorkflow\?\.bind/);
assert.match(html,/\/assets\/studio-phase5\.js/);
assert.match(build,/studio-phase5\.js/);
assert.match(sw,/studio-phase5\.js/);
assert.match(css,/\.studioV5Grid/);
assert.match(css,/@media\(max-width:480px\)/);
for(const feature of ['enable row level security','editorial_tasks_team_read','editorial_tasks_team_create','editorial_tasks_team_update','created_by','group_id','assigned_to','translation_id','validate_editorial_task','revoke all on public.editorial_tasks from anon'])assert.ok(migration.includes(feature),'Missing team-scoped migration rule: '+feature);

const gid='11111111-1111-4111-8111-111111111111';
const pid='22222222-2222-4222-8222-222222222222';
const uid='33333333-3333-4333-8333-333333333333';
const sid='44444444-4444-4444-8444-444444444444';
const state={view:'studio:work',user:{id:uid},groups:[{translator_groups:{id:gid,name:'Equipo editorial'}}],
 studioTranslations:[{id:pid,group_id:gid,novels:{title:'Obra de prueba'},volumes:[{id:'vol1',sections:[{id:sid}]}]}]};
const requests=[];
const data={
 tasks:[{id:'task1',group_id:gid,translation_id:pid,title:'Revisar <capítulo>',details:'Notas internas',
  priority:'high',status:'todo',assigned_to:uid,created_by:uid,updated_at:'2026-10-10T12:00:00Z',due_at:'2026-10-15T12:00:00Z'}],
 reviews:[{id:'rev1',group_id:gid,section_id:sid,status:'pending',requested_by:'other-user',assigned_to:uid,created_at:'2026-10-10T12:00:00Z',request_note:'Revisar furigana'}],
 schedule:[{id:'schedule1',group_id:gid,volume_id:'vol1',status:'pending',scheduled_at:'2026-10-20T12:00:00Z'}],
 members:[{group_id:gid,user_id:uid,role:'proofreader',profiles:{display_name:'Correctora'}}]
};
const jreq=async(path,opt)=>{
 requests.push({path,opt});
 if(opt?.method)return[];
 if(path.includes('/editorial_tasks?'))return data.tasks;
 if(path.includes('/editorial_review_requests?'))return data.reviews;
 if(path.includes('/volume_publication_schedule?'))return data.schedule;
 if(path.includes('/group_members?'))return data.members;
 throw new Error('Unexpected query '+path);
};
const controls=new Map();let rendered=0;
const workspace=root.createStudioPhase5({S:state,nav:()=>'',status:()=>'',context:()=>'',esc:s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),
 jreq,toast:()=>{},friendlyError:e=>String(e),render:()=>{rendered++},$:s=>controls.get(s)||null,$$:()=>[],teamCan:()=>true,isManager:()=>false,openProject:()=>{},roleLabel:x=>x});
await workspace.load();
const view=workspace.view();
for(const phrase of ['Bandeja de tareas','Revisiones editoriales','Calendario editorial','Actividad reciente','Crear tarea editorial','Obra de prueba','Revisar furigana'])assert.ok(view.includes(phrase),'Missing component '+phrase);
assert.ok(view.includes('Revisar &lt;capítulo&gt;'),'Task titles must be HTML-escaped');
assert.ok(!view.includes('<capítulo>'),'Unsafe task title interpolation');
assert.ok(rendered>0,'Async load should refresh the desk');
assert.equal(requests.length,4,'Load only needed team-scoped collections');
for(const req of requests)assert.ok(req.path.includes('group_id=in.('+gid+')'),'Private data must be scoped to authorized groups');

const button={disabled:false,isConnected:true};
for(const [selector,value] of [['#workNewGroup',gid],['#workNewTitle','Corregir capítulo 4'],['#workNewDetails','Trabajo del equipo'],['#workNewPriority','normal'],['#workNewProject',pid],['#workNewAssignee',uid],['#workNewDue','']])controls.set(selector,{value});
controls.set('#workCreate',button);
workspace.bind();assert.equal(typeof button.onclick,'function');
await button.onclick();
const inserted=requests.find(r=>r.opt?.method==='POST');
assert.ok(inserted,'Task create should POST to Supabase');
assert.equal(inserted.path,'/rest/v1/editorial_tasks');
assert.equal(JSON.parse(inserted.opt.body).group_id,gid);
assert.equal(JSON.parse(inserted.opt.body).assigned_to,uid);
assert.equal(button.disabled,false);

console.log('Studio Fase 5 OK: secured team desk, tasks, reviews, calendar, history, asset integration and validation.');
