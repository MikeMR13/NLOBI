import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sanitizeTeamAppearance,exportTeamAppearance,importTeamAppearance} from '../src/team-appearance-phase-b.js';
const source=fs.readFileSync('src/app.js','utf8');
const css=fs.readFileSync('src/styles.css','utf8');
const beginning=source.indexOf('const TEAM_SEASONS='),ending=source.indexOf('function teamBControls(G)',beginning);
assert.ok(beginning>=0&&ending>beginning,'No seasonal helpers found in app');
const symbols=new Function('esc','teamSettings','teamBKey','teamBOptions',
 source.slice(beginning,ending)+'\nreturn {teamSeasonEffective,teamSeasonGreeting,teamSeasonValidate,teamSeasonDateOk,teamSeasonDecor,teamSeasonClasses,teamSeasonControls};'
)(
 value=>String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'),
 group=>group.profile_settings||{},
 (p,key,values,defaultValue)=>Object.prototype.hasOwnProperty.call(values,p?.[key])?p[key]:defaultValue,
 (opts,current)=>Object.entries(opts).map(([key,title])=>'<option value="'+key+'"'+(key===current?' selected':'')+'>'+title+'</option>').join('')
);
const {teamSeasonEffective,teamSeasonGreeting,teamSeasonValidate,teamSeasonDateOk,teamSeasonDecor,teamSeasonClasses,teamSeasonControls}=symbols;
const data={team_season:'sakura',team_season_motion:'static',team_season_density:'suave',team_season_mode:'scheduled',
 team_season_start:'2026-10-15',team_season_end:'2026-10-20',team_season_message:'¡Feliz lectura!'};
assert.equal(teamSeasonEffective(data,'2026-10-15'),'sakura');
assert.equal(teamSeasonEffective(data,'2026-10-20'),'sakura');
assert.equal(teamSeasonEffective(data,'2026-10-14'),'none');
assert.equal(teamSeasonEffective(data,'2026-10-21'),'none');
assert.equal(teamSeasonDecor({...data,team_season_start:'2026-10-21'}),'');
assert.equal(teamSeasonClasses(data).includes('teamSeason-sakura'),new Date().toISOString().slice(0,10)>='2026-10-15'&&new Date().toISOString().slice(0,10)<='2026-10-20');
assert.equal(teamSeasonEffective({team_season:'nieve'},'2028-12-10'),'nieve','Old profiles must keep working');
assert.equal(teamSeasonEffective({team_season:'matsuri',team_season_mode:'manual',team_season_start:'2035-01-01'},'2027-03-01'),'matsuri');
assert.equal(teamSeasonEffective({...data,team_season_start:'2026-02-30'},'2026-10-18'),'none');
assert.equal(teamSeasonDateOk('2028-02-29'),true);
assert.equal(teamSeasonDateOk('2027-02-29'),false);
assert.ok(teamSeasonGreeting(data).includes('Feliz lectura'));
assert.equal(teamSeasonGreeting({...data,team_season_start:'2027-12-01'}),'');
assert.ok(teamSeasonGreeting({...data,team_season_message:'<img src=x onerror=alert(1)>'}).includes('&lt;img'));
assert.doesNotThrow(()=>teamSeasonValidate(data));
for(const bad of [{...data,team_season_start:'2026-02-30'},{...data,team_season_end:'2026-10-01'},{
 ...data,team_season_start:'2026-01-01',team_season_end:'2027-12-31'},{...data,team_season_mode:'scheduled',team_season:'none'},
 {...data,team_season_message:'z'.repeat(161)}])assert.throws(()=>teamSeasonValidate(bad),'Invalid season schedule accepted');
const portable=importTeamAppearance(exportTeamAppearance(data,'Sakura 2026'));
assert.deepEqual(portable.appearance,sanitizeTeamAppearance(data));
for(const bad of [{...data,team_season_start:'2026-02-30'},{...data,team_season_message:'<script>'+'x'.repeat(160)},{...data,team_season_mode:'wrong'}])assert.throws(()=>sanitizeTeamAppearance(bad),'Unsafe theme accepted');
assert.deepEqual(sanitizeTeamAppearance({team_season:'sakura',team_season_motion:'static'}),{team_season:'sakura',team_season_motion:'static'});
const fieldHtml=teamSeasonControls({profile_settings:data});
for(const key of ['team_season_mode','team_season_start','team_season_end','team_season_message'])assert.ok(fieldHtml.includes('data-team-setting="'+key+'"'),'Missing setting '+key);
assert.ok(source.includes('teamSeasonGreeting(customization)'),'Missing public greeting');
assert.ok(source.includes('teamSeasonGreeting(p)'),'Missing team preview greeting');
assert.ok(source.includes('teamSeasonValidate(profile_settings)'),'Missing save validation');
assert.ok(css.includes('.teamSeasonGreeting')&&css.includes('@media(max-width:560px)'),'Missing responsive greeting');
console.log('Fase E: scheduled seasons, inclusive UTC windows, greeting escaping, portable themes and legacy profiles OK');
