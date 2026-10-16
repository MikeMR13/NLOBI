import fs from 'node:fs';
import assert from 'node:assert/strict';
import {normalizeTeamSectionOrder,sanitizeTeamAppearance,exportTeamAppearance,importTeamAppearance} from '../src/team-appearance-phase-b.js';
const app=fs.readFileSync('src/app.js','utf8'),css=fs.readFileSync('src/styles.css','utf8'),build=fs.readFileSync('scripts/build.mjs','utf8');
for(const name of ['teamBControls','teamBKey','teamBOptions'])assert.ok(app.includes('function '+name+'('),'Falta '+name);
for(const p of ['seigaiha','asanoha','sakura','washi']){assert.ok(app.includes(p+':'));assert.ok(css.includes('teamPattern-'+p))}
for(const key of ['team_pattern','team_pattern_intensity','team_font','team_cover_style'])assert.ok(app.includes('data-team-setting="'+key+'"'));
for(const name of ['teamCover-obi','teamCover-bolsillo','teamFont-literaria','teamFont-clasica','teamFont-moderna','teamFont-japonesa'])assert.ok(css.includes(name));
assert.ok(app.includes('teamBControls(G)'));
assert.ok(app.includes('bindTeamAppearanceB('));
assert.ok(app.includes('sanitizeTeamAppearance(profile_settings)'));
assert.ok(build.includes('team-appearance-phase-b.js'));
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
const order=normalizeTeamSectionOrder('fijadas, obras_no_autorizadas, fijadas, destacados');
assert.equal(order.length,7);assert.equal(order[0],'fijadas');assert.equal(order[1],'destacados');
const appearance={team_template:'editorial',team_palette:'sakura',team_pattern:'asanoha',team_pattern_intensity:'12',team_font:'japonesa',team_cover_style:'obi',accent_color:'#a1b2c3',theme:'claro'};
const clean=sanitizeTeamAppearance({...appearance,admin:true,background_image:'https://unsafe.invalid'});
assert.equal(clean.admin,undefined);assert.equal(clean.background_image,undefined);
const portable=exportTeamAppearance(appearance,'Obi clásico');
const result=importTeamAppearance(portable);
assert.equal(result.name,'Obi clásico');assert.deepEqual(result.appearance,sanitizeTeamAppearance(appearance));
for(const unsafe of [{team_pattern:'<script>alert(1)</script>'},{team_font:'url(https://host)'},{team_pattern_intensity:'999'},{team_cover_style:'javascript:'},{accent_color:'#fffff;'}])
 assert.throws(()=>sanitizeTeamAppearance(unsafe));
assert.throws(()=>importTeamAppearance('{"obi_team_theme":2,"appearance":{}}'));
assert.throws(()=>importTeamAppearance('a'.repeat(8001)));
console.log('Fase B: integración, temas portables, validación y CSS OK');
