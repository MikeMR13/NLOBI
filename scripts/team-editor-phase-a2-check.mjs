import assert from 'node:assert/strict';
import fs from 'node:fs';
import {TEAM_DESIGN_KEYS,pickTeamDesignSettings,compareTeamDesigns,saveTeamDesignDraft} from '../src/team-editor-phase-a2.js';
const app=fs.readFileSync('src/app.js','utf8');
const sql=fs.readFileSync('supabase/migrations/20261016234500_team_design_drafts_and_publishing.sql','utf8');
const build=fs.readFileSync('scripts/build.mjs','utf8');
const css=fs.readFileSync('src/styles.css','utf8');
assert.ok(TEAM_DESIGN_KEYS.length>=55,'Design whitelist too small');
const sqlKeys=sql.slice(sql.indexOf('v_keys text[] :='),sql.indexOf('v_settings jsonb;'));
for(const key of TEAM_DESIGN_KEYS)assert.ok(sqlKeys.includes("'"+key+"'"),'SQL missing allowed design key '+key);
const raw={team_template:'editorial',team_season:'sakura',tagline:'Editorial',show_works:false,
 reader_logo_url:'https://example.com/logo.png',reader_default_font:'custom',unknown_setting:'sensitive'};
assert.deepEqual(pickTeamDesignSettings(raw),{team_template:'editorial',team_season:'sakura',tagline:'Editorial',show_works:false});
assert.ok(!Object.hasOwn(pickTeamDesignSettings(raw),'reader_logo_url'),'Reader logo settings must be unaffected by design publish');
assert.ok(!Object.hasOwn(pickTeamDesignSettings(raw),'reader_default_font'),'Reader preferences must remain untouched');
assert.equal(compareTeamDesigns({team_template:'original'}, {team_template:'editorial'}).length,1);
assert.equal(compareTeamDesigns({team_template:'original'}, {team_template:'original'}).length,0);
assert.equal(compareTeamDesigns({}, {team_template:'original',team_palette:'original',show_stats:true,section_order:'presentacion,destacados,fijadas,estadisticas,traducciones,novedades,apoyo'}).length,0,'Unconfigured defaults should not appear as changes');
assert.throws(()=>pickTeamDesignSettings({tagline:'z'.repeat(4001)}));
let calls=0;
const fake=(path,opts)=>{calls++;assert.equal(path,'/rest/v1/rpc/team_design_save_draft');assert.equal(opts.method,'POST');
 const d=JSON.parse(opts.body);assert.equal(d.p_group_id,'11111111-1111-4111-8111-111111111111');
 assert.deepEqual(d.p_settings,{team_palette:'tinta'});return '33333333-3333-4333-8333-333333333333'};
const id=await saveTeamDesignDraft({request:fake,groupId:'11111111-1111-4111-8111-111111111111',settings:{team_palette:'tinta',reader_default_font:'unknown'}});
assert.equal(id,'33333333-3333-4333-8333-333333333333');assert.equal(calls,1);
assert.ok(app.includes("team_design_draft_saved")===false,'Do not use misleading event names');
assert.ok(app.includes("team-design-draft-saved"),'No saved draft event');
assert.ok(app.includes("saveTeamDesignDraft({request:jreq"),'Save flow bypasses revision RPC');
assert.ok(app.includes("function teamCustomFullPreview("),'Missing full preview');
assert.ok(app.includes('function publicGroupView(){'),'Published renderer signature must stay stable');
assert.ok(app.includes('teamPublicPreviewOverride=virtual;full=publicGroupView()'),'Preview must render actual published template');
assert.ok(app.includes('id="teamDesignFrame"'),'Missing sandboxed iframe');
assert.ok(app.includes('sandbox="allow-same-origin"'),'Preview must remain sandboxed without script permission');
assert.ok(!app.includes('sandbox="allow-same-origin allow-scripts"'),'Scripts must never run in profile preview');
assert.ok(app.includes('aria-pressed="false"'),'Preview toggle missing pressed state');
assert.ok(build.includes('team-editor-phase-a2.js'),'Missing asset bundling');
assert.ok(css.includes('.teamDesignWorkflow'),'Missing revision panel styles');
for(const rule of [
 /ENABLE ROW LEVEL SECURITY/,
 /FOR SELECT TO authenticated/,
 /m\.user_id=\(SELECT auth\.uid\(\)\)/,
 /m\.role IN \('owner','admin'\)/,
 /SECURITY DEFINER SET search_path=''/,
 /base_digest<>md5\(v_current::text\)/,
 /coalesce\(profile_settings,'\{\}'::jsonb\) - v_keys/,
 /REVOKE ALL ON FUNCTION public\.team_design_publish\(uuid,uuid\) FROM PUBLIC,anon/
 ])assert.match(sql,rule);
assert.ok(sql.includes("CREATE POLICY team_design_revisions_manager_read"),'Missing tenant-scoped RLS policy');
assert.ok(sql.includes("kind='published'"),'Historical published versions not retained');
assert.ok(!sql.includes("CREATE TRIGGER"),'No additional background triggers needed');
console.log('A.2: design field isolation, private versioning, draft conflict prevention and real preview checks OK');
