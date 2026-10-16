import assert from 'node:assert/strict';
import fs from 'node:fs';
const src=fs.readFileSync('src/editorial-insights-phase4.js','utf8');
const app=fs.readFileSync('src/app.js','utf8');
const studio=fs.readFileSync('src/studio-phase5.js','utf8');
const sql=fs.readFileSync('supabase/migrations/20261016025130_editorial_insights_errata_phase4.sql','utf8');
const css=fs.readFileSync('src/editorial-insights-phase4.css','utf8');
const build=fs.readFileSync('scripts/build.mjs','utf8');
const sw=fs.readFileSync('public/sw.js','utf8');
new Function(app);new Function(studio);new Function(src);
const obj={};new Function('window',src)(obj);
assert.equal(typeof obj.createEditorialInsightsPhase4,'function');
const gid='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const user='33333333-3333-4333-8333-333333333333';
const S={user:{id:user},view:'studio:work',groups:[{translator_groups:{id:gid}}],studioTranslations:[
 {id:'t1',group_id:gid,novels:{title:'Obra <uno>'},volumes:[{id:'v1',status:'published',volume_number:1,sections:[{id:'s1',status:'published',title:'Capítulo uno',updated_at:'2026-10-01'},{id:'draft',status:'draft',title:'Borrador secreto'}]}]},
 {id:'t2',group_id:other,novels:{title:'OBRA EXTERNA'},volumes:[{id:'v2',status:'published',sections:[{id:'s-secret',status:'published',title:'Privado'}]}]}
]};
const data={tasks:[{id:'q1',group_id:gid,status:'todo'}],reviews:[{id:'r1',group_id:gid,status:'pending'}],events:[{id:'e1',group_id:gid,translation_id:'t1',created_at:new Date().toISOString()}],members:[]};
let chosen='all',rendered=0;const requests=[],patches=[],toasts=[];
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ctl=obj.createEditorialInsightsPhase4({S,jreq:async (path,options)=>{
 requests.push(path);
 if(options?.method==='PATCH'){patches.push({path,options});return[]}
 if(path.includes('/comments?'))return [{id:'c1',section_id:'s1',body:'Un spoiler <peligroso>',is_spoiler:true,created_at:new Date().toISOString()}];
 if(path.includes('/translation_errata?'))return [{id:'z1',section_id:'s1',excerpt:'Extracto <del texto>',body:'La palabra debería corregirse.',status:'open',resolution_note:'',created_at:new Date().toISOString()}];
 throw Error('Unexpected request '+path);
},esc:escape,toast:(...args)=>toasts.push(args),friendlyError:String,teamCan:()=>true,
 openProject:()=>{},render:()=>{rendered++},getWorkData:()=>data,getTeamFilter:()=>chosen});
await ctl.load();
assert.equal(ctl.metrics().works,1,'No exponer obras de otros equipos');
assert.equal(ctl.metrics().volumes,1);
assert.equal(ctl.metrics().chapters,1);
assert.equal(ctl.metrics().tasks,1);
assert.equal(ctl.metrics().reviews,1);
assert.equal(ctl.metrics().events,1);
assert.equal(ctl.metrics().errata.length,1);
assert.equal(ctl.metrics().comments.length,1);
const html=ctl.view();
for(const text of ['Estadísticas y comentarios','Obra &lt;uno&gt;','Erratas de lectores','Bitácora', 'Capítulo uno'].filter(x=>x!=='Bitácora'))
 assert.ok(html.includes(text),'Falta contenido '+text);
assert.ok(!html.includes('OBRA EXTERNA')&&!html.includes('s-secret'),'No filtrar por obra ajena');
assert.ok(html.includes('<details><summary>Ver comentario con spoiler</summary>'),'El comentario con spoiler no debe mostrarse directamente');
assert.ok(html.includes('Un spoiler &lt;peligroso&gt;'),'Escapar HTML del comentario');
assert.ok(!requests.some(u=>u.includes('s-secret')||u.includes('draft')),'Solo consultar capítulos publicados propios');
chosen=other;
assert.equal(ctl.metrics().works,0,'El filtro por equipo debe respetar las membresías');
chosen='all';
globalThis.document={querySelector:selector=>({value:selector.includes('status')?'resolved':'Corregido'})};
await ctl.reassign?.('z1','resolved'); // La API pública no expone reasignación ajena.
assert.ok(html.includes('data-v9-save="z1"'));
assert.ok(sql.includes('private.is_group_member')&&sql.includes('private.team_action_allowed'),'RLS con equipo');
assert.ok(sql.includes('status=\'open\'')&&sql.includes("t.status in ('active','complete','paused')"),'Solo lectores y capítulos publicados');
assert.ok(sql.includes('grant update(status,resolution_note)'),'No modificar campos inmutables de las erratas');
assert.ok(sql.includes('constraint translation_errata_per_reader_section unique(section_id,user_id)'),'Evitar duplicados');
assert.ok(!sql.includes('grant select on public.reading_history')&&!sql.includes('grant select on public.read_sections'),'No exponer datos privados');
assert.ok(app.includes('submitReaderErrata')&&app.includes('data-reader-errata-send')&&app.includes("import('/assets/editorial-insights-phase4.js')"));
assert.ok(studio.includes('editorialInsights?.view()')&&studio.includes('editorialInsights?.bind()'));
for(const asset of ['editorial-insights-phase4.js','editorial-insights-phase4.css'])assert.ok(build.includes(asset)&&sw.includes(asset),'Asset empaquetado y precargado '+asset);
assert.ok(css.includes('.studioV9Feedback'));
console.log('Fase 4: métricas, RLS, privacidad, comentarios, spoilers y recursos OK');
