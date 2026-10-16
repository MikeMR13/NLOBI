// Auditoría 2026-10-16: catálogo/LCP y SQL de seguridad sin alterar datos productivos.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {seedFeaturedHomeHtml} from './home-seed-html.mjs';

const sql=fs.readFileSync('supabase/migrations/20261016165000_audit_volume_digest_and_glossary_rls.sql','utf8');
const source=fs.readFileSync('src/index.html','utf8');
const helper=fs.readFileSync('src/home-cover-hint.js','utf8');
const origin='https://qa.supabase.local';
const relative='/media/teams/qa/covers/cover.webp';
const book={id:'book-1',novels:{title:'Ejemplo & prueba',cover_url:origin+'/storage/v1/object/public/nlobi-media/teams/qa/covers/cover.webp'}};
const seeded=seedFeaturedHomeHtml(source,book,origin);
const preload='<link rel="preload" as="image" href="'+relative+'" fetchpriority="high" data-home-cover-seed>';
assert.ok(seeded.includes(preload),'La imagen crítica se descubre en HTML inicial, sin JavaScript');
assert.ok(seeded.indexOf(preload)<seeded.indexOf('/assets/home-cover-hint.js'),'HEAD precede al JS');
assert.ok(seeded.indexOf(preload)<seeded.indexOf('</head>'));
assert.match(seeded,/data-early-featured-cover/);
assert.match(seeded,/alt="Portada de Ejemplo &amp; prueba"/);
assert.equal(seeded.split(preload).length,2,'Precarga única');
assert.equal(seedFeaturedHomeHtml(seeded,book,origin),seeded);
assert.equal(seedFeaturedHomeHtml(source,{...book,novels:{cover_url:'https://evil.example/cover.jpg'}},origin),source);

function runHint(seed,localCover){
 const links=[],document={
  head:{append(link){links.push(link)}},
  querySelector(selector){
   if(selector==='link[data-home-cover-seed]')return seed?{getAttribute:()=>relative}:null;
   if(selector==='meta[name="nlobi-build-cover"]')return {content:relative};
   return null;
  },
  createElement(){return {dataset:{}}}
 };
 const at=Date.now(),localStorage={getItem(){return JSON.stringify({path:localCover,at})}};
 vm.runInNewContext(helper,{document,location:{hash:'#home',origin:'https://nlobi.vercel.app'},localStorage,Date,URL});
 return links;
}
assert.equal(runHint(true,'/media/other/image.jpg').length,0,'Semilla HEAD evita segunda descarga');
assert.equal(runHint(false,'/media/other/image.jpg').length,1,'Visitas sin semilla conservan la pista local');

assert.match(sql,/create or replace function private\.notify_volume_activity/);
assert.match(sql,/volume-published:/);
assert.match(sql,/volume-updated:/);
assert.match(sql,/YYYYMMDDHH24/);
assert.match(sql,/transaction_timestamp/);
assert.match(sql,/and private\.notification_enabled\(f\.user_id,'new_publications'\)/);
assert.match(sql,/on conflict do nothing/);
assert.doesNotMatch(sql,/txid_current\(\)/,'Los avisos nunca se individualizan por transacción');
assert.match(sql,/previous\.event_key = 'volume-published:'/,'No repetir capítulos del estreno');
assert.match(sql,/null::uuid, v_event_key/,'Siempre por volumen, no por capítulo');
assert.match(sql,/create policy translation_glossary_anon_read[\s\S]*?to anon/);
assert.match(sql,/create policy translation_glossary_authenticated_read[\s\S]*?to authenticated/);
assert.match(sql,/t\.id=translation_glossary_terms\.translation_id/g);
assert.match(sql,/private\.team_action_allowed\(t\.group_id,'edit'\)/);
assert.doesNotMatch(sql,/to anon,authenticated/,'Una única política no debe exponer borradores');
const workflow=fs.readFileSync('.github/workflows/ci.yml','utf8');
assert.ok(workflow.includes('node scripts/audit-hardening-20261016-check.mjs'));
console.log('Audit hardening 2026-10-16: OK (preload, permisos de glosario, consolidación de avisos).');