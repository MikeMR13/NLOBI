import assert from 'node:assert/strict';
import fs from 'node:fs';

const src=fs.readFileSync('src/studio-board-phase3.js','utf8');
const studio=fs.readFileSync('src/studio-phase5.js','utf8');
const app=fs.readFileSync('src/app.js','utf8');
const css=fs.readFileSync('src/studio-board-phase3.css','utf8');
const build=fs.readFileSync('scripts/build.mjs','utf8');
const sw=fs.readFileSync('public/sw.js','utf8');
const split=fs.readFileSync('scripts/split-studio-views.mjs','utf8');
assert.ok(split.includes("modules.find(module=>typeof module?.createStudioViews==='function')"),'El chunk de Studio debe resolverse por export y no por índice');
assert.ok(!split.includes('modules[4].createStudioViews'),'No usar índices rígidos de Promise.all');
new Function(src);new Function(studio);new Function(app);

const root={};new Function('window',src)(root);
assert.equal(typeof root.createStudioBoardPhase3,'function');
const group='11111111-1111-4111-8111-111111111111',foreign='22222222-2222-4222-8222-222222222222';
const owner='33333333-3333-4333-8333-333333333333',coworker='44444444-4444-4444-8444-444444444444';
const sections=[
 {id:'s1',title:'Capítulo <uno>',status:'draft',section_number:1,updated_at:'2026-10-10T12:00:00Z'},
 {id:'s2',title:'Capítulo dos',status:'draft',section_number:2,updated_at:'2026-10-10T12:00:00Z'},
 {id:'s3',title:'Capítulo tres',status:'draft',section_number:3,updated_at:'2026-10-10T12:00:00Z'},
 {id:'s4',title:'Capítulo cuatro',status:'draft',section_number:4,updated_at:'2026-10-10T12:00:00Z'},
 {id:'s5',title:'Capítulo cinco',status:'published',section_number:5,updated_at:'2026-10-10T12:00:00Z'}
];
const state={user:{id:owner},groups:[{translator_groups:{id:group,name:'Equipo autor'}}],studioTranslations:[
 {id:'p1',group_id:group,novels:{title:'Obra <real>'},volumes:[{id:'v1',title:'Volumen',volume_number:1,sections}]},
 {id:'p2',group_id:foreign,novels:{title:'OBRA PRIVADA EXTERNA'},volumes:[{id:'v2',volume_number:1,sections:[{id:'secret',title:'CAPITULO EXTERNO',status:'draft'}]}]}
]};
const records={
 tasks:[{id:'task1',group_id:group,title:'Revisar <título>',status:'todo',created_by:owner,assigned_to:null,updated_at:'2026-10-10T12:00:00Z'}],
 members:[{group_id:group,user_id:owner,profiles:{display_name:'Propietario'}},{group_id:group,user_id:coworker,profiles:{display_name:'Corrector'}}],
 reviews:[
 {id:'rev2',group_id:group,section_id:'s2',status:'pending',assigned_to:coworker,created_at:'2026-10-11T12:00:00Z'},
 {id:'rev3',group_id:group,section_id:'s3',status:'changes_requested',created_at:'2026-10-11T12:00:00Z'},
 {id:'rev4',group_id:group,section_id:'s4',status:'approved',created_at:'2026-10-11T12:00:00Z',reviewed_at:'2026-10-11T18:00:00Z'}
 ],
 events:[{id:'event1',group_id:group,summary:'Publicado & revisado',event_type:'volume_published',created_at:'2026-10-12T18:00:00Z'}]
};
let current='all',reloads=0;const patches=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const board=root.createStudioBoardPhase3({S:state,esc,teamCan:()=>true,isManager:()=>true,
 jreq:async(path,options)=>{patches.push({path,options});return[]},
 toast:()=>{},friendlyError:String,openProject:()=>{},getData:()=>records,getTeamFilter:()=>current,refresh:async()=>{reloads++}});
const view=board.view();
for(const title of ['Tablero de capítulos','Traducción','En revisión','Correcciones','Listo','Publicado','Bitácora editorial integrada','Corrector','Publicado &amp; revisado'])
 assert.ok(view.includes(title),'Falta '+title);
assert.ok(view.includes('Capítulo &lt;uno&gt;')&&!view.includes('Capítulo <uno>'),'Debe escapar títulos');
assert.ok(!view.includes('OBRA PRIVADA EXTERNA')&&!view.includes('CAPITULO EXTERNO'),'Nunca mostrar otras obras del equipo');
assert.equal(board.chapters().length,5);
assert.equal(board.stage(sections[0],null),'draft');
assert.equal(board.stage(sections[1],records.reviews[0]),'review');
assert.equal(board.stage(sections[2],records.reviews[1]),'changes');
assert.equal(board.stage(sections[3],records.reviews[2]),'ready');
assert.equal(board.stage(sections[4],null),'published');
assert.equal(board.stage({...sections[3],updated_at:'2026-10-13T12:00:00Z'},records.reviews[2]),'draft','No aprobar cambios posteriores a la revisión');
assert.ok(board.taskAssigneeControl(records.tasks[0]).includes('data-board-assignee'));
await board.reassign('task1',foreign);
assert.equal(patches.length,0,'Bloquear personas ajenas');
await board.reassign('task1',coworker);
assert.equal(patches.length,1);
assert.equal(JSON.parse(patches[0].options.body).assigned_to,coworker);
assert.equal(reloads,1);
current=foreign;
assert.equal(board.chapters().length,0,'Filtrado por equipo respeta permisos');
for(const key of ["createStudioBoardPhase3","editorial_publication_events?","chapterBoard?.bind()"])assert.ok(studio.includes(key),'Integración Studio: '+key);
for(const key of ["studio-board-phase3.js","studio-board-phase3.css"])assert.ok(build.includes(key)&&sw.includes(key),'Assets '+key);
assert.ok(app.includes("import('/assets/studio-board-phase3.js')"));
assert.ok(css.includes('.studioV8Board'));
console.log('Fase 3 OX-MR: tablero, roles, bitácora, asignación y assets OK');
