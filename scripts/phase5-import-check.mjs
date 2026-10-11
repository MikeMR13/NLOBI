import {chromium} from 'playwright';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const built=spawnSync('python3',['scripts/phase5-import-fixtures.py'],{stdio:'inherit'});
if(built.status!==0)throw Error('Failed to generate test fixtures');
const b=await chromium.launch({headless:true,args:['--no-sandbox']});
const c=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
await c.route('**/runtime-config.js',r=>r.fulfill({status:200,contentType:'application/javascript',body:"window.__NLOBI_CONFIG__={supabaseUrl:'https://qa.supabase.local',supabasePublishableKey:'qa',qaMode:true};"}));
await c.route('https://qa.supabase.local/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
const failures=[];
const p=await c.newPage();
p.on('pageerror',e=>{failures.push('runtime: '+e.message);console.error('ERROR_PAGE',e.message)});
await p.goto('http://127.0.0.1:4173/#home',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>!!window.__NLOBI_QA__,null,{timeout:15000});
for(const ext of ['epub','docx','pdf']){
 const filename='filename-not-chapter.'+ext,bytes=fs.readFileSync('/tmp/nlobi-phase5-import/'+filename);
 try{
 const result=await p.evaluate(async o=>{
  const file=new File([new Uint8Array(o.bytes)],o.name);
  const parse=o.ext==='epub'?window.__NLOBI_QA__.parseEpub:o.ext==='docx'?window.__NLOBI_QA__.parseDocx:window.__NLOBI_QA__.parsePdf;
  const output=await parse(file);
  const sections=window.__NLOBI_QA__.detectImportSections(output.blocks,output.text);
  return {blocks:output.blocks?.length,chapters:sections.map(x=>x.title),cover:!!output.cover,coverSource:output.coverSource,warnings:output.warnings?.slice(0,5),text:output.text?.slice(0,300)};
 },{name:filename,ext,bytes:[...bytes]});
 console.log('PARSE_RESULT',ext,JSON.stringify(result));
 if(result.blocks<2||result.chapters.length<2)failures.push(ext+': expected at least two chapters');
 if(result.chapters.some(title=>/filename-not-chapter/i.test(title)))failures.push(ext+': file name became chapter');
 if(!result.text.toLowerCase().includes(ext==='epub'?'primer capítulo epub':ext==='docx'?'primer capítulo docx':'primer capitulo pdf'))failures.push(ext+': body text missing');
 if(ext==='epub'&&(!result.cover||!result.text.includes('かんじ')||!result.text.includes('Ilustración')))failures.push('epub: missing cover, furigana or image');
 }catch(e){failures.push(ext+': '+String(e));console.log('PARSE_ERROR',ext,String(e).slice(0,1100));}
}
await b.close();
console.log('PHASE5_IMPORT_QA',JSON.stringify({formats:3,failures}));
if(failures.length)process.exit(1);
