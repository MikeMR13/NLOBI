import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const app=read('src/app.js'),src=read('src/studio-phase6.js'),html=read('src/index.html'),css=read('src/styles.css'),build=read('scripts/build.mjs'),sw=read('public/sw.js');
new Function(app);
const w={};new Function('window',src)(w);
assert.equal(typeof w.createStudioPhase6,'function');
for(const id of ['studioProjectQuality','studioQaSeverity','studioQaQuery','data-qa-volume','data-qa-export'])assert.ok(src.includes(id),'QA component missing: '+id);
assert.match(app,/studioQuality\?\.renderPanel\(P\)/);
assert.match(app,/studioQuality\?\.bind\(\)/);
assert.match(app,/data-studio-project-jump="studioProjectQuality"/);
assert.match(app,/if\(destination.tagName==='DETAILS'\)destination.open=true/);
assert.match(html,/assets\/studio-phase6\.js/);
assert.match(build,/studio-phase6\.js/);
assert.match(sw,/studio-phase6\.js/);
assert.match(css,/\.studioV6Audit/);
assert.match(css,/@media\(max-width:600px\)/);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const mockState={groups:[{translator_groups:{id:'g'}}],studioQaQuery:'',studioQaSeverity:'all'};
const m=w.createStudioPhase6({S:mockState,esc,$:()=>null,$$:()=>[],teamCan:()=>true,editSection:()=>{},toast:()=>{},blocksToPlainText:blocks=>(blocks||[]).map(b=>b.text||b.base||'').join('\n')});
const project={id:'t',group_id:'g',title:'Historia',novels:{title:'Historia',synopsis:'Sinopsis',author_name:'Autor',genres:['Romance'],demography:'General',novel_type:'light_novel',cover_url:'https://example.org/cover.png'},
translator_groups:{review_required:true},review_requests:[{id:'review1',section_id:'c1',status:'approved',created_at:'2026-10-10T12:00:00Z'}],publication_schedules:[],
volumes:[{id:'v1',volume_number:1,title:'Volumen de prueba',cover_url:'https://example.org/v1.png',status:'draft',sections:[
{id:'c1',title:'Capítulo <b>1</b>',status:'draft',section_number:1,content:[{type:'paragraph',text:'Texto válido.'},{type:'image',url:'https://example.org/p.png',alt:''}]},
{id:'c2',title:'Capítulo dos',status:'draft',section_number:2,content:[]}
]}]};
const report=m.reportFor(project),codes=report.issues.map(x=>x.code);
assert.ok(codes.includes('chapter-empty'),'Empty chapter must block readiness');
assert.ok(codes.includes('review-required'),'Missing required approval must be detected');
assert.ok(codes.includes('image-alt'),'Missing alt must warn');
assert.ok(codes.includes('review-verify'),'Approvals must not be advertised as permanently valid');
assert.equal(report.totals.sections,2);
assert.equal(report.totals.images,1);
const markup=m.renderPanel(project);
assert.match(markup,/Auditoría editorial/);
assert.match(markup,/Vol\. 1/);
assert.match(markup,/Capítulo &lt;b&gt;1&lt;\/b&gt;/);
assert.doesNotMatch(markup,/<b>1<\/b>/,'User-supplied chapter title must be escaped');
assert.match(markup,/data-qa-section="c2"/);
assert.match(markup,/Exportar diagnóstico/);
const clean=m.reportFor({...project,translator_groups:{review_required:false},volumes:[{...project.volumes[0],sections:[{...project.volumes[0].sections[0],content:[{type:'paragraph',text:'Texto suficiente.'}]}]}]});
assert.equal(clean.totals.errors,0,'Ready content should have no blocking diagnostic errors');
const final=m.reportFor({...project,volumes:[{...project.volumes[0],is_final_volume:true,final_translation_status:null}]});
assert.ok(final.issues.some(i=>i.code==='final-status'));
const xss=m.reportFor({...project,volumes:[{...project.volumes[0],title:'<script>alert(1)</script>'}]});
assert.doesNotMatch(m.renderPanel({...project,volumes:[{...project.volumes[0],title:'<script>alert(1)</script>'}]}),/<script>/);
assert.ok(xss.volumes[0].title.includes('<script>'),'Inspector must not silently rewrite stored metadata');
console.log('Studio Fase 6 OK: report classifications, escaped output, role integration, final-volume metadata and build assets.');
