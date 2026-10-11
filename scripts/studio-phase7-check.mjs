import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const source=read('src/studio-phase7.js'),app=read('src/app.js'),html=read('src/index.html');
const build=read('scripts/build.mjs'),sw=read('public/sw.js'),css=read('src/styles.css');
const sql=read('supabase/migrations/20261011062000_studio_phase7_publication_launches.sql');
new Function(source);new Function(app);
const win={};new Function('window',source)(win);
assert.equal(typeof win.createStudioPhase7,'function');
for(const str of ["studioLaunch?.bind()","studioLaunch?.summary(P)","studioLaunch.review('volume',id)","studioLaunch.review('section',id)","studioLaunch.review('schedule',id,date)","editorial_publication_events?translation_id=eq."]){
 assert.ok(app.includes(str),'Missing integration '+str);
}
for(const key of ['studio-phase7.js','studioV7Hub','studioV7Dialog'])assert.ok((html+build+css+sw).includes(key),'Missing asset '+key);
for(const key of ['enable row level security','editorial_events_team_read','studio_publication_audit_volumes','studio_publication_audit_sections','studio_publication_audit_schedule','schedule_rescheduled','trg_notify_volume_published','nlobi.batch_publishing_volume','volume_schedule_one_pending_per_volume']){
 assert.ok(sql.includes(key),'Missing database protection '+key);
}
assert.ok(sql.includes("grant select on public.editorial_publication_events to authenticated"));
assert.ok(!/grant\s+(?:insert|update|delete)[^;]*editorial_publication_events\s+to\s+authenticated/i.test(sql));

const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const gid='11111111-1111-4111-8111-111111111111',uid='33333333-3333-4333-8333-333333333333';
const project={id:'p1',group_id:gid,status:'active',title:'Prueba',novels:{title:'Novela <ejemplo>'},translator_groups:{name:'Mi equipo',avatar_url:'logo.png',review_required:true},volumes:[
 {id:'v1',volume_number:1,title:'Volumen 1',status:'draft',is_final_volume:true,final_translation_status:'complete',sections:[
 {id:'s1',title:'Capítulo uno',status:'draft',section_number:1,sort_order:1,content:[{type:'paragraph',text:'Hello'}]},
 {id:'s2',title:'Capítulo dos',status:'draft',section_number:2,sort_order:2,content:[{type:'ruby',base:'猫',reading:'ねこ'}]}]},
 {id:'v2',volume_number:2,title:'Volumen 2',status:'draft',sections:[]}
],publication_schedules:[],review_requests:[{section_id:'s1',status:'approved',created_at:'2026-10-11T10:00:00Z'},{section_id:'s2',status:'approved',created_at:'2026-10-11T10:00:00Z'}],
 publication_events:[{id:'e1',event_type:'volume_hidden',summary:'Ocultado',created_at:'2026-10-11T09:00:00Z',actor_user_id:uid}]};
const S={user:{id:uid},groups:[{translator_groups:{id:gid}}],studioProject:project,readerPrefs:{fontSize:20,align:'justify'}};
const requests=[],toasts=[];
const mod=win.createStudioPhase7({S,esc:escape,$:()=>null,$$:()=>[],jreq:async (...args)=>{requests.push(args);return []},toast:(t)=>toasts.push(t),friendlyError:e=>String(e),teamCan:()=>true,
 renderReaderBlock:b=>'<p>'+escape(b.text||b.base||'')+'</p>',safeMediaUrl:x=>x,studioVolumeQuality:v=>({issues:(v.sections||[]).length?[]:['Sin capítulos'],warnings:[]}),
 studioSectionQuality:s=>({issues:(s.content||[]).length?[]:['Capítulo vacío'],warnings:[]}),refreshProject:async()=>{},loadCatalog:async()=>{}});
const report=mod.publicationStats(project);
assert.deepEqual(report,{volumes:0,sections:0,pending:0,failed:0});
const view=mod.summary(project);
for(const phrase of ['Centro de publicaciones','Cola de publicaciones','Historial de publicaciones','Vista previa del lector','Anuncios automáticos'])assert.ok(view.includes(phrase),'UI missing '+phrase);
assert.ok(view.includes('Volumen 1'));
assert.ok(view.includes('Volumen ocultado'));
assert.ok(!view.includes('<ejemplo>'),'User-controlled titles should be escaped');
assert.equal(mod.readiness(project,'volume','v1').allowed,true);
assert.ok(mod.readiness(project,'volume','v2').errors.length);
assert.equal(mod.readiness(project,'section','s1').allowed,true);

project.publication_schedules.push({id:'sched1',volume_id:'v1',status:'pending',scheduled_at:'2026-10-15T12:00:00Z'});
assert.equal(mod.readiness(project,'volume','v1').allowed,false,'Do not publish over pending schedule');
assert.equal(mod.readiness(project,'schedule','v1').allowed,false,'Reject duplicate pending schedule');
const q=mod.summary(project);
assert.ok(q.includes('Reprogramar'));
assert.ok(q.includes('Cancelar'));
assert.ok(q.includes('2026'));
project.publication_schedules=[];
project.review_requests=[{section_id:'s1',status:'pending',created_at:'2026-10-11T12:00:00Z'}];
assert.equal(mod.readiness(project,'volume','v1').allowed,false,'Required approvals must be checked for all sections');
assert.equal(mod.readiness(project,'section','s1').allowed,false,'Required approval for individual section');

console.log('Studio phase 7 checks OK: quality gate, permissions, event feed, schedule dedupe, safe HTML and assets.');
