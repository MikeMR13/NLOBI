import assert from 'node:assert/strict';
import fs from 'node:fs';
const releaseSource=fs.readFileSync('src/releases-phase2.js','utf8');
const studioSource=fs.readFileSync('src/studio-phase7.js','utf8');
const store=new Map();
const localStorage={getItem:key=>store.get(key)||null,setItem:(key,value)=>store.set(key,value)};
const win={};
new Function('window','localStorage',releaseSource)(win,localStorage);
assert.equal(typeof win.createReleasesPhase2,'function');
const now=new Date().toISOString();
const catalog=[
 {id:'t1',title:'Obra uno',novels:{title:'Obra uno'},translator_groups:{id:'g1',name:'Equipo A'}},
 {id:'t2',title:'Obra dos',novels:{title:'Obra dos'},translator_groups:{id:'g2',name:'Equipo B'}}
];
const S={user:{id:'reader1'},follows:[{target_type:'translation',target_id:'t1'}],readSections:['c1'],
 publishedVolumes:[{id:'v1',translation_id:'t1',title:'Libro primero',volume_number:1,published_at:now,status:'published'},{id:'v2',translation_id:'t2',title:'Libro segundo',volume_number:1,published_at:now,status:'published'}],
 publishedSections:[{id:'c1',volume_id:'v1',title:'Capítulo uno',published_at:now,status:'published'},{id:'c2',volume_id:'v2',title:'Capítulo dos',published_at:now,status:'published'}]};
const component=win.createReleasesPhase2({S,nav:()=>'<nav></nav>',status:()=>'',esc:v=>String(v),visibleCatalog:()=>catalog,titleOf:t=>t.novels?.title||t.title,safeMediaUrl:()=>'',volumeReleaseDate:()=>'',render:()=>{}});
const initial=component.prepared();
assert.equal(initial.length,2,'La vista agrupada debe evitar duplicar volúmenes');
assert.equal(new Set(initial.map(e=>e.volume.id)).size,2);
const page=component.view();
for(const required of ['Agrupar por volumen','Por publicación','Ocultar lo leído','Solo obras que sigo','Vista compacta','Calendario'])assert.ok(page.includes(required),required);
assert.ok(!releaseSource.includes('/rest/v1/volume_publication_schedule'),'No revelar programación privada en catálogo público');
assert.ok(page.includes('Silenciar'),'La vista permite silenciar obras');
store.set('nlobi:releases:v2:reader1',JSON.stringify({grouping:'chapter',mode:'calendar',onlyFollowing:true,hideRead:true,compact:true,muted:[]}));
const secondS={...S};
const filtered=win.createReleasesPhase2({S:secondS,nav:()=>'',status:()=>'',esc:v=>String(v),visibleCatalog:()=>catalog,titleOf:t=>t.title,safeMediaUrl:()=>'',volumeReleaseDate:()=>'',render:()=>{}});
assert.equal(filtered.prepared().length,1,'El filtro personal no oculta capítulos de otra cuenta ni los no leídos seguidos');
assert.equal(filtered.prepared()[0].type,'volume');
const other={...S,user:{id:'reader2'}};
const isolated=win.createReleasesPhase2({S:other,nav:()=>'',status:()=>'',esc:v=>String(v),visibleCatalog:()=>catalog,titleOf:t=>t.title,safeMediaUrl:()=>'',volumeReleaseDate:()=>'',render:()=>{}});
assert.equal(isolated.prepared().length,2,'Las preferencias son individuales por usuario');
const studioWin={},mockDocument={querySelectorAll:()=>[]};
new Function('window','document',studioSource)(studioWin,mockDocument);
const project={id:'t1',group_id:'g1',volumes:[{id:'v1',volume_number:1,title:'Próximo volumen',status:'draft',sections:[]}],
 publication_schedules:[{id:'s1',volume_id:'v1',status:'pending',scheduled_at:now}],
 publication_events:[],review_members:[]};
const studio=studioWin.createStudioPhase7({S:{user:{id:'reader1'},groups:[{translator_groups:{id:'g1'}}],studioProject:project},esc:v=>String(v),teamCan:()=>false,studioVolumeQuality:()=>({issues:[],warnings:[]}),studioSectionQuality:()=>({issues:[],warnings:[]})});
const summary=studio.summary(project);
assert.ok(summary.includes('Calendario editorial privado'));
assert.ok(summary.includes('Próximo volumen'));
assert.ok(summary.includes('Programaciones pendientes'));
assert.ok(summary.includes('data-studio-v7-calendar'));
const app=fs.readFileSync('src/app.js','utf8'),build=fs.readFileSync('scripts/build.mjs','utf8');
assert.ok(app.includes("loadReleasesPhase2()"));
assert.ok(build.includes('releases-phase2.js'));
assert.ok(build.includes('releases-phase2.css'));
console.log('Fase 2 lanzamientos: filtros, aislamiento, agrupación, calendario y build OK');
