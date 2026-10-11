import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
new Function(app);
const section=(begin,end)=>{
 const a=app.indexOf(begin),b=app.indexOf(end,a+1);
 assert.ok(a>=0&&b>a, 'Expected source region '+begin);
 return app.slice(a,b);
};
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const state={studioSectionQuery:'capítulo',studioSectionStatusFilter:'review',studioSectionTypeFilter:'chapter'};
const rows=[
 {dataset:{studioSectionTitle:'Capítulo 1',studioSectionStatus:'draft',studioSectionReview:'pending',studioSectionType:'chapter'},hidden:false},
 {dataset:{studioSectionTitle:'Capítulo 2',studioSectionStatus:'published',studioSectionReview:'none',studioSectionType:'chapter'},hidden:false},
 {dataset:{studioSectionTitle:'Extra',studioSectionStatus:'draft',studioSectionReview:'pending',studioSectionType:'extra'},hidden:false},
];
const status={textContent:''};
const documentMock={
 getElementById:id=>id==='studioProjectVolumes'?{}:id==='studioSectionFilterCount'?status:null,
 querySelectorAll:selector=>selector==='.studioVolumeGrid [data-studio-section-id]'?rows:[]
};
const tools=new Function('S','esc','document',section('function studioProjectNavigation','function studioProjectReadOnlyView')+';return {studioProjectNavigation,studioProjectSectionFilters,applyStudioSectionFilters};')(state,esc,documentMock);
const project={volumes:[{sections:[{id:'a'},{id:'b'}]}],editingSection:{id:'a'}};
assert.match(tools.studioProjectNavigation(project),/studioProjectOverview/);
assert.match(tools.studioProjectNavigation(project),/studioProjectMetadata/);
assert.match(tools.studioProjectNavigation(project),/studioProjectEditor/);
assert.doesNotMatch(tools.studioProjectNavigation(project,true),/studioProjectMetadata/);
assert.match(tools.studioProjectSectionFilters(project),/id="studioSectionQuery"/);
assert.match(tools.studioProjectSectionFilters(project),/id="studioSectionStatusFilter"/);
tools.applyStudioSectionFilters();
assert.deepEqual(rows.map(r=>r.hidden),[false,true,true], 'Pending review should use review requests and the search query');
assert.match(status.textContent,/1 de 3 secciones/);
state.studioSectionStatusFilter='all';state.studioSectionTypeFilter='all';state.studioSectionQuery='';
tools.applyStudioSectionFilters();
assert.deepEqual(rows.map(r=>r.hidden),[false,false,false]);

const editorSource=section('function studioEditorSnapshot','function studioSectionEditor');
const store={studioProject:{editingSection:{id:'chapter',title:'Capítulo'}},blockEditor:{sectionId:'chapter',blocks:[{type:'paragraph',text:'Hola'}]},editorSavedSnapshot:null};
const controls={'#editSectionTitle':{value:'Capítulo'},'#editSectionType':{value:'chapter'},'#studioEditorMetrics':{textContent:''},'#studioEditorUnsaved':{textContent:'',dataset:{}}};
const editing=new Function('S','normalizeBlock','esc','blocksToPlainText','$','syncEditorInputs','window',
 editorSource+';return {studioEditorSnapshot,studioEditorHasUnsavedChanges,studioEditorStatistics,updateStudioEditorStatus};'
)(store,x=>({...x}),esc,blocks=>(blocks||[]).map(b=>b.text||'').join('\n'),selector=>controls[selector],()=>{},{addEventListener:()=>{}});
const base=editing.studioEditorSnapshot('Capítulo','chapter',[{type:'paragraph',text:'Hola'}]);
const simple=editing.studioEditorSnapshot('Capítulo','chapter',[{type:'paragraph',text:'Hola',html:'Hola'}]);
assert.equal(base,simple,'Paged plain HTML must not be treated as a formatting change');
assert.notEqual(base,editing.studioEditorSnapshot('Capítulo','chapter',[{type:'paragraph',text:'Hola',html:'<b>Hola</b>'}]));
store.editorSavedSnapshot=base;
assert.equal(editing.studioEditorHasUnsavedChanges(),false);
editing.updateStudioEditorStatus();
assert.equal(controls['#studioEditorUnsaved'].dataset.dirty,'false');
controls['#editSectionTitle'].value='Capítulo corregido';
assert.equal(editing.studioEditorHasUnsavedChanges(),true);
editing.updateStudioEditorStatus();
assert.equal(controls['#studioEditorUnsaved'].dataset.dirty,'true');
assert.match(controls['#studioEditorMetrics'].textContent,/1 palabras/);

const previewSource=section('function studioImportFinalPreview','function importStepView');
const preview=new Function('esc','blocksToPlainText','importBlockSummary','importMediaPreview',previewSource+';return studioImportFinalPreview;')(
 esc,blocks=>blocks.map(x=>x.text||'').join('\n'),()=> '1 párrafo',()=>'<div class="imagePreview">Imagen</div>'
);
const html=preview({sections:[{title:'Capítulo de prueba',section_type:'chapter',blocks:[{text:'Texto de muestra'}]}]});
assert.match(html,/Vista previa del volumen antes de guardar/);
assert.match(html,/Capítulo de prueba/);
assert.match(html,/Texto de muestra/);
assert.match(html,/imagePreview/);

for(const key of ['projectOriginalTitle','projectAuthor','projectSynopsis']){
 assert.ok(app.includes('id="'+key+'"'),'Missing editable metadata field '+key);
}
assert.match(app,/novels\(id,title,title_original,synopsis,cover_url,author_name/);
assert.match(app,/JSON\.stringify\(\{genres,tags,demography,novel_type,title_original,author_name,synopsis,/);
assert.match(app,/data-studio-section-review/);
assert.match(app,/if\(S\.view\?\.startsWith\('studio:project:'\)/);
assert.match(app,/key\.toLowerCase\(\)==='s'/);
assert.match(app,/window\.addEventListener\('beforeunload'/);
assert.match(app,/if\(S\.editorSaving\)return/);
assert.match(app,/setTimeout\(backupEditorialDraft,1200\)/);
assert.match(css,/Studio phase 4: work and editor usability/);
assert.match(css,/@media\(max-width:480px\)/);
assert.match(css,/prefers-reduced-motion/);
console.log('Studio phase 4 checks OK: metadata, review filter, import preview, editor snapshots and navigation.');
