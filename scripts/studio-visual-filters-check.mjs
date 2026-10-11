import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const app=read('src/app.js'),css=read('src/styles.css');
new Function(app);
const studioStart=app.indexOf('function studioWorkspaceSidebar(');
const studioEnd=app.indexOf('\nfunction mediaFolderOf(',studioStart);
assert.ok(studioStart>=0&&studioEnd>studioStart);
const source=app.slice(studioStart,studioEnd);
const typeOptions=[['light_novel','Novela ligera'],['web_novel','Novela web'],['original','Novela original']];
const statusOptions=[['active','Activa'],['paused','En pausa'],['abandoned','Abandonada'],['awaiting_sequel','En espera de secuela'],['no_sequel_confirmed','Sin secuela confirmada'],['complete','Completada']];
const esc=v=>String(v??'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[x]));
const group=id=>({translator_groups:{id,name:id==='team1'?'Equipo inicial':'Equipo secundario'},role:'owner'});
const base=[
 {id:'active',status:'active',title:'La rosa',group_id:'team1',updated_at:'2026-10-10T13:00:00Z',novels:{title:'La rosa',title_original:'薔薇',author_name:'A',novel_type:'light_novel',genres:['Romance','Fantasía']},volumes:[{status:'published',sections:[{status:'published'}]},{status:'draft',sections:[{status:'draft'}]}]},
 {id:'complete',status:'complete',title:'Libro completo',group_id:'team1',updated_at:'2026-10-11T13:00:00Z',novels:{title:'Libro completo',author_name:'B',novel_type:'original',genres:['Fantasía']},volumes:[{status:'published',sections:[{status:'published'}]}]},
 {id:'paused',status:'paused',title:'Historias',group_id:'team2',updated_at:'2026-10-08T13:00:00Z',novels:{title:'Historias',author_name:'C',novel_type:'web_novel',genres:['Romance']},volumes:[{status:'draft',sections:[{status:'draft'}]}]},
 {id:'abandoned',status:'abandoned',title:'Sin tiempo',group_id:'team2',updated_at:'2026-10-07T13:00:00Z',novels:{title:'Sin tiempo',novel_type:'web_novel',genres:['Drama']},volumes:[]},
 {id:'sequel',status:'awaiting_sequel',title:'Próxima obra',group_id:'team1',updated_at:'2026-10-05T13:00:00Z',novels:{title:'Próxima obra',novel_type:'light_novel',genres:['Aventura']},volumes:[{status:'published',sections:[]}]},
 {id:'unconfirmed',status:'no_sequel_confirmed',title:'Sin secuela',group_id:'team2',updated_at:'2026-10-04T13:00:00Z',novels:{title:'Sin secuela',novel_type:'original',genres:['Misterio']},volumes:[]}
];
const functionFactory=new Function('S','nav','status','teamCan','isCurrentGroupManager','isCurrentGroupEditor','safeMediaUrl','esc','novelTypeLabel','translationStatusLabel','TRANSLATION_STATUS_OPTIONS','NOVEL_TYPE_OPTIONS','localStorage',source+';return studio;');
function show(filters={}){
 const S={groups:[group('team1'),group('team2')],studioTranslations:base, ...filters};
 const fn=functionFactory(S,()=>'<nav></nav>',()=>'',()=>true,()=>true,()=>true,()=>'',esc,
 t=>Object.fromEntries(typeOptions)[t]||t,t=>Object.fromEntries(statusOptions)[t]||t,statusOptions,typeOptions,{getItem:()=>null});
 return fn();
}
const full=show();
for(const [id] of [['studioProjectFilter'],['studioNovelTypeFilter'],['studioGenreFilter'],['studioPublicationFilter'],['studioTeamFilter'],['studioWorkflowFilter'],['studioProjectSort']])assert.ok(full.includes('id="'+id+'"'),'Missing filter '+id);
assert.ok(full.includes('Estado de traducción'));
assert.ok(full.includes('Completada'));
assert.ok(full.includes('6 obras encontradas'));
assert.ok(full.includes('Todos los géneros'));
assert.ok(full.includes('Fantasía'));
for(const [status,id] of [['active','active'],['paused','paused'],['abandoned','abandoned'],['complete','complete'],['awaiting_sequel','sequel'],['no_sequel_confirmed','unconfirmed']]){
 const html=show({studioProjectFilter:status});
 assert.match(html,/1 obra encontrada/,'Status '+status);
 assert.ok(html.includes('data-studio-project="'+id+'"'),status);
}
const partial=show({studioPublicationFilter:'partial'});assert.ok(partial.includes('data-studio-project="active"'));assert.match(partial,/1 obra encontrada/);
const complete=show({studioPublicationFilter:'full'});assert.ok(complete.includes('data-studio-project="complete"'));assert.ok(complete.includes('data-studio-project="sequel"'));
const none=show({studioPublicationFilter:'none'});assert.ok(none.includes('data-studio-project="paused"'));assert.ok(none.includes('data-studio-project="abandoned"'));
const combined=show({studioProjectFilter:'complete',studioGenreFilter:'Fantasía',studioNovelTypeFilter:'original',studioTeamFilter:'team1',studioPublicationFilter:'full'});
assert.match(combined,/1 obra encontrada/);assert.ok(combined.includes('data-studio-project="complete"'));assert.ok(combined.includes('1 capítulo en resultados'),'Chapter count should follow results');
const noMatch=show({studioProjectFilter:'complete',studioGenreFilter:'Romance'});
assert.match(noMatch,/No encontramos obras con esos filtros/);
assert.ok(show({studioProjectSearch:'FANTASIA'}).includes('2 obras encontradas'),'Accent-insensitive search must match actual metadata');
assert.ok(show({studioProjectSearch:'historias'}).includes('data-studio-project="paused"'));
assert.ok(app.includes("S.studioGenreFilter='all'")&&app.includes("S.studioPublicationFilter='all'"),'Clear all resets all filters');
for(const m of ["['studioGenreFilter','studioGenreFilter']","['studioPublicationFilter','studioPublicationFilter']",'id="studioPublicationFilter"'])assert.ok(app.includes(m));

const start=app.indexOf('function novelGenresPicker(');
const end=app.indexOf('\nfunction novelDemographyPicker(',start);
assert.ok(start>=0&&end>start,'Genre picker functions');
const factory=new Function('S','NOVEL_GENRES','esc','$$','document',app.slice(start,end)+';return {novelGenresPicker,selectedNovelGenres,bindNovelGenrePickers};');
const picker=factory({catalog:[{novels:{genres:['Novela & ensayo']}}]},['Romance','Fantasía'],esc,()=>[],{});
const genres=picker.novelGenresPicker('newNovelGenres',['Fantasía','Novela & ensayo']);
assert.ok(genres.includes('id="newNovelGenresQuery"'));
assert.ok(genres.includes('2 géneros seleccionados'));
assert.ok(genres.includes('Novela &amp; ensayo'));
assert.ok(genres.includes('value="Fantasía" checked'));
assert.ok(!picker.novelGenresPicker('newNovelGenres',null).includes('undefined'));
assert.match(css,/\.genreDropdownPanel/);assert.match(css,/\.genrePicker .*label\[hidden\]/);
console.log('Studio visual/filter regression OK: all translation statuses, genre, publication, filters combined, responsive picker and safe HTML.');
