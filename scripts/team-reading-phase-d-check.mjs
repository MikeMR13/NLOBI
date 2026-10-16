import assert from 'node:assert/strict';
import fs from 'node:fs';
import {summarizeReadingSnapshot} from '../src/team-reading-metrics-phase-d.js';
const app=fs.readFileSync('src/app.js','utf8');
const css=fs.readFileSync('src/styles.css','utf8');
const build=fs.readFileSync('scripts/build.mjs','utf8');
const sql=fs.readFileSync('supabase/migrations/20261016213600_team_reading_snapshot_and_volume_bibliography.sql','utf8');
for(const fn of ['volumeBibliographyFields','readVolumeBibliography','volumeBibliographyPublic','teamReadingMetricsPanel'])assert.ok(app.includes('function '+fn+'('),fn+' not present');
for(const input of ['newVolumeBibbibliography','newVolumeBibisbn','newVolumeBibillustrator','editVolumeBibpublisher']){
 if(input==='newVolumeBibbibliography')continue;assert.ok(app.includes("field('"+input.replace(/^(newVolume|editVolume)Bib/,'')+"'")||app.includes('volumeBibliographyFields("'+input.split('Bib')[0]+'"'));
}
assert.ok(app.includes('volumeBibliographyFields("newVolume")'));
assert.ok(app.includes('volumeBibliographyFields("editVolume",v.bibliography)'));
assert.ok(app.includes('volumeBibliographyPublic(chosen)'));
assert.ok(app.includes('teamReadingMetricsPanel(G)'));
assert.ok(app.includes("bindTeamReadingMetrics({request:jreq})"));
assert.ok(app.includes("bibliography,epub_fonts"),'Missing PostgreSQL new-column selector');
assert.ok(app.includes("catch(metadataError)"),'Missing compatibility fallback');
assert.ok(build.includes('team-reading-metrics-phase-d.js'));
assert.ok(css.includes('.volumeBibliographyPublic')&&css.includes('.teamReadingChart'));
assert.match(sql,/ADD COLUMN IF NOT EXISTS bibliography jsonb NOT NULL DEFAULT/);
assert.match(sql,/SECURITY DEFINER/);
assert.match(sql,/SET search_path = ''/);
assert.match(sql,/m\.user_id=\(SELECT auth\.uid\(\)\)/);
assert.match(sql,/m\.role IN \('owner','admin'\)/);
assert.match(sql,/p_days IS DISTINCT FROM 30/);
assert.match(sql,/HAVING count\(DISTINCT user_id\)>=5/g);
assert.match(sql,/REVOKE ALL ON FUNCTION public\.team_reading_snapshot\(uuid,integer\) FROM PUBLIC, anon/);
assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.team_reading_snapshot\(uuid,integer\) TO authenticated/);
assert.ok(!sql.includes('CREATE TABLE public.reading_history'),'Must not create raw tracking tables');
const empty=summarizeReadingSnapshot({qualified:false,daily:[{date:'2026-10-11',readers:3,completions:3}]});
assert.equal(empty.ready,false);
const report=summarizeReadingSnapshot({qualified:true,unique_readers:8,chapter_completions:12,daily:[
 {date:'2026-10-12',readers:8,completions:12},{date:'2026-10-11',readers:3,completions:3}],
 chapters:[{title:'Prueba',novel_title:'Obra',volume_number:1,readers:8,completions:8},{title:'Baja',completions:2}]});
assert.equal(report.ready,true);assert.equal(report.readers,8);
assert.equal(report.days.length,1);
assert.equal(report.chapters.length,1);
console.log('Fase D: ficha opcional, consulta agregada privada y umbral de anonimato validados');
