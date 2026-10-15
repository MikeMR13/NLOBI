import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const js=fs.readFileSync('src/glossary-phase1.js','utf8');
const sandbox={window:{}};
vm.runInNewContext(js,sandbox,{filename:'glossary-phase1.js'});
assert.equal(typeof sandbox.window.createGlossaryPhase1,'function');

const state={studioProject:null};
const glossary=sandbox.window.createGlossaryPhase1({
 S:state, jreq:async()=>[], esc:s=>String(s), toast:()=>{}, teamCan:()=>true
});
const translationId='00000000-0000-4000-8000-000000000001';
const terms=[
 {term:'Lucian',category:'Personaje',definition:'Protagonista'},
 {term:'†Mago Negro†',category:'Personaje',definition:'Usuario de juego'}
];
const chapter={id:'chapter1',title:'Primero',content:[{type:'paragraph',text:'lucian encontró a †Mago Negro†. Luciana pasó de largo.'}]};
const project={id:translationId,group_id:'g1',volumes:[{volume_number:1,sections:[chapter]}]};
state.studioProject=project;
const report=glossary.check(project,terms);
assert.equal(report.length,1,'Solo la variante de mayúsculas debe marcarse');
assert.equal(report[0].expected,'Lucian');
assert.equal(report[0].actual,'lucian');
assert.equal(report[0].count,1);
assert.match(glossary.panel(project),/Glosario y terminología/);
assert.match(glossary.panel(project),/data-glossary-form/);
const readonly=sandbox.window.createGlossaryPhase1({S:state,jreq:async()=>[],esc:s=>String(s),toast:()=>{},teamCan:()=>false});
assert.doesNotMatch(readonly.panel(project),/data-glossary-form/);

const sql=fs.readFileSync('supabase/migrations/20261015153000_translation_glossary.sql','utf8');
for(const part of ['enable row level security','translation_glossary_public_select','translation_glossary_team_select','translation_glossary_insert','translation_glossary_update','translation_glossary_delete'])assert.ok(sql.includes(part),part);
const app=fs.readFileSync('src/app.js','utf8');
assert.ok(app.includes('loadGlossaryPhase1()'));
assert.ok(app.includes('studioGlossary?.panel(P)'));
assert.ok(app.includes('glossary.decorateReader(S.readerSection)'));
const build=fs.readFileSync('scripts/build.mjs','utf8');
assert.ok(build.includes('src", "glossary-phase1.js'));
assert.ok(build.includes('src", "glossary-phase1.css'));
console.log('Glosario fase 1: integración, consistencia y permisos estáticos OK');
