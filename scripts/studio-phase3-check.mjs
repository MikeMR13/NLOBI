import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
new Function(app);
const start=app.indexOf('function studioWorkspaceSidebar('),end=app.indexOf('\nfunction mediaFolderOf(',start);
assert.ok(start>=0&&end>start,'Dashboard functions must exist');
const source=app.slice(start,end);
const types=[['light_novel','Novela ligera'],['web_novel','Novela web'],['original','Novela original']];
const statuses=[['active','Activa'],['paused','En pausa'],['abandoned','Abandonada'],['complete','Finalizada']];
const escapeText=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fakeGroup=id=>({role:id==='alpha'?'editor':'proofreader',translator_groups:{id,name:id==='alpha'?'Equipo A':'Equipo B'}});
const base={
 groups:[fakeGroup('alpha'),fakeGroup('beta')],
 studioTranslations:[
  {id:'first',status:'active',group_id:'alpha',title:'Primera',updated_at:'2026-10-09T13:00:00Z',
   language_code:'es',novels:{title:'Primera',novel_type:'light_novel'},
   volumes:[{id:'v1',status:'published',sections:[{id:'s1',status:'published'},{id:'s2',status:'draft'}]}]},
  {id:'second',status:'paused',group_id:'beta',title:'Segunda',updated_at:'2026-10-10T13:00:00Z',
   language_code:'es',novels:{title:'Segunda',novel_type:'original'},
   volumes:[{id:'v2',status:'draft',sections:[{id:'s3',status:'review'}]}]}
 ]
};
function show(overrides={}){
 const S={...base,...overrides};
 const can=(gid,action)=>gid==='alpha'?['create','edit','import','publish'].includes(action):action==='review';
 const factory=new Function('S','nav','status','teamCan','isCurrentGroupManager','isCurrentGroupEditor','safeMediaUrl','esc','novelTypeLabel','translationStatusLabel','TRANSLATION_STATUS_OPTIONS','NOVEL_TYPE_OPTIONS','localStorage',source+';return {studio,studioContextNav};');
 const views=factory(S,()=>'<nav id="globalNav"></nav>',()=>'',can,()=>false,gid=>gid==='alpha',v=>v||'#',escapeText,v=>Object.fromEntries(types)[v]||'Otro',v=>Object.fromEntries(statuses)[v]||v,statuses,types,{getItem:()=>null});
 return {html:views.studio(),context:views.studioContextNav()};
}
const {html,context}=show();
assert.match(html,/studioV3Sidebar/);
assert.match(html,/studioV3StatGrid/);
assert.match(html,/studioV3InsightGrid/);
assert.match(html,/studioV3CatalogSection/);
assert.match(html,/data-studio-display="list"/);
assert.match(html,/data-studio-display="grid"/);
assert.match(html,/studioNovelTypeFilter/);
assert.match(html,/studioTeamFilter/);
assert.match(html,/studioWorkflowFilter/);
assert.match(html,/studioProjectSort/);
assert.match(html,/2 obras encontradas/);
assert.match(html,/1 capítulo en revisión/);
assert.match(html,/data-studio-project="second"/);
assert.match(html,/Abrir revisiones/);
assert.match(html,/data-v="studio:new"/);
assert.match(html,/data-v="studio:import"/);
assert.ok(!html.includes('data-v="studio:media:beta"'),'Reviewers must not receive unauthorized media actions');
assert.match(context,/data-v="studio:teams"/);
const filtered=show({studioProjectFilter:'paused',studioNovelTypeFilter:'original',studioTeamFilter:'beta',studioWorkflowFilter:'review',studioDisplay:'list'}).html;
assert.match(filtered,/1 obra encontrada/);
assert.ok(!filtered.split('studioV3BookGridList')[1]?.includes('data-studio-project="first"'),'Filters apply to the catalog, not the overview');
assert.match(filtered,/studioV3BookGridList/);
const empty=show({studioNovelTypeFilter:'web_novel'}).html;
assert.match(empty,/No encontramos obras con esos filtros/);
assert.match(empty,/studioResetFiltersEmpty/);
assert.match(app,/id="studioResetFilters"/);
assert.match(app,/\['studioNovelTypeFilter','studioNovelTypeFilter'\]/);
assert.match(app,/data-studio-jump/);
for(const route of ['studioProjectReadOnlyView','studioProjectView','studioNewProject','studioImport','studioMediaView','studioTeamView','studioTeamsManagement']){
 const marker=new RegExp('function '+route+'\\(');
 const at=app.search(marker);
 assert.ok(at>=0,'Missing route '+route);
 assert.ok(app.slice(at,at+2500).includes('studioContextNav()'),'Navigation missing for '+route);
}
assert.match(app,/sections\(id,status\)/);
assert.match(app,/select=id,title,status,updated_at,language_code/);
assert.match(css,/Studio phase 3: editorial workspace/);
assert.match(css,/@media\(max-width:900px\)/);
assert.match(css,/@media\(max-width:350px\)/);
assert.match(css,/prefers-reduced-motion/);
console.log('Studio phase 3 checks OK: role-aware nav, responsive catalogue, filters and list/grid.');
